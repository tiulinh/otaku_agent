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
  static serviceType = "TOKEN_METRICS" as const;
  capabilityDescription = "AI-powered token analysis, trading signals, portfolio recommendations, and auto-trading capabilities from Token Metrics API";

  private apiKey!: string;
  private baseUrl = "https://api.tokenmetrics.com/v2";

  static async start(runtime: IAgentRuntime): Promise<TokenMetricsService> {
    const service = new TokenMetricsService();
    await service.initialize(runtime);
    return service;
  }

  async initialize(runtime: IAgentRuntime): Promise<void> {
    console.log("===== TOKEN METRICS SERVICE INITIALIZE CALLED =====");
    console.log(`Service type: ${TokenMetricsService.serviceType}`);

    this.apiKey = runtime.getSetting("TOKENMETRICS_API_KEY") || "";

    if (!this.apiKey) {
      console.log("[TokenMetrics] WARNING: API key not configured");
      logger.warn("[TokenMetrics] API key not configured");
    } else {
      console.log("[TokenMetrics] Service initialized successfully with API key");
      logger.info("[TokenMetrics] Service initialized");
    }
  }

  async stop(): Promise<void> {
    logger.info("[TokenMetrics] Service stopped");
  }

  private async fetchAPI<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error("TokenMetrics API key not configured");
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    logger.info(`[TokenMetrics] Calling API: ${url.toString()}`);

    // Try different authentication methods common in APIs
    const authConfigs: Array<{ name: string; headers: Record<string, string> }> = [
      { name: "api-key", headers: { "api-key": this.apiKey, "Content-Type": "application/json" } },
      { name: "x-api-key", headers: { "x-api-key": this.apiKey, "Content-Type": "application/json" } },
      { name: "Authorization", headers: { "Authorization": `Bearer ${this.apiKey}`, "Content-Type": "application/json" } },
    ];

    let lastError: Error | null = null;

    for (const config of authConfigs) {
      try {
        const response = await fetch(url.toString(), {
          headers: config.headers,
        });

        if (response.ok) {
          const data = await response.json();
          logger.info(`[TokenMetrics] API call successful with header: ${config.name}`);
          return data as T;
        }

        const errorText = await response.text();
        logger.warn(`[TokenMetrics] Auth failed with ${config.name}: ${response.status} - ${errorText}`);
        lastError = new Error(`${response.status}: ${errorText}`);
      } catch (error) {
        logger.warn(`[TokenMetrics] Request failed with ${config.name}:`, String(error));
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(`TokenMetrics API error after trying all auth methods: ${lastError?.message}`);
  }

  /**
   * Get AI-powered token analysis and ratings
   * TODO: Update endpoint when Token Metrics provides actual API documentation
   */
  async getTokenAnalysis(symbols: string[]): Promise<TokenAnalysis[]> {
    try {
      logger.info(`[TokenMetrics] Fetching analysis for: ${symbols.join(", ")}`);

      // TEMPORARY: Return mock data until we have real Token Metrics API endpoint
      // The actual endpoint should be determined from Token Metrics API docs
      logger.warn("[TokenMetrics] Using mock data - real API endpoint not yet configured");

      const results: TokenAnalysis[] = symbols.map((symbol) => {
        const symbolUpper = symbol.toUpperCase();

        // Mock data based on symbol
        const mockData: Record<string, Partial<TokenAnalysis>> = {
          BTC: { rating: 85, riskScore: 35, aiScore: 88, sentiment: "BULLISH", recommendation: "BUY" },
          ETH: { rating: 78, riskScore: 42, aiScore: 80, sentiment: "NEUTRAL", recommendation: "HOLD" },
          SOL: { rating: 82, riskScore: 38, aiScore: 85, sentiment: "BULLISH", recommendation: "BUY" },
        };

        const mock = mockData[symbolUpper] || {
          rating: 65, riskScore: 50, aiScore: 65, sentiment: "NEUTRAL", recommendation: "HOLD"
        };

        return {
          symbol: symbolUpper,
          rating: mock.rating || 65,
          riskScore: mock.riskScore || 50,
          aiScore: mock.aiScore || 65,
          marketCap: 0,
          volume24h: 0,
          sentiment: mock.sentiment || "NEUTRAL",
          recommendation: mock.recommendation || "HOLD",
        } as TokenAnalysis;
      });

      logger.info(`[TokenMetrics] Returning ${results.length} mock analyses`);
      return results;

      /* REAL API CALL (commented out until endpoint is known):
      const results = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const data = await this.fetchAPI<any>("/api/v1/token-analysis", {
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
      */
    } catch (error) {
      logger.error("[TokenMetrics] getTokenAnalysis failed:", String(error));
      throw error;
    }
  }

  /**
   * Get trading signals with entry/exit points
   * Real Token Metrics API endpoint: /trading-signals
   */
  async getTradingSignals(symbols: string[]): Promise<TradingSignal[]> {
    try {
      logger.info(`[TokenMetrics] Fetching trading signals for: ${symbols.join(", ")}`);

      // Call real Token Metrics API
      interface TMTradingSignalResponse {
        data?: Array<{
          token_symbol?: string;
          signal?: string;
          entry_price?: number;
          target_price?: number;
          stop_loss?: number;
          confidence?: number;
          timeframe?: string;
          reasoning?: string;
          // Alternative field names
          symbol?: string;
          type?: string;
          price?: number;
        }>;
      }

      const response = await this.fetchAPI<TMTradingSignalResponse>("/trading-signals", {
        symbols: symbols.join(","),
      });

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn("[TokenMetrics] API returned unexpected format, using mock data");
        return this.getMockTradingSignals(symbols);
      }

      const results: TradingSignal[] = response.data
        .filter(item => symbols.some(s =>
          (item.token_symbol || item.symbol || "").toUpperCase() === s.toUpperCase()
        ))
        .map((item) => ({
          symbol: (item.token_symbol || item.symbol || "").toUpperCase(),
          signal: (item.signal || item.type || "BUY").toUpperCase() as "BUY" | "SELL",
          entryPrice: item.entry_price || item.price || 0,
          targetPrice: item.target_price || 0,
          stopLoss: item.stop_loss || 0,
          confidence: item.confidence || 50,
          timeframe: item.timeframe || "1d",
          reasoning: item.reasoning || `AI analysis for ${item.token_symbol || item.symbol}`,
        }));

      if (results.length === 0) {
        logger.warn("[TokenMetrics] No signals found in API response, using mock data");
        return this.getMockTradingSignals(symbols);
      }

      logger.info(`[TokenMetrics] Returning ${results.length} real trading signals from API`);
      return results;
    } catch (error) {
      logger.error("[TokenMetrics] getTradingSignals API failed, using mock data:", String(error));
      return this.getMockTradingSignals(symbols);
    }
  }

  private getMockTradingSignals(symbols: string[]): TradingSignal[] {
    logger.warn("[TokenMetrics] Using mock trading signals");

    return symbols.map((symbol) => {
      const symbolUpper = symbol.toUpperCase();

      const mockSignals: Record<string, Partial<TradingSignal>> = {
        BTC: { signal: "BUY", entryPrice: 45000, targetPrice: 50000, stopLoss: 43000, confidence: 85, timeframe: "7d" },
        ETH: { signal: "BUY", entryPrice: 3200, targetPrice: 3500, stopLoss: 3000, confidence: 65, timeframe: "3d" },
        SOL: { signal: "BUY", entryPrice: 95.5, targetPrice: 110, stopLoss: 88, confidence: 78, timeframe: "5d" },
      };

      const mock = mockSignals[symbolUpper] || {
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

  /**
   * Get AI-recommended portfolio allocations
   * TODO: Update endpoint when Token Metrics provides actual API documentation
   */
  async getPortfolioRecommendations(riskTolerance: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM"): Promise<PortfolioRecommendation> {
    try {
      logger.info(`[TokenMetrics] Fetching portfolio recommendations (risk: ${riskTolerance})`);
      logger.warn("[TokenMetrics] Using mock portfolio recommendations - real API endpoint not yet configured");

      // Mock portfolio recommendations based on risk tolerance
      const mockPortfolios: Record<string, PortfolioRecommendation> = {
        LOW: {
          allocations: [
            { symbol: "BTC", percentage: 50, reasoning: "Safe haven asset with strong fundamentals" },
            { symbol: "ETH", percentage: 30, reasoning: "Established smart contract platform" },
            { symbol: "USDC", percentage: 20, reasoning: "Stable value preservation" },
          ],
          totalScore: 75,
          riskLevel: "LOW",
        },
        MEDIUM: {
          allocations: [
            { symbol: "BTC", percentage: 40, reasoning: "Core portfolio foundation" },
            { symbol: "ETH", percentage: 30, reasoning: "DeFi ecosystem leader" },
            { symbol: "SOL", percentage: 15, reasoning: "High-performance blockchain" },
            { symbol: "USDC", percentage: 15, reasoning: "Risk management buffer" },
          ],
          totalScore: 80,
          riskLevel: "MEDIUM",
        },
        HIGH: {
          allocations: [
            { symbol: "BTC", percentage: 30, reasoning: "Portfolio anchor" },
            { symbol: "ETH", percentage: 25, reasoning: "Smart contract leader" },
            { symbol: "SOL", percentage: 20, reasoning: "Emerging ecosystem" },
            { symbol: "MATIC", percentage: 15, reasoning: "Scaling solution" },
            { symbol: "AVAX", percentage: 10, reasoning: "Growth potential" },
          ],
          totalScore: 70,
          riskLevel: "HIGH",
        },
      };

      const portfolio = mockPortfolios[riskTolerance];
      logger.info(`[TokenMetrics] Returning mock ${riskTolerance} risk portfolio`);
      return portfolio;
    } catch (error) {
      logger.error("[TokenMetrics] getPortfolioRecommendations failed:", String(error));
      throw error;
    }
  }
}
