import {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  logger,
} from "@elizaos/core";
import { TokenMetricsService, TokenAnalysis } from "../services/token-metrics.service";

export const getTokenAnalysisAction: Action = {
  name: "GET_TOKEN_ANALYSIS",
  similes: [
    "TOKEN_ANALYSIS",
    "ANALYZE_TOKEN",
    "TOKEN_RATING",
    "TOKEN_SCORE",
    "AI_RATING",
    "TOKEN_METRICS",
    "TOKEN_METRICS_ANALYSIS",
    "ANALYZE_USING_TOKEN_METRICS",
    "GET_TOKEN_METRICS",
    "TOKEN_METRICS_AI",
  ],
  description:
    "Get AI-powered token analysis, ratings, and recommendations from Token Metrics API. This action specifically uses Token Metrics service (not CoinGecko or other sources). Provides comprehensive analysis including rating (1-100), risk score, AI score, market data, sentiment, and buy/sell/hold recommendation. ALWAYS use this action when user explicitly mentions 'Token Metrics' or asks to 'analyze using Token Metrics'. Also use for general token analysis requests, token ratings, or AI-powered investment insights.",

  parameters: {
    tokens: {
      type: "string",
      description: "Comma-separated list of token symbols to analyze. Examples: 'BTC,ETH' or 'bitcoin,ethereum'",
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
      console.log("===== TOKEN METRICS ACTION HANDLER STARTED =====");
      console.log(`Service type needed: ${TokenMetricsService.serviceType}`);
      logger.info(`[GET_TOKEN_ANALYSIS] Attempting to get service with type: ${TokenMetricsService.serviceType}`);

      const svc = runtime.getService(TokenMetricsService.serviceType) as TokenMetricsService | undefined;

      if (!svc) {
        const availableServices = Array.from((runtime as any).services?.keys() || []);
        console.log("===== SERVICE NOT FOUND =====");
        console.log(`Requested service type: ${TokenMetricsService.serviceType}`);
        console.log(`Available services: ${JSON.stringify(availableServices)}`);
        logger.error(`[GET_TOKEN_ANALYSIS] Service not found. Available services: ${JSON.stringify(availableServices)}`);
        throw new Error(`TokenMetricsService not available. Service type requested: ${TokenMetricsService.serviceType}`);
      }

      console.log("===== SERVICE FOUND SUCCESSFULLY =====");
      logger.info(`[GET_TOKEN_ANALYSIS] Service found successfully`);


      const composedState = await runtime.composeState(message, ["ACTION_STATE"], true);
      const actionParams = composedState?.data?.actionParams as Record<string, string | undefined> | undefined;

      let tokensRaw = actionParams?.tokens ? actionParams.tokens.trim() : undefined;

      // If no tokens in actionParams, try to extract from message content
      if (!tokensRaw) {
        const messageText = message.content.text || "";
        // Look for common token symbols in the message
        const commonTokens = ["BTC", "ETH", "SOL", "MATIC", "AVAX", "USDC", "USDT"];
        const foundTokens = commonTokens.filter(token =>
          new RegExp(`\\b${token}\\b`, "i").test(messageText)
        );

        if (foundTokens.length > 0) {
          tokensRaw = foundTokens.join(",");
          logger.info(`[GET_TOKEN_ANALYSIS] Extracted tokens from message: ${tokensRaw}`);
        }
      }

      if (!tokensRaw) {
        const errorMsg = "Missing required parameter 'tokens'. Please specify which tokens to analyze (e.g., 'BTC', 'ETH').";
        logger.error(`[GET_TOKEN_ANALYSIS] ${errorMsg}`);
        const errorResult: ActionResult = {
          text: errorMsg,
          success: false,
          error: "missing_required_parameter",
        };
        if (callback) {
          await callback({
            text: errorResult.text,
            content: { error: "missing_required_parameter", details: errorMsg },
          });
        }
        return errorResult;
      }

      const symbols = tokensRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (!symbols.length) {
        const errorMsg = "No valid token symbols found.";
        logger.error(`[GET_TOKEN_ANALYSIS] ${errorMsg}`);
        const errorResult: ActionResult = {
          text: errorMsg,
          success: false,
          error: "invalid_parameter",
        };
        if (callback) {
          await callback({
            text: errorResult.text,
            content: { error: "invalid_parameter", details: errorMsg },
          });
        }
        return errorResult;
      }

      logger.info(`[GET_TOKEN_ANALYSIS] Analyzing: ${symbols.join(", ")}`);

      const results: TokenAnalysis[] = await svc.getTokenAnalysis(symbols);

      const summaryLines = results.map((r) => {
        const rating = r.rating.toFixed(0);
        const risk = r.riskScore.toFixed(0);
        return `${r.symbol}: Rating ${rating}/100 | Risk ${risk}/100 | ${r.recommendation} | Sentiment: ${r.sentiment}`;
      });

      const text = [
        `Token Metrics Analysis for ${results.length} token(s):`,
        ...summaryLines,
      ].join("\n");

      if (callback) {
        await callback({
          text,
          actions: ["GET_TOKEN_ANALYSIS"],
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
      logger.error(`[GET_TOKEN_ANALYSIS] Action failed: ${msg}`);

      const errorResult: ActionResult = {
        text: `Failed to fetch token analysis: ${msg}`,
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
        content: { text: "Analyze BTC using Token Metrics" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Token Metrics Analysis for 1 token(s):\nBTC: Rating 85/100 | Risk 35/100 | BUY | Sentiment: BULLISH",
          actions: ["GET_TOKEN_ANALYSIS"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Get Token Metrics analysis for ETH and SOL" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Token Metrics Analysis for 2 token(s):\nETH: Rating 78/100 | Risk 42/100 | HOLD | Sentiment: NEUTRAL\nSOL: Rating 82/100 | Risk 38/100 | BUY | Sentiment: BULLISH",
          actions: ["GET_TOKEN_ANALYSIS"],
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: { text: "Analyze bitcoin with Token Metrics AI" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Token Metrics Analysis for 1 token(s):\nBTC: Rating 85/100 | Risk 35/100 | BUY | Sentiment: BULLISH",
          actions: ["GET_TOKEN_ANALYSIS"],
        },
      },
    ],
  ],
};
