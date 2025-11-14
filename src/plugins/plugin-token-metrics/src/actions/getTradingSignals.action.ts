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
    console.log(`[Token Metrics] Fetching data for: ${symbols.join(", ")}`);

    // Get token data (includes price, market cap, volume, etc.)
    const tokensResult = await client.tokens.get({ symbol: symbols.join(",") });

    if (!tokensResult.success || !tokensResult.data || tokensResult.data.length === 0) {
      throw new Error("No data returned from Token Metrics API");
    }

    console.log(`[Token Metrics] ✅ Retrieved ${tokensResult.data.length} tokens`);

    // Filter to get the most relevant token for each requested symbol
    // Token Metrics returns multiple tokens with same symbol (e.g., "BTC" returns 10+ tokens)
    // We want the main token (highest market cap or well-known slug)
    const symbolToTokenIdMap: Record<string, number> = {
      'BTC': 3375,      // Bitcoin
      'BITCOIN': 3375,
      'ETH': 1027,      // Ethereum
      'ETHEREUM': 1027,
      'SOL': 5426,      // Solana
      'SOLANA': 5426,
      'MATIC': 3890,    // Polygon
      'POLYGON': 3890,
      'POL': 3890,
      'AVAX': 5805,     // Avalanche
      'AVALANCHE': 5805,
    };

    const filteredTokens: any[] = [];
    for (const requestedSymbol of symbols) {
      const upperSymbol = requestedSymbol.toUpperCase();
      const knownTokenId = symbolToTokenIdMap[upperSymbol];

      // Find matching token - prefer known token_id, fallback to highest market cap
      const matchingTokens = tokensResult.data.filter((t: any) =>
        t.token_symbol.toUpperCase() === upperSymbol
      );

      let bestToken;
      if (knownTokenId) {
        // Use known token ID if available
        bestToken = matchingTokens.find((t: any) => t.token_id === knownTokenId);
      }

      if (!bestToken && matchingTokens.length > 0) {
        // Fallback: pick token with highest market cap
        bestToken = matchingTokens.reduce((best: any, current: any) => {
          const bestMcap = best.market_cap || 0;
          const currentMcap = current.market_cap || 0;
          return currentMcap > bestMcap ? current : best;
        });
      }

      if (bestToken) {
        console.log(`[Token Metrics] Selected ${bestToken.token_name} (${bestToken.token_symbol}, ID: ${bestToken.token_id}) for symbol ${requestedSymbol}`);
        filteredTokens.push(bestToken);
      } else {
        console.log(`[Token Metrics] ⚠️ No token found for symbol ${requestedSymbol}`);
      }
    }

    if (filteredTokens.length === 0) {
      throw new Error("No matching tokens found for requested symbols");
    }

    // Get price data for more accuracy
    const priceResult = await client.price.get({ symbol: symbols.join(",") });
    const priceMap = new Map();
    if (priceResult.success && priceResult.data) {
      // Build map of latest prices per token_id
      priceResult.data.forEach((p: any) => {
        const existingPrice = priceMap.get(p.token_id);
        // Keep the most recent non-null price
        if (!existingPrice || (p.current_price && !existingPrice)) {
          priceMap.set(p.token_id, p.current_price);
        }
      });
    }

    // Try to get resistance/support levels and price predictions (may require paid tier)
    const resistanceSupportMap = new Map();
    const pricePredictionMap = new Map();

    for (const symbol of symbols) {
      try {
        console.log(`[Token Metrics] Fetching resistanceSupport for ${symbol}...`);
        const rsResult = await client.resistanceSupport.get({ symbol });
        if (rsResult.success && rsResult.data && rsResult.data.length > 0) {
          resistanceSupportMap.set(symbol.toUpperCase(), rsResult.data[0]);
          console.log(`[Token Metrics] ✅ resistanceSupport for ${symbol}: Support=${rsResult.data[0].support}, Resistance=${rsResult.data[0].resistance}`);
        }
      } catch (err) {
        console.log(`[Token Metrics] ⚠️ resistanceSupport for ${symbol} unavailable (${err instanceof Error ? err.message : String(err)})`);
      }

      try {
        console.log(`[Token Metrics] Fetching pricePrediction for ${symbol}...`);
        const ppResult = await client.pricePrediction.get({ symbol });
        if (ppResult.success && ppResult.data && ppResult.data.length > 0) {
          pricePredictionMap.set(symbol.toUpperCase(), ppResult.data[0]);
          console.log(`[Token Metrics] ✅ pricePrediction for ${symbol}: ${ppResult.data[0].predicted_price}`);
        }
      } catch (err) {
        console.log(`[Token Metrics] ⚠️ pricePrediction for ${symbol} unavailable (${err instanceof Error ? err.message : String(err)})`);
      }
    }

    // Generate signals from Token Metrics data (using filtered tokens)
    const signals: TradingSignal[] = filteredTokens.map((token: any) => {
      const currentPrice = priceMap.get(token.token_id) || token.current_price || 0;
      const priceChange24h = token.price_change_percentage_24h_in_currency || 0;
      const marketCap = token.market_cap || 0;
      const volume24h = token.total_volume || 0;

      // Generate signal based on price momentum
      const signal: "BUY" | "SELL" = priceChange24h >= 0 ? "BUY" : "SELL";

      // Calculate confidence from market data
      const momentumScore = Math.min(40, Math.abs(priceChange24h) * 5);
      const volumeScore = volume24h > 0 ? Math.min(20, Math.log10(volume24h / 1e6) * 2) : 0;
      const capScore = marketCap > 0 ? Math.min(25, Math.log10(marketCap / 1e9) * 3) : 0;
      const confidence = Math.round(Math.max(55, Math.min(95, 50 + momentumScore + volumeScore + capScore)));

      // Get resistance/support levels if available
      const rsData = resistanceSupportMap.get(token.token_symbol.toUpperCase());
      const ppData = pricePredictionMap.get(token.token_symbol.toUpperCase());

      // Calculate price targets - prefer API data, fallback to volatility calculation
      let targetPrice: number;
      let stopLoss: number;
      let predictionInfo = "";

      if (rsData && rsData.resistance && rsData.support) {
        // Use resistance/support from Token Metrics API
        targetPrice = signal === "BUY" ? rsData.resistance : rsData.support;
        stopLoss = signal === "BUY" ? rsData.support : rsData.resistance;
        console.log(`[Token Metrics] Using resistanceSupport for ${token.token_symbol}: Target=$${targetPrice}, Stop=$${stopLoss}`);
      } else {
        // Fallback to volatility-based calculation
        const volatility = Math.abs(priceChange24h) / 100;
        targetPrice = currentPrice * (signal === "BUY" ? 1 + volatility * 1.5 : 1 - volatility * 1.2);
        stopLoss = currentPrice * (signal === "BUY" ? 1 - volatility * 0.8 : 1 + volatility * 0.8);
        console.log(`[Token Metrics] Using volatility-based calculation for ${token.token_symbol}`);
      }

      // Add price prediction if available
      if (ppData && ppData.predicted_price) {
        predictionInfo = ` | Predicted: $${ppData.predicted_price >= 1 ? ppData.predicted_price.toFixed(2) : ppData.predicted_price.toFixed(6)}`;
      }

      console.log(`[Token Metrics] ${token.token_symbol}: ${signal} at $${currentPrice.toFixed(2)} (${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%)`);

      return {
        symbol: token.token_symbol.toUpperCase(),
        signal: signal,
        entryPrice: currentPrice,
        targetPrice: targetPrice,
        stopLoss: stopLoss,
        confidence: confidence,
        timeframe: "24h",
        reasoning: `Token Metrics: ${token.token_name} @ $${currentPrice >= 1 ? currentPrice.toFixed(2) : currentPrice.toFixed(6)} | 24h: ${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}% | Vol: $${(volume24h / 1e6).toFixed(1)}M | MCap: $${(marketCap / 1e9).toFixed(2)}B${predictionInfo}`,
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

      const errorResult: ActionResult = {
        text: `Failed to fetch trading signals: ${msg}`,
        success: false,
        error: msg,
      };

      if (callback) {
        await callback({
          text: errorResult.text,
          content: { error: "action_failed", details: msg },
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
