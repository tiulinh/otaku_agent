import {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  logger,
} from "@elizaos/core";
import { TradingSignal } from "../services/token-metrics.service";
import { TokenMetricsClient } from "tmai-api";

// Token Metrics SDK integration - clean and simple
async function fetchTradingSignals(symbols: string[], apiKey: string): Promise<TradingSignal[]> {
  if (!apiKey) {
    throw new Error("TOKENMETRICS_API_KEY not configured");
  }

  try {
    // Initialize Token Metrics client
    const client = new TokenMetricsClient(apiKey);

    // Get token data (includes price, market cap, volume, etc.)
    const tokensResult = await client.tokens.get({ symbol: symbols.join(",") });

    if (!tokensResult.success || !tokensResult.data || tokensResult.data.length === 0) {
      throw new Error("No data returned from Token Metrics API");
    }

    // Get price data for more accuracy - use LATEST price only
    const priceResult = await client.price.get({ symbol: symbols.join(",") });
    const priceMap = new Map();
    if (priceResult.success && priceResult.data) {
      // Group by token_id and keep only the most recent price
      const pricesByToken = new Map<number, any[]>();
      priceResult.data.forEach((p: any) => {
        if (!pricesByToken.has(p.token_id)) {
          pricesByToken.set(p.token_id, []);
        }
        pricesByToken.get(p.token_id)!.push(p);
      });

      // For each token, get the latest non-null price
      pricesByToken.forEach((prices, tokenId) => {
        const sortedPrices = prices.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const latestPrice = sortedPrices.find(p => p.current_price !== null && p.current_price !== undefined);
        if (latestPrice) {
          priceMap.set(tokenId, latestPrice.current_price);
        }
      });
    }

    // Filter to keep only the token with highest market cap for each symbol
    // Token Metrics API returns multiple tokens with same symbol (e.g., 10+ "BTC" tokens)
    const symbolToTokenMap = new Map<string, any>();
    tokensResult.data.forEach((token: any) => {
      // Skip tokens without symbol
      if (!token.token_symbol) {
        return;
      }

      const symbol = token.token_symbol.toUpperCase();
      const existing = symbolToTokenMap.get(symbol);

      // Keep token with highest market cap
      if (!existing || (token.market_cap || 0) > (existing.market_cap || 0)) {
        symbolToTokenMap.set(symbol, token);
      }
    });

    const filteredTokens = Array.from(symbolToTokenMap.values());

    // Try to get resistance/support levels and price predictions (may require paid tier)
    const resistanceSupportMap = new Map();
    const pricePredictionMap = new Map();

    for (const symbol of symbols) {
      try {
        const rsResult = await client.resistanceSupport.get({ symbol });
        if (rsResult.success && rsResult.data && rsResult.data.length > 0) {
          resistanceSupportMap.set(symbol.toUpperCase(), rsResult.data[0]);
        }
      } catch (err) {
        // Silently skip if unavailable
      }

      try {
        // @ts-ignore - pricePrediction endpoint exists in tmai-api v3.3.0
        const ppResult = await client.pricePrediction.get({ symbol });
        if (ppResult.success && ppResult.data && ppResult.data.length > 0) {
          pricePredictionMap.set(symbol.toUpperCase(), ppResult.data[0]);
        }
      } catch (err) {
        // Silently skip if unavailable
      }
    }

    // Generate signals from filtered Token Metrics data
    const signals: TradingSignal[] = filteredTokens.map((token: any) => {
      const currentPrice = priceMap.get(token.token_id) || token.current_price || 0;
      const priceChange24h = token.price_change_percentage_24h_in_currency || 0;
      const marketCap = token.market_cap || 0;
      const volume24h = token.total_volume || 0;

      // Get resistance/support and price prediction data (if available - PAID tier only)
      const tokenSymbol = (token.token_symbol || "").toUpperCase();
      const rsData = resistanceSupportMap.get(tokenSymbol);
      const ppData = pricePredictionMap.get(tokenSymbol);

      // Generate signal - use AI price prediction (PAID tier) or show warning (FREE tier)
      let signal: "BUY" | "SELL" | "HOLD";
      let signalSource: string;

      if (ppData && ppData.predicted_price && currentPrice > 0) {
        // PAID tier: Use AI predicted price comparison
        if (ppData.predicted_price > currentPrice) {
          signal = "BUY";
          signalSource = `AI prediction ($${ppData.predicted_price.toFixed(2)} > $${currentPrice.toFixed(2)})`;
        } else if (ppData.predicted_price < currentPrice) {
          signal = "SELL";
          signalSource = `AI prediction ($${ppData.predicted_price.toFixed(2)} < $${currentPrice.toFixed(2)})`;
        } else {
          signal = "HOLD";
          signalSource = `AI prediction (equal price)`;
        }
      } else {
        // FREE tier: Cannot predict without pricePrediction API
        signal = "HOLD";
        signalSource = "FREE tier - upgrade to get BUY/SELL signals";
      }

      // Calculate confidence from market data
      const momentumScore = Math.min(40, Math.abs(priceChange24h) * 5);
      const volumeScore = volume24h > 0 ? Math.min(20, Math.log10(volume24h / 1e6) * 2) : 0;
      const capScore = marketCap > 0 ? Math.min(25, Math.log10(marketCap / 1e9) * 3) : 0;
      const confidence = Math.round(Math.max(55, Math.min(95, 50 + momentumScore + volumeScore + capScore)));

      // Calculate price targets - prefer API data, fallback to volatility calculation
      let targetPrice: number;
      let stopLoss: number;
      let predictionInfo = "";

      if (rsData && rsData.resistance && rsData.support) {
        // Use resistance/support from Token Metrics API
        targetPrice = signal === "BUY" ? rsData.resistance : rsData.support;
        stopLoss = signal === "BUY" ? rsData.support : rsData.resistance;
      } else {
        // Fallback to volatility-based calculation
        // If price change data is unavailable (free tier), use 2% default volatility
        const defaultVolatility = 0.02; // 2% default for free tier
        const volatility = priceChange24h !== 0 ? Math.abs(priceChange24h) / 100 : defaultVolatility;
        targetPrice = currentPrice * (signal === "BUY" ? 1 + volatility * 1.5 : 1 - volatility * 1.2);
        stopLoss = currentPrice * (signal === "BUY" ? 1 - volatility * 0.8 : 1 + volatility * 0.8);
      }

      // Add price prediction if available
      if (ppData && ppData.predicted_price) {
        predictionInfo = ` | Predicted: $${ppData.predicted_price >= 1 ? ppData.predicted_price.toFixed(2) : ppData.predicted_price.toFixed(6)}`;
      }

      // Build reasoning text
      let reasoning = `Token Metrics: ${token.token_name} @ $${currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(6)} | 24h: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}% | Vol: $${(volume24h / 1e6).toFixed(1)}M | MCap: $${(marketCap / 1e9).toFixed(2)}B${predictionInfo}`;

      // Add FREE tier warning if signal is HOLD
      if (signal === "HOLD" && (!ppData || !ppData.predicted_price)) {
        reasoning += ` | ⚠️ FREE tier: Upgrade to PAID tier for accurate BUY/SELL signals`;
      }

      return {
        symbol: tokenSymbol,
        signal: signal,
        entryPrice: currentPrice,
        targetPrice: targetPrice,
        stopLoss: stopLoss,
        confidence: confidence,
        timeframe: "24h",
        reasoning: reasoning,
      };
    });

    return signals;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`[Token Metrics] ❌ Error: ${errorMsg}`);
    throw new Error(`Token Metrics API error: ${errorMsg}`);
  }
}

export const getTradingSignalsAction: Action = {
  name: "GET_TRADING_SIGNALS",
  similes: [
    "TRADING_SIGNALS",
    "TRADE_SIGNALS",
    "BUY_SELL_SIGNALS",
    "ENTRY_EXIT_POINTS",
    "TOKEN_METRICS_SIGNALS",
    "GET_TOKEN_METRICS_SIGNALS",
    "TRADING_SIGNAL",
  ],
  description:
    "Get AI-powered trading signals with entry price, target price, stop-loss levels, and confidence scores from Token Metrics API. This action specifically uses Token Metrics service for trading signals. Use when user asks for trading signals, entry/exit points, or wants to know when to buy/sell a token. Also use when user mentions 'Token Metrics' with signals.",

  parameters: {
    tokens: {
      type: "string",
      description: "Comma-separated list of token symbols. Examples: 'BTC,ETH' or 'SOL'",
      required: true,
    },
  },

  // Remove strict validation to allow ElizaOS AI to select this action based on description/similes
  // Service availability will be checked in handler instead
  validate: async (_runtime: IAgentRuntime): Promise<boolean> => {
    return true; // Always available for selection
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      console.log("===== GET_TRADING_SIGNALS ACTION HANDLER CALLED =====");

      const composedState = await runtime.composeState(message, ["ACTION_STATE"], true);
      const actionParams = composedState?.data?.actionParams as Record<string, string | undefined> | undefined;

      const tokensRaw = actionParams?.tokens ? actionParams.tokens.trim() : undefined;

      if (!tokensRaw) {
        const errorMsg = "Missing required parameter 'tokens'.";
        logger.error(`[GET_TRADING_SIGNALS] ${errorMsg}`);
        return {
          text: errorMsg,
          success: false,
          error: "missing_required_parameter",
        };
      }

      const symbols = tokensRaw.split(",").map((s) => s.trim()).filter(Boolean);

      if (!symbols.length) {
        const errorMsg = "No valid token symbols found.";
        logger.error(`[GET_TRADING_SIGNALS] ${errorMsg}`);
        return {
          text: errorMsg,
          success: false,
          error: "invalid_parameter",
        };
      }

      logger.info(`[GET_TRADING_SIGNALS] Fetching signals for: ${symbols.join(", ")}`);

      // Call API directly without service
      const apiKey = runtime.getSetting("TOKENMETRICS_API_KEY") || "";
      console.log(`[GET_TRADING_SIGNALS] API Key: ${apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET'}`);

      const results: TradingSignal[] = await fetchTradingSignals(symbols, apiKey);

      const summaryLines = results.map((r) => {
        const emoji = r.signal === "BUY" ? "🟢" : r.signal === "SELL" ? "🔴" : "🟡";
        const priceDisplay = r.entryPrice >= 1
          ? `$${r.entryPrice.toFixed(2)}`
          : `$${r.entryPrice.toFixed(6)}`;
        const targetDisplay = r.targetPrice >= 1
          ? `$${r.targetPrice.toFixed(2)}`
          : `$${r.targetPrice.toFixed(6)}`;
        const stopDisplay = r.stopLoss >= 1
          ? `$${r.stopLoss.toFixed(2)}`
          : `$${r.stopLoss.toFixed(6)}`;

        return `${emoji} ${r.symbol}: ${r.signal}\n   Price: ${priceDisplay} | Target: ${targetDisplay} | Stop: ${stopDisplay}\n   Confidence: ${r.confidence}% | ${r.reasoning}`;
      });

      const text = [
        `Token Metrics Analysis - ${results.length} token(s):`,
        "",
        ...summaryLines,
      ].join("\n");

      if (callback) {
        await callback({
          text,
          actions: ["GET_TRADING_SIGNALS"],
          content: {
            results,
            summary: summaryLines,
          },
          source: message.content.source,
        });
      }

      return {
        text,
        success: true,
        data: results,
        values: {
          results,
          summary: summaryLines,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[GET_TRADING_SIGNALS] Action failed: ${msg}`);

      // Detect rate limit errors
      const isRateLimit =
        msg.toLowerCase().includes('rate limit') ||
        msg.toLowerCase().includes('429') ||
        msg.toLowerCase().includes('too many requests') ||
        msg.toLowerCase().includes('quota exceeded');

      // Detect authentication/API key errors
      const isAuthError =
        msg.toLowerCase().includes('401') ||
        msg.toLowerCase().includes('403') ||
        msg.toLowerCase().includes('unauthorized') ||
        msg.toLowerCase().includes('api key') ||
        msg.toLowerCase().includes('authentication');

      let userFriendlyMessage = `Failed to fetch trading signals: ${msg}`;
      let errorType = "action_failed";

      if (isRateLimit) {
        userFriendlyMessage = `🚨 RATE LIMIT: Token Metrics API has hit its rate limit. Please wait a few minutes or upgrade your Token Metrics plan. Error: ${msg}`;
        errorType = "rate_limit";
      } else if (isAuthError) {
        userFriendlyMessage = `🔑 AUTH ERROR: Token Metrics API key is invalid or unauthorized. Please check your TOKENMETRICS_API_KEY in .env file. Error: ${msg}`;
        errorType = "auth_error";
      } else if (msg.toLowerCase().includes('free tier') || msg.toLowerCase().includes('upgrade')) {
        userFriendlyMessage = `⚠️ FREE TIER LIMIT: This feature requires a paid Token Metrics plan. Your current plan doesn't support trading signals. Error: ${msg}`;
        errorType = "tier_limit";
      }

      const errorResult: ActionResult = {
        text: userFriendlyMessage,
        success: false,
        error: msg,
        data: {
          errorType,
          isRateLimit,
          isAuthError,
          originalError: msg,
        },
      };

      if (callback) {
        await callback({
          text: errorResult.text,
          content: {
            error: errorType,
            details: msg,
            isRateLimit,
            isAuthError,
            userMessage: userFriendlyMessage,
          },
        });
      }
      return errorResult;
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Get trading signals for SOL" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Trading Signals for 1 token(s):\n🟢 SOL: BUY | Entry: $95.50 | Target: $110.00 | Stop: $88.00 | Confidence: 78%",
          actions: ["GET_TRADING_SIGNALS"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Show me trading signals for BTC and ETH from Token Metrics" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Trading Signals for 2 token(s):\n🟢 BTC: BUY | Entry: $45,000 | Target: $50,000 | Stop: $43,000 | Confidence: 85%\n🟡 ETH: HOLD | Entry: $3,200 | Target: $3,500 | Stop: $3,000 | Confidence: 65%",
          actions: ["GET_TRADING_SIGNALS"],
        },
      },
    ],
  ],
};
