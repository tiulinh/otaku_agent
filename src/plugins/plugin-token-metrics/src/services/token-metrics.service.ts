import { Service, IAgentRuntime, ServiceType, logger } from "@elizaos/core";

export interface TokenAnalysis {
  symbol: string;
  rating: number; // 1-100
  riskScore: number; // 1-100
  aiScore: number;
  marketCap: number;
  volume24h: number;
  sentiment: string;
  recommendation: "BUY" | "SELL" | "HOLD";
}

export interface TradingSignal {
  symbol: string;
  signal: "BUY" | "SELL";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number; // 0-100
  timeframe: string;
  reasoning: string;
}

export interface PortfolioRecommendation {
  allocations: Array<{
    symbol: string;
    percentage: number;
    reasoning: string;
  }>;
  totalScore: number;
  riskLevel: string;
}

export class TokenMetricsService extends Service {
  static serviceType: ServiceType = "token-metrics" as ServiceType;

  private apiKey: string;
  private baseUrl = "https://api.tokenmetrics.com/v2";

  async initialize(runtime: IAgentRuntime): Promise<void> {
    this.apiKey = runtime.getSetting("TOKENMETRICS_API_KEY") || "";

    if (!this.apiKey) {
      logger.warn("[TokenMetrics] API key not configured");
    } else {
      logger.info("[TokenMetrics] Service initialized");
    }
  }

  private async fetchAPI<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error("TokenMetrics API key not configured");
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TokenMetrics API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get AI-powered token analysis and ratings
   */
  async getTokenAnalysis(symbols: string[]): Promise<TokenAnalysis[]> {
    try {
      logger.info(`[TokenMetrics] Fetching analysis for: ${symbols.join(", ")}`);

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const data = await this.fetchAPI<any>("/token-metrics", {
              symbol: symbol.toUpperCase(),
            });

            return {
              symbol: symbol.toUpperCase(),
              rating: data.rating || 50,
              riskScore: data.risk_score || 50,
              aiScore: data.ai_score || 50,
              marketCap: data.market_cap || 0,
              volume24h: data.volume_24h || 0,
              sentiment: data.sentiment || "NEUTRAL",
              recommendation: data.recommendation || "HOLD",
            } as TokenAnalysis;
          } catch (error) {
            logger.error(`[TokenMetrics] Error fetching ${symbol}:`, error);
            throw error;
          }
        })
      );

      return results;
    } catch (error) {
      logger.error("[TokenMetrics] getTokenAnalysis failed:", error);
      throw error;
    }
  }

  /**
   * Get trading signals with entry/exit points
   */
  async getTradingSignals(symbols: string[]): Promise<TradingSignal[]> {
    try {
      logger.info(`[TokenMetrics] Fetching trading signals for: ${symbols.join(", ")}`);

      const results = await Promise.all(
        symbols.map(async (symbol) => {
          const data = await this.fetchAPI<any>("/trading-signals", {
            symbol: symbol.toUpperCase(),
          });

          return {
            symbol: symbol.toUpperCase(),
            signal: data.signal || "HOLD",
            entryPrice: data.entry_price || 0,
            targetPrice: data.target_price || 0,
            stopLoss: data.stop_loss || 0,
            confidence: data.confidence || 50,
            timeframe: data.timeframe || "1d",
            reasoning: data.reasoning || "No signal available",
          } as TradingSignal;
        })
      );

      return results;
    } catch (error) {
      logger.error("[TokenMetrics] getTradingSignals failed:", error);
      throw error;
    }
  }

  /**
   * Get AI-recommended portfolio allocations
   */
  async getPortfolioRecommendations(riskTolerance: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"): Promise<PortfolioRecommendation> {
    try {
      logger.info(`[TokenMetrics] Fetching portfolio recommendations (risk: ${riskTolerance})`);

      const data = await this.fetchAPI<any>("/portfolio-recommendations", {
        risk_tolerance: riskTolerance,
      });

      return {
        allocations: data.allocations || [],
        totalScore: data.total_score || 0,
        riskLevel: data.risk_level || "MEDIUM",
      };
    } catch (error) {
      logger.error("[TokenMetrics] getPortfolioRecommendations failed:", error);
      throw error;
    }
  }
}
