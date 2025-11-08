import {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  logger,
} from "@elizaos/core";
import { TokenMetricsService, PortfolioRecommendation } from "../services/token-metrics.service";

export const getPortfolioRecommendationsAction: Action = {
  name: "GET_PORTFOLIO_RECOMMENDATIONS",
  similes: [
    "PORTFOLIO_RECOMMENDATIONS",
    "PORTFOLIO_ALLOCATION",
    "INVESTMENT_PORTFOLIO",
    "PORTFOLIO_SUGGESTIONS",
  ],
  description:
    "Get AI-recommended portfolio allocations based on risk tolerance from Token Metrics. Provides optimal asset allocation percentages and reasoning. Use when user asks for portfolio recommendations, asset allocation advice, or wants to build/rebalance their portfolio.",

  parameters: {
    risk_tolerance: {
      type: "string",
      description: "Risk tolerance level: 'LOW', 'MEDIUM', or 'HIGH'. Defaults to 'MEDIUM' if not specified.",
      required: false,
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

      const riskToleranceRaw = actionParams?.risk_tolerance?.toUpperCase() || "MEDIUM";
      const riskTolerance = ["LOW", "MEDIUM", "HIGH"].includes(riskToleranceRaw)
        ? (riskToleranceRaw as "LOW" | "MEDIUM" | "HIGH")
        : "MEDIUM";

      logger.info(`[GET_PORTFOLIO_RECOMMENDATIONS] Fetching portfolio (risk: ${riskTolerance})`);

      const result: PortfolioRecommendation = await svc.getPortfolioRecommendations(riskTolerance);

      const allocationLines = result.allocations.map((a) => {
        return `  ${a.symbol}: ${a.percentage.toFixed(1)}% - ${a.reasoning}`;
      });

      const text = [
        `Token Metrics Portfolio Recommendations (Risk: ${result.riskLevel}):`,
        `Total Score: ${result.totalScore.toFixed(0)}/100`,
        "",
        "Recommended Allocations:",
        ...allocationLines,
      ].join("\n");

      if (callback) {
        await callback({
          text,
          actions: ["GET_PORTFOLIO_RECOMMENDATIONS"],
          content: {
            result,
            allocations: result.allocations,
          },
          source: message.content.source,
        });
      }

      return {
        text,
        success: true,
        data: result,
        values: {
          result,
          allocations: result.allocations,
          totalScore: result.totalScore,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[GET_PORTFOLIO_RECOMMENDATIONS] Action failed: ${msg}`);

      const errorResult: ActionResult = {
        text: `Failed to fetch portfolio recommendations: ${msg}`,
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
        content: { text: "Give me portfolio recommendations with medium risk" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Portfolio Recommendations:\n  BTC: 40% - Strong fundamentals\n  ETH: 30% - Ecosystem growth\n  SOL: 20% - High potential\n  USDC: 10% - Stability",
          actions: ["GET_PORTFOLIO_RECOMMENDATIONS"],
        },
      },
    ],
  ],
};
