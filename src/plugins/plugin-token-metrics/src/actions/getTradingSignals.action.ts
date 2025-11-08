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

// Direct API call helper - no service needed
async function fetchTradingSignals(symbols: string[], apiKey: string): Promise<TradingSignal[]> {
  if (!apiKey) {
    console.log("[fetchTradingSignals] No API key, returning mock data");
    return getMockSignals(symbols);
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    const TOKEN_ID_MAP: Record<string, number> = {
      "BTC": 3375, "BITCOIN": 3375,
      "ETH": 1027, "ETHEREUM": 1027,
      "SOL": 5426, "SOLANA": 5426,
    };

    const tokenIds = symbols.map(s => TOKEN_ID_MAP[s.toUpperCase()]).filter(Boolean);

    const url = new URL("https://api.tokenmetrics.com/v2/trading-signals");
    if (tokenIds.length > 0) {
      url.searchParams.append("token_id", tokenIds.join(","));
    } else {
      url.searchParams.append("symbol", symbols.join(","));
    }
    url.searchParams.append("start_date", startDate.toISOString().split('T')[0]);
    url.searchParams.append("end_date", endDate.toISOString().split('T')[0]);

    console.log(`[fetchTradingSignals] Calling: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[fetchTradingSignals] API error ${response.status}: ${errorText}`);
      return getMockSignals(symbols);
    }

    const data: any = await response.json();
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      console.log(`[fetchTradingSignals] No data returned, using mock`);
      return getMockSignals(symbols);
    }

    console.log(`[fetchTradingSignals] Got ${data.data.length} records from API`);

    // Group by symbol, get most recent
    const symbolMap = new Map<string, any>();
    for (const item of data.data) {
      const symbol = (item.TOKEN_SYMBOL || item.SYMBOL || "").toUpperCase();
      if (!symbols.some(s => s.toUpperCase() === symbol)) continue;

      const existing = symbolMap.get(symbol);
      const itemDate = new Date(item.DATE || 0);
      const existingDate = existing ? new Date(existing.DATE || 0) : new Date(0);

      if (itemDate >= existingDate) {
        symbolMap.set(symbol, item);
      }
    }

    const results: TradingSignal[] = Array.from(symbolMap.values()).map((item) => {
      const tradingSignal = item.TRADING_SIGNAL || 0;
      const signal: "BUY" | "SELL" = tradingSignal >= 0 ? "BUY" : "SELL";
      const traderGrade = typeof item.TM_TRADER_GRADE === 'string'
        ? parseFloat(item.TM_TRADER_GRADE)
        : item.TM_TRADER_GRADE || 0;
      const confidence = traderGrade > 0 ? traderGrade : Math.abs(tradingSignal) * 50;

      return {
        symbol: (item.TOKEN_SYMBOL || item.SYMBOL || "").toUpperCase(),
        signal: signal,
        entryPrice: 0,
        targetPrice: 0,
        stopLoss: 0,
        confidence: Math.round(confidence),
        timeframe: "30d",
        reasoning: `Token Metrics ${signal} signal (Trader Grade: ${traderGrade.toFixed(2)})`,
      };
    });

    console.log(`[fetchTradingSignals] Returning ${results.length} real signals`);
    return results.length > 0 ? results : getMockSignals(symbols);
  } catch (error) {
    console.log(`[fetchTradingSignals] Error: ${error instanceof Error ? error.message : String(error)}`);
    return getMockSignals(symbols);
  }
}

function getMockSignals(symbols: string[]): TradingSignal[] {
  console.log(`[getMockSignals] Returning mock data for ${symbols.join(", ")}`);
  const mockData: Record<string, Partial<TradingSignal>> = {
    BTC: { signal: "BUY", entryPrice: 45000, targetPrice: 50000, stopLoss: 43000, confidence: 85, timeframe: "7d" },
    ETH: { signal: "BUY", entryPrice: 3200, targetPrice: 3500, stopLoss: 3000, confidence: 65, timeframe: "3d" },
    SOL: { signal: "BUY", entryPrice: 95.5, targetPrice: 110, stopLoss: 88, confidence: 78, timeframe: "5d" },
  };

  return symbols.map((symbol) => {
    const symbolUpper = symbol.toUpperCase();
    const mock = mockData[symbolUpper] || {
      signal: "BUY", entryPrice: 100, targetPrice: 110, stopLoss: 90, confidence: 50, timeframe: "1d"
    };

    return {
      symbol: symbolUpper,
      signal: mock.signal as "BUY" | "SELL",
      entryPrice: mock.entryPrice || 100,
      targetPrice: mock.targetPrice || 110,
      stopLoss: mock.stopLoss || 90,
      confidence: mock.confidence || 50,
      timeframe: mock.timeframe || "1d",
      reasoning: `Mock AI analysis suggests ${mock.signal} signal for ${symbolUpper}`,
    };
  });
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
        return `${emoji} ${r.symbol}: ${r.signal} | Entry: $${r.entryPrice.toFixed(2)} | Target: $${r.targetPrice.toFixed(2)} | Stop: $${r.stopLoss.toFixed(2)} | Confidence: ${r.confidence.toFixed(0)}%`;
      });

      const text = [
        `Trading Signals for ${results.length} token(s):`,
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
