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
  ],
  description:
    "Get AI-powered token analysis, ratings, and recommendations from Token Metrics. Provides comprehensive analysis including rating (1-100), risk score, AI score, market data, sentiment, and buy/sell/hold recommendation. Use when user asks to analyze a token, get token rating, or wants AI-powered investment insights.",

  parameters: {
    tokens: {
      type: "string",
      description: "Comma-separated list of token symbols to analyze. Examples: 'BTC,ETH' or 'bitcoin,ethereum'",
      required: true,
    },
  },

  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const svc = runtime.getService(TokenMetricsService.serviceType) as TokenMetricsService | undefined;
    if (!svc) {
      logger.error("TokenMetricsService not available");
      return false;
    }
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const svc = runtime.getService(TokenMetricsService.serviceType) as TokenMetricsService | undefined;
      if (!svc) {
        throw new Error("TokenMetricsService not available");
      }

      const composedState = await runtime.composeState(message, ["ACTION_STATE"], true);
      const actionParams = composedState?.data?.actionParams as Record<string, string | undefined> | undefined;

      const tokensRaw = actionParams?.tokens ? actionParams.tokens.trim() : undefined;

      if (!tokensRaw) {
        const errorMsg = "Missing required parameter 'tokens'. Please specify which tokens to analyze (e.g., 'BTC,ETH').";
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
        content: { text: "Analyze BTC and ETH using Token Metrics" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Token Metrics Analysis:\nBTC: Rating 85/100 | Risk 35/100 | BUY\nETH: Rating 78/100 | Risk 42/100 | HOLD",
          actions: ["GET_TOKEN_ANALYSIS"],
        },
      },
    ],
  ],
};
