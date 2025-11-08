import type { Plugin } from "@elizaos/core";
import { TokenMetricsService } from "./services/token-metrics.service";
import { getTokenAnalysisAction } from "./actions/getTokenAnalysis.action";
import { getTradingSignalsAction } from "./actions/getTradingSignals.action";
import { getPortfolioRecommendationsAction } from "./actions/getPortfolioRecommendations.action";
import { executeAutoTradeAction } from "./actions/executeAutoTrade.action";

export const tokenMetricsPlugin: Plugin = {
  name: "plugin-token-metrics",
  description: "Token Metrics AI-powered crypto analysis, trading signals, portfolio recommendations, and auto-trading capabilities",
  actions: [
    getTokenAnalysisAction,
    getTradingSignalsAction,
    getPortfolioRecommendationsAction,
    executeAutoTradeAction,
  ],
  services: [TokenMetricsService],
  evaluators: [],
  providers: [],
};

export default tokenMetricsPlugin;

export {
  TokenMetricsService,
  getTokenAnalysisAction,
  getTradingSignalsAction,
  getPortfolioRecommendationsAction,
  executeAutoTradeAction,
};
