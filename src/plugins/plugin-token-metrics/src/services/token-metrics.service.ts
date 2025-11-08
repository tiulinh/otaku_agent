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

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime): Promise<TokenMetricsService> {
    console.log("===== TOKEN METRICS SERVICE START CALLED (v4) =====");
    logger.info("[TokenMetrics] Starting TokenMetrics service");

    const service = new TokenMetricsService(runtime);

    // Initialize API key directly in start() like CdpService
    service.apiKey = runtime.getSetting("TOKENMETRICS_API_KEY") || "";

    if (!service.apiKey) {
      console.log("[TokenMetrics] WARNING: API key not configured");
      logger.warn("[TokenMetrics] API key not configured");
    } else {
      console.log(`[TokenMetrics] Service started with API key: ${service.apiKey.substring(0, 10)}...`);
      logger.info("[TokenMetrics] Service started successfully");
    }

    return service;
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

    console.log("===== CALLING TOKEN METRICS API =====");
    console.log(`URL: ${url.toString()}`);
    console.log(`API Key: ${this.apiKey.substring(0, 10)}...`);
    logger.info(`[TokenMetrics] Calling API: ${url.toString()}`);

    // Token Metrics API uses x-api-key header (official documentation)
    const headers = {
      "x-api-key": this.apiKey,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(url.toString(), { headers });

      console.log(`===== API RESPONSE STATUS: ${response.status} =====`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`===== API ERROR RESPONSE =====`);
        console.log(`Status: ${response.status}`);
        console.log(`Error: ${errorText}`);
        logger.error(`[TokenMetrics] API error ${response.status}: ${errorText}`);
        throw new Error(`Token Metrics API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`===== API SUCCESS =====`);
      console.log(`Response data:`, JSON.stringify(data).substring(0, 500));
      logger.info(`[TokenMetrics] API call successful`);
      return data as T;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`===== API REQUEST FAILED =====`);
      console.log(`Error: ${msg}`);
      logger.error(`[TokenMetrics] Request failed: ${msg}`);
      throw error;
    }
  }

  /**
   * Get AI-powered token analysis and ratings
   * Tries real Token Metrics API, falls back to trading signals data
   */
  async getTokenAnalysis(symbols: string[]): Promise<TokenAnalysis[]> {
    try {
      logger.info(`[TokenMetrics] Fetching analysis for: ${symbols.join(", ")}`);

      // Get trading signals which contains current price and sentiment data
      const signals = await this.getTradingSignals(symbols);

      // Map trading signals to token analysis format
      const results: TokenAnalysis[] = signals.map((signal) => {
        // Derive rating from confidence (0-100 already)
        const rating = signal.confidence;

        // Derive risk score (inverse of confidence, so high confidence = low risk)
        const riskScore = 100 - signal.confidence;

        // AI score same as rating
        const aiScore = signal.confidence;

        // Determine sentiment from signal type
        const sentiment = signal.signal === "BUY" ? "BULLISH" :
                         signal.signal === "SELL" ? "BEARISH" : "NEUTRAL";

        return {
          symbol: signal.symbol,
          rating: rating,
          riskScore: riskScore,
          aiScore: aiScore,
          marketCap: 0, // Not available from trading signals
          volume24h: 0, // Not available from trading signals
          sentiment: sentiment,
          recommendation: signal.signal as "BUY" | "SELL" | "HOLD",
        };
      });

      logger.info(`[TokenMetrics] Returning ${results.length} analyses derived from trading signals`);
      return results;
    } catch (error) {
      logger.error("[TokenMetrics] getTokenAnalysis failed, using mock data:", String(error));
      return this.getMockTokenAnalysis(symbols);
    }
  }

  private getMockTokenAnalysis(symbols: string[]): TokenAnalysis[] {
    logger.warn("[TokenMetrics] Using mock token analysis");

    return symbols.map((symbol) => {
      const symbolUpper = symbol.toUpperCase();

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
  }

  /**
   * Get trading signals with entry/exit points
   * Real Token Metrics API endpoint: /trading-signals
   */
  // Known token ID mappings from Token Metrics API
  private readonly TOKEN_ID_MAP: Record<string, number> = {
    "BTC": 3375,
    "BITCOIN": 3375,
    "ETH": 1027,
    "ETHEREUM": 1027,
    "SOL": 5426,
    "SOLANA": 5426,
    "MATIC": 3890,
    "POLYGON": 3890,
    "AVAX": 5805,
    "AVALANCHE": 5805,
  };

  async getTradingSignals(symbols: string[]): Promise<TradingSignal[]> {
    try {
      console.log("===== TOKEN METRICS getTradingSignals CALLED =====");
      console.log(`Symbols requested: ${symbols.join(", ")}`);
      logger.info(`[TokenMetrics] Fetching trading signals for: ${symbols.join(", ")}`);

      // Call real Token Metrics API
      // Based on official docs: https://developers.tokenmetrics.com/docs/trading-signals-guide
      interface TMTradingSignalResponse {
        success?: boolean;
        message?: string;
        length?: number;
        data?: Array<{
          TOKEN_ID?: number;
          TOKEN_NAME?: string;
          TOKEN_SYMBOL?: string;
          SYMBOL?: string;
          DATE?: string;
          TRADING_SIGNAL?: number; // bullish (1), bearish (-1), or no signal (0)
          TOKEN_TREND?: string;
          TRADING_SIGNALS_RETURNS?: number;
          HOLDING_RETURNS?: number;
          TM_LINK?: string;
          TM_TRADER_GRADE?: string;
          TM_INVESTOR_GRADE?: string;
        }>;
      }

      // Try to get token IDs from mapping
      const tokenIds = symbols
        .map(s => this.TOKEN_ID_MAP[s.toUpperCase()])
        .filter(id => id !== undefined);

      console.log(`===== TOKEN ID MAPPING =====`);
      console.log(`Symbols: ${symbols.join(", ")}`);
      console.log(`Mapped Token IDs: ${tokenIds.join(", ") || "none found"}`);

      // Token Metrics API requires date range parameters
      // Get last 30 days of data
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const dateParams = {
        start_date: startDate.toISOString().split('T')[0], // YYYY-MM-DD format
        end_date: endDate.toISOString().split('T')[0],
      };

      console.log(`===== DATE RANGE =====`);
      console.log(`Start: ${dateParams.start_date}, End: ${dateParams.end_date}`);

      let response: TMTradingSignalResponse;

      // Try with token_id first if we have mappings
      if (tokenIds.length > 0) {
        console.log(`===== TRYING WITH TOKEN_ID PARAMETER =====`);
        try {
          response = await this.fetchAPI<TMTradingSignalResponse>("/trading-signals", {
            token_id: tokenIds.join(","),
            ...dateParams,
          });
          console.log(`===== TOKEN_ID APPROACH SUCCEEDED =====`);
        } catch (error) {
          console.log(`===== TOKEN_ID APPROACH FAILED, TRYING SYMBOL =====`);
          console.log(`Error: ${error instanceof Error ? error.message : String(error)}`);
          // Fallback to symbol parameter
          response = await this.fetchAPI<TMTradingSignalResponse>("/trading-signals", {
            symbol: symbols.join(","),
            ...dateParams,
          });
        }
      } else {
        // No token IDs found, use symbol directly
        response = await this.fetchAPI<TMTradingSignalResponse>("/trading-signals", {
          symbol: symbols.join(","),
          ...dateParams,
        });
      }

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn("[TokenMetrics] API returned unexpected format, using mock data");
        return this.getMockTradingSignals(symbols);
      }

      console.log(`===== API RETURNED ${response.data.length} RECORDS =====`);

      // Group by symbol and get the most recent signal for each
      const symbolMap = new Map<string, typeof response.data[0]>();

      for (const item of response.data) {
        const symbol = (item.TOKEN_SYMBOL || item.SYMBOL || "").toUpperCase();
        if (!symbols.some(s => s.toUpperCase() === symbol)) continue;

        const existing = symbolMap.get(symbol);
        const itemDate = new Date(item.DATE || 0);
        const existingDate = existing ? new Date(existing.DATE || 0) : new Date(0);

        // Keep the most recent signal
        if (itemDate >= existingDate) {
          symbolMap.set(symbol, item);
        }
      }

      const results: TradingSignal[] = Array.from(symbolMap.values()).map((item) => {
        // Map TRADING_SIGNAL (1, -1, 0) to BUY/SELL
        const tradingSignal = item.TRADING_SIGNAL || 0;
        const signal: "BUY" | "SELL" = tradingSignal >= 0 ? "BUY" : "SELL";

        // Use TM_TRADER_GRADE as confidence if available, otherwise use signal strength
        const traderGrade = typeof item.TM_TRADER_GRADE === 'string'
          ? parseFloat(item.TM_TRADER_GRADE)
          : item.TM_TRADER_GRADE || 0;

        const confidence = traderGrade > 0 ? traderGrade : Math.abs(tradingSignal) * 50;

        console.log(`===== SIGNAL FOR ${item.TOKEN_SYMBOL} =====`);
        console.log(`Trading Signal: ${tradingSignal}, Grade: ${traderGrade}, Confidence: ${confidence}`);

        return {
          symbol: (item.TOKEN_SYMBOL || item.SYMBOL || "").toUpperCase(),
          signal: signal,
          entryPrice: 0, // Not available in this endpoint
          targetPrice: 0, // Not available in this endpoint
          stopLoss: 0, // Not available in this endpoint
          confidence: Math.round(confidence),
          timeframe: "30d",
          reasoning: `Token Metrics ${signal} signal (Trader Grade: ${traderGrade.toFixed(2)})`,
        };
      });

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
