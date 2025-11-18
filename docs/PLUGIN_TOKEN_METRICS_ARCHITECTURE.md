# Plugin Token Metrics - Architecture Documentation

## 📋 Tổng quan

Plugin Token Metrics cung cấp khả năng phân tích crypto token, trading signals, portfolio recommendations và auto-trading thông qua Token Metrics API.

**Location:** `src/plugins/plugin-token-metrics/`

---

## 📁 1. Cấu trúc file Plugin Token Metrics

```
src/plugins/plugin-token-metrics/
├── package.json                          # Plugin dependencies
├── tsconfig.json                         # TypeScript config
├── build.ts                              # Build script (Bun)
├── src/
│   ├── index.ts                          # Plugin entry point
│   ├── services/
│   │   └── token-metrics.service.ts      # Core API service
│   └── actions/
│       ├── getTokenAnalysis.action.ts    # Action: Phân tích token
│       ├── getTradingSignals.action.ts   # Action: Trading signals
│       ├── getPortfolioRecommendations.action.ts  # Action: Portfolio advice
│       └── executeAutoTrade.action.ts    # Action: Auto-trading
└── dist/                                 # Built output (generated)
```

---

## 🔧 2. Chức năng từng file

### 2.1. `src/index.ts` - Plugin Entry Point

**Mục đích:** Export plugin với tất cả actions và services

**Khi kích hoạt:** Được import trong `src/index.ts` (root) khi server khởi động

**Nội dung chính:**
```typescript
export const tokenMetricsPlugin: Plugin = {
  name: "plugin-token-metrics",
  description: "Token Metrics AI-powered crypto analysis...",
  actions: [
    getTokenAnalysisAction,       // 4 actions
    getTradingSignalsAction,
    getPortfolioRecommendationsAction,
    executeAutoTradeAction,
  ],
  services: [TokenMetricsService], // 1 service
  evaluators: [],                  // Không có evaluators
  providers: [],                   // Không có providers
};
```

**Vai trò:**
- Đăng ký plugin với ElizaOS framework
- Khai báo tất cả actions và services mà plugin cung cấp
- Export để root project có thể import và sử dụng

---

### 2.2. `src/services/token-metrics.service.ts` - Core API Service

**Mục đích:** Wrapper service để gọi Token Metrics API

**Khi kích hoạt:**
- **Initialize:** Khi server start (được gọi bởi ElizaOS service registry)
- **Stop:** Khi server shutdown

**Chức năng chính:**

#### Constructor & Lifecycle
```typescript
constructor(runtime: IAgentRuntime)
static async start(runtime: IAgentRuntime): Promise<TokenMetricsService>
async initialize(runtime: IAgentRuntime): Promise<void>
async stop(): Promise<void>
```

#### Methods

1. **`initialize(runtime)`**
   - Đọc `TOKENMETRICS_API_KEY` từ runtime settings hoặc environment
   - Validate API key
   - Log initialization status

2. **`fetchAPI<T>(endpoint, params)`** (private)
   - Base method để gọi Token Metrics API
   - Add API key vào headers: `x-api-key`
   - Handle errors và throw với message rõ ràng
   - Log all requests/responses

3. **`getTokenAnalysis(symbols: string[])`**
   - Gọi `/v2/tokens` endpoint
   - Fallback: Nếu API fail → return mock data với warning
   - Return: `TokenAnalysis[]`

4. **`getTradingSignals(symbols: string[])`**
   - Gọi `/v2/trading-signals` endpoint
   - Try cả `token_id` và `symbol` params (fallback)
   - Gọi thêm `/v2/resistance-support` và `/v2/price-prediction`
   - Fallback: Nếu API fail → return mock data
   - Return: `TradingSignal[]`

5. **`getPortfolioRecommendations(riskTolerance)`**
   - Gọi `/v2/portfolio-allocations` endpoint
   - Fallback: Return mock data nếu API fail
   - Return: `PortfolioRecommendation`

**Data Types:**
```typescript
interface TokenAnalysis {
  symbol: string;
  rating: number;          // 1-100
  riskScore: number;       // 1-100
  aiScore: number;
  marketCap: number;
  volume24h: number;
  sentiment: string;
  recommendation: "BUY" | "SELL" | "HOLD";
}

interface TradingSignal {
  symbol: string;
  signal: "BUY" | "SELL" | "HOLD";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;      // 0-100
  timeframe: string;
  reasoning: string;
}

interface PortfolioRecommendation {
  allocations: Array<{
    symbol: string;
    percentage: number;
    reasoning: string;
  }>;
  totalScore: number;
  riskLevel: string;
}
```

---

### 2.3. `src/actions/getTokenAnalysis.action.ts`

**Mục đích:** Action để agent phân tích token (rating, risk score, sentiment)

**Khi kích hoạt:**
- User query chứa: "analyze BTC", "Token Metrics analysis", "get rating for ETH"
- ElizaOS AI model quyết định dựa trên `description` và `similes`

**Flow:**

```
1. ElizaOS AI receives user query
   ↓
2. AI selects action based on:
   - description: "Get AI-powered token analysis from Token Metrics API"
   - similes: ["TOKEN_ANALYSIS", "ANALYZE_TOKEN", "TOKEN_METRICS", ...]
   ↓
3. validate() - Always returns true (service check moved to handler)
   ↓
4. handler() executes:
   ├── Get service: runtime.getService("TOKEN_METRICS")
   ├── Extract tokens from actionParams or message content
   ├── Call service.getTokenAnalysis(symbols)
   ├── Format results
   └── Return ActionResult with data
   ↓
5. callback() - Send results to UI
```

**Parameters:**
- `tokens` (required): "BTC,ETH" hoặc "bitcoin,ethereum"

**Return:**
```typescript
{
  text: "Token Metrics Analysis for 2 token(s):\nBTC: Rating 85/100...",
  success: true,
  data: [TokenAnalysis, ...],
  values: { results, summary }
}
```

**Error Handling:**
- Rate limit errors → Add 🚨 emoji warning
- Auth errors (401/403) → Add 🔑 emoji warning
- Free tier limits → Add ⚠️ emoji warning

---

### 2.4. `src/actions/getTradingSignals.action.ts`

**Mục đích:** Action để lấy trading signals (entry/target/stop-loss)

**Khi kích hoạt:**
- User query: "get trading signals for BTC", "when to buy ETH", "entry point for SOL"

**Flow:** Tương tự `getTokenAnalysis.action.ts`

**Parameters:**
- `tokens` (required): "BTC,ETH"

**Special Features:**
- Gọi 3 API endpoints: trading-signals, resistance-support, price-prediction
- Fallback strategy nếu API fail
- Calculate target/stop-loss từ support/resistance data
- **Null safety:** Skip tokens without `token_symbol` field (fixed in recent update)

**Return:**
```typescript
{
  text: "Trading Signals for 2 token(s):\nBTC: BUY at $95000...",
  success: true,
  data: [TradingSignal, ...]
}
```

---

### 2.5. `src/actions/getPortfolioRecommendations.action.ts`

**Mục đích:** Action để lấy portfolio allocation recommendations

**Khi kích hoạt:**
- User query: "recommend portfolio", "how to allocate my assets", "portfolio for conservative"

**Parameters:**
- `riskTolerance` (optional): "conservative" | "moderate" | "aggressive"

**Return:**
```typescript
{
  text: "Portfolio Recommendations (conservative):\n- BTC: 40%...",
  success: true,
  data: PortfolioRecommendation
}
```

---

### 2.6. `src/actions/executeAutoTrade.action.ts`

**Mục đích:** Action để tự động execute trades dựa trên Token Metrics signals

**Khi kích hoạt:**
- User explicit request: "auto-trade based on signals", "execute buy for BTC"

**CRITICAL WARNINGS:**
- Executes REAL blockchain transactions
- Uses REAL money
- Requires explicit user confirmation
- Validates signal confidence > threshold

**Parameters:**
- `tokens` (required): Tokens to trade
- `confirmationRequired` (default: true): Always ask before executing

**Safety Checks:**
1. User confirmation
2. Signal confidence > 70
3. Wallet balance sufficient
4. Signal is BUY or SELL (not HOLD)

---

### 2.7. `build.ts` - Build Script

**Mục đích:** Build plugin source code to distributable format

**Khi kích hoạt:** Chạy manual command `bun run build` trong plugin directory

**Chức năng:**
```typescript
await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  external: ['@elizaos/*', ...], // Externalize ElizaOS packages
  minify: false,
  sourcemap: 'external'
});
```

**Output:** `dist/index.js` (ESM module)

---

## 🔄 3. Flow giữa các file

### 3.1. Server Startup Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Server Start (start-server.ts)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Load Root Project (src/index.ts)                        │
│    - Import tokenMetricsPlugin from                        │
│      './plugins/plugin-token-metrics/src/index.ts'         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Plugin Registration (src/plugins/.../index.ts)          │
│    - Export Plugin object with:                            │
│      • 4 actions                                           │
│      • 1 service (TokenMetricsService)                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Service Initialize (token-metrics.service.ts)           │
│    - TokenMetricsService.start(runtime)                    │
│    - Read TOKENMETRICS_API_KEY                             │
│    - Validate and log status                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Agent Ready                                             │
│    - All 4 actions registered                              │
│    - Service ready to handle API calls                     │
└─────────────────────────────────────────────────────────────┘
```

---

### 3.2. User Query → Action Execution Flow

```
┌──────────────────────────────────────────────────────────────┐
│ USER: "Analyze BTC using Token Metrics"                     │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Frontend (UI) → WebSocket                                    │
│  - socketManager.ts sends message                            │
│  - Event: "message", type: SEND_MESSAGE                      │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Backend - ElizaOS Core                                       │
│  1. Receive message in channel                               │
│  2. AI Model (OpenAI/OpenRouter) analyzes query              │
│  3. Model selects action based on:                           │
│     - Action description                                     │
│     - Action similes                                         │
│     - Context from conversation                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Action Selection: GET_TOKEN_ANALYSIS                         │
│  (getTokenAnalysis.action.ts)                                │
│                                                               │
│  Match reasons:                                              │
│  ✓ "analyze" matches description                             │
│  ✓ "Token Metrics" matches similes                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 1: validate()                                           │
│  - Always returns true (service check in handler)            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 2: handler() execution                                  │
│                                                               │
│  2.1. Get service from runtime:                              │
│       const svc = runtime.getService("TOKEN_METRICS")        │
│                                                               │
│  2.2. Extract parameters:                                    │
│       - From actionParams.tokens: "BTC"                      │
│       - Or extract from message text                         │
│                                                               │
│  2.3. Validate parameters:                                   │
│       - tokens is required                                   │
│       - Split by comma, trim, filter                         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 3: Call Service Method                                  │
│  (token-metrics.service.ts)                                  │
│                                                               │
│  const results = await svc.getTokenAnalysis(["BTC"])         │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Service: getTokenAnalysis(symbols)                           │
│                                                               │
│  3.1. Call fetchAPI<TokensResponse>("/tokens", params)       │
│                                                               │
│  3.2. fetchAPI internals:                                    │
│       - Build URL: https://api.tokenmetrics.com/v2/tokens    │
│       - Add headers: { "x-api-key": "tm-..." }               │
│       - Fetch from Token Metrics API                         │
│                                                               │
│  3.3. Handle response:                                       │
│       ✓ Success → Parse data, map to TokenAnalysis[]         │
│       ✗ Error (404/401/429) → Log error, use mock data       │
│                                                               │
│  3.4. Return TokenAnalysis[] to action handler               │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 4: Format Results (back in action handler)              │
│                                                               │
│  const summaryLines = results.map(r => {                     │
│    return `${r.symbol}: Rating ${r.rating}/100...`           │
│  })                                                           │
│                                                               │
│  const text = [                                              │
│    "Token Metrics Analysis for 1 token(s):",                 │
│    ...summaryLines                                           │
│  ].join("\n")                                                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 5: callback() - Send to UI                              │
│                                                               │
│  await callback({                                            │
│    text: "BTC: Rating 85/100 | Risk 15/100...",              │
│    actions: ["GET_TOKEN_ANALYSIS"],                          │
│    content: { results, summary },                            │
│    source: "custom_ui"                                       │
│  })                                                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Step 6: Return ActionResult                                  │
│                                                               │
│  return {                                                    │
│    text: "...",                                              │
│    success: true,                                            │
│    data: [TokenAnalysis],                                    │
│    values: { results, summary }                              │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Backend → Frontend (WebSocket)                               │
│  - Event: "messageBroadcast"                                 │
│  - Type: MESSAGE (type: 3)                                   │
│  - Payload: { text, content }                                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ UI Display (MessageList component)                           │
│  - Show action execution step: "Step 1/6: GET_TOKEN_ANALYSIS │
│    - Completed"                                              │
│  - Display agent response with formatted data                │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.3. Error Handling Flow

```
┌──────────────────────────────────────────────────────────────┐
│ Service: fetchAPI() call fails                               │
│  - HTTP 404: "Data not found"                                │
│  - HTTP 401: "Unauthorized"                                  │
│  - HTTP 429: "Rate limit exceeded"                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Service: Error Detection                                     │
│                                                               │
│  if (status === 404) {                                       │
│    throw new Error("Token Metrics API error 404: ...")       │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Service: Fallback to Mock Data                               │
│                                                               │
│  catch (error) {                                             │
│    logger.error("API failed, using mock data")               │
│    return [mockTokenAnalysis]                                │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ Action Handler: Catch Block                                  │
│                                                               │
│  catch (error) {                                             │
│    const isRateLimit = msg.includes('429')                   │
│    const isAuthError = msg.includes('401')                   │
│                                                               │
│    if (isRateLimit) {                                        │
│      userFriendlyMessage = "🚨 RATE LIMIT: ..."              │
│    } else if (isAuthError) {                                 │
│      userFriendlyMessage = "🔑 AUTH ERROR: ..."              │
│    }                                                          │
│                                                               │
│    return {                                                  │
│      text: userFriendlyMessage,                              │
│      success: false,                                         │
│      error: msg,                                             │
│      data: { errorType, ... }                                │
│    }                                                          │
│  }                                                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ UI Display                                                   │
│  - Show error with emoji warning                             │
│  - Display user-friendly message                             │
│  - Mark action step as "Error"                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 4. Khi nào action được kích hoạt?

### Cơ chế Action Selection của ElizaOS

ElizaOS sử dụng **OpenAI Function Calling** (hoặc OpenRouter proxy) để AI model tự quyết định action nào sẽ chạy.

**Input cho AI:**
1. **User message:** "Analyze BTC using Token Metrics"
2. **Available actions:** List of all registered actions với:
   - `name`: "GET_TOKEN_ANALYSIS"
   - `description`: "Get AI-powered token analysis from Token Metrics API..."
   - `similes`: ["TOKEN_ANALYSIS", "ANALYZE_TOKEN", ...]
   - `parameters`: { tokens: { type: "string", required: true } }
3. **Conversation context:** Previous messages

**AI Decision Process:**
```
1. Parse user intent: "User wants to analyze BTC"
2. Match intent to action descriptions
3. Check similes for keyword matches
4. Select action: GET_TOKEN_ANALYSIS
5. Extract parameters: { tokens: "BTC" }
6. Return function call to ElizaOS
```

**ElizaOS Execution:**
```
7. ElizaOS receives function call from AI
8. Call action.validate(runtime) → true/false
9. If valid, call action.handler(runtime, message, state, options, callback)
10. Handler executes logic and returns result
11. Result sent back to AI for final response formatting
12. AI generates natural language response
13. Response sent to UI via WebSocket
```

---

### Action Trigger Examples

#### GET_TOKEN_ANALYSIS
**Triggers:**
- "Analyze BTC"
- "Get Token Metrics rating for ETH"
- "What's the AI score for SOL?"
- "Token Metrics analysis for BTC,ETH,SOL"

**Why selected:**
- Keywords: "analyze", "rating", "score", "Token Metrics"
- Similes match: "TOKEN_ANALYSIS", "ANALYZE_TOKEN", "AI_RATING"
- Description mentions: "Get AI-powered token analysis"

#### GET_TRADING_SIGNALS
**Triggers:**
- "Get trading signals for BTC"
- "When should I buy ETH?"
- "Show me entry and exit points for SOL"
- "Token Metrics signals for MATIC"

**Why selected:**
- Keywords: "signals", "buy", "entry", "exit"
- Similes: "TRADING_SIGNALS", "ENTRY_POINTS", "BUY_SELL_SIGNALS"
- Description: "Get AI-powered trading signals with entry/target/stop-loss"

#### GET_PORTFOLIO_RECOMMENDATIONS
**Triggers:**
- "Recommend a portfolio for me"
- "How should I allocate my crypto assets?"
- "Conservative portfolio allocation"

**Why selected:**
- Keywords: "portfolio", "allocation", "recommend"
- Similes: "PORTFOLIO_RECOMMENDATIONS", "ASSET_ALLOCATION"

#### EXECUTE_AUTO_TRADE
**Triggers:**
- "Execute auto-trade based on signals"
- "Buy BTC based on Token Metrics signals"
- "Auto-trade ETH now"

**Why selected:**
- Keywords: "execute", "auto-trade", "buy based on"
- Similes: "EXECUTE_AUTO_TRADE", "AUTO_TRADING"
- **Critical:** Requires explicit user confirmation

---

## 🔐 5. API Integration Details

### Token Metrics API Endpoints Used

#### 1. `/v2/tokens` (GET_TOKEN_ANALYSIS)
**Request:**
```
GET https://api.tokenmetrics.com/v2/tokens?symbol=BTC
Headers:
  x-api-key: tm-xxxx...
```

**Response (Success):**
```json
{
  "success": true,
  "data": [{
    "token_id": 3375,
    "token_symbol": "BTC",
    "rating": 85,
    "risk_score": 15,
    "ai_score": 85,
    "market_cap": 1800000000000,
    "volume_24h": 45000000000,
    "sentiment": "BULLISH",
    "recommendation": "BUY"
  }]
}
```

**Response (Error - Free Tier):**
```json
{
  "success": false,
  "message": "Data not found",
  "length": 0,
  "data": []
}
```

#### 2. `/v2/trading-signals` (GET_TRADING_SIGNALS)
**Request:**
```
GET https://api.tokenmetrics.com/v2/trading-signals?symbol=BTC&start_date=2025-10-18&end_date=2025-11-17
Headers:
  x-api-key: tm-xxxx...
```

**Free Tier Limitation:** Returns 404 "Data not found"

#### 3. `/v2/resistance-support` (GET_TRADING_SIGNALS)
**Request:**
```
GET https://api.tokenmetrics.com/v2/resistance-support?symbol=BTC
```

**Free Tier Limitation:** Returns 401 "Not authorized with your current plan"

#### 4. `/v2/price-prediction` (GET_TRADING_SIGNALS)
**Status:** Endpoint không tồn tại hoặc deprecated

---

### Authentication

**Method:** API Key in header
```
x-api-key: tm-5272ec2...
```

**Environment Variable:**
```bash
TOKENMETRICS_API_KEY="tm-xxxxxxx..."
```

---

## 🚨 6. Known Issues & Limitations

### Free Tier Limitations

| Endpoint | Free Tier Support | Error |
|----------|-------------------|-------|
| `/v2/tokens` | ❌ Limited | 404 "Data not found" |
| `/v2/trading-signals` | ❌ No | 404 "Data not found" |
| `/v2/resistance-support` | ❌ No | 401 "Not authorized" |
| `/v2/price-prediction` | ❌ No | Endpoint không tồn tại |

### Fallback Behavior

Khi API fail, service returns **mock data** với warnings:
```javascript
logger.warn("[TokenMetrics] Using mock trading signals")
```

**Mock data characteristics:**
- `marketCap: 0`
- `volume24h: 0`
- Static values: `rating: 85`, `riskScore: 15`
- Sentiment: "BULLISH", Recommendation: "BUY"

### Emoji Warnings (Backend Only)

**Problem:** Emoji warnings (🚨, 🔑, ⚠️) chỉ xuất hiện trong logs, KHÔNG hiển thị lên UI.

**Location:** Logs only
- `[Token Metrics] ⚠️ resistanceSupport for BTC unavailable`
- `[Token Metrics] ⚠️ pricePrediction for BTC unavailable`

**User Impact:** User không biết API đang fail hoặc sử dụng mock data.

---

## 🛠️ 7. Development Workflow

### Adding a New Action

1. **Create action file:**
   ```bash
   touch src/actions/getNewFeature.action.ts
   ```

2. **Implement Action interface:**
   ```typescript
   export const getNewFeatureAction: Action = {
     name: "GET_NEW_FEATURE",
     similes: ["NEW_FEATURE", "FEATURE"],
     description: "Clear description for AI to understand",
     parameters: { /* ... */ },
     validate: async (runtime) => { /* ... */ },
     handler: async (runtime, message, state, options, callback) => {
       // Implementation
     },
     examples: [ /* ... */ ]
   };
   ```

3. **Add to plugin exports (index.ts):**
   ```typescript
   import { getNewFeatureAction } from "./actions/getNewFeature.action";

   export const tokenMetricsPlugin: Plugin = {
     actions: [
       getTokenAnalysisAction,
       getTradingSignalsAction,
       getNewFeatureAction, // Add here
     ],
     // ...
   };
   ```

4. **Rebuild plugin:**
   ```bash
   cd src/plugins/plugin-token-metrics
   bun run build
   ```

5. **Rebuild backend:**
   ```bash
   cd ../../../
   bun run build:backend
   ```

6. **Restart server:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   bun start
   ```

---

### Adding a New Service Method

1. **Add method to service class:**
   ```typescript
   // In token-metrics.service.ts
   async getNewData(param: string): Promise<NewDataType> {
     return await this.fetchAPI<NewDataType>("/new-endpoint", { param });
   }
   ```

2. **Use in action handler:**
   ```typescript
   const svc = runtime.getService("TOKEN_METRICS") as TokenMetricsService;
   const data = await svc.getNewData("param");
   ```

3. **Rebuild and restart** (same as above)

---

## 📊 8. Testing & Debugging

### Testing Locally

```bash
# 1. Start server with logs
bun start > /tmp/otaku-server.log 2>&1 &

# 2. Monitor logs real-time
tail -f /tmp/otaku-server.log | grep -E "(TokenMetrics|GET_TOKEN)"

# 3. Open UI
open http://localhost:3000

# 4. Test query
# Type in chat: "Analyze BTC using Token Metrics"

# 5. Check results in logs
grep "GET_TOKEN_ANALYSIS" /tmp/otaku-server.log
```

### Debugging Action Selection

**Check if action is registered:**
```bash
grep "GET_TOKEN_ANALYSIS" /tmp/otaku-server.log
# Should see: Action registered logs
```

**Check if action is triggered:**
```bash
grep "===== TOKEN METRICS ACTION HANDLER STARTED =====" /tmp/otaku-server.log
# If not found → AI didn't select this action
```

**Check service availability:**
```bash
grep "TOKEN_METRICS.*Service" /tmp/otaku-server.log
# Should see: "[TokenMetrics] Service initialized successfully"
```

**Check API calls:**
```bash
grep "api.tokenmetrics.com" /tmp/otaku-server.log
# Shows actual API requests made
```

---

### Common Debug Scenarios

#### Action not triggered
**Symptom:** No execution steps, AI just answers with text

**Debug:**
```bash
# Check if provider is OpenAI (not OpenRouter)
grep "OpenAI\|OpenRouter" /tmp/otaku-server.log | tail -5

# Should see: [OpenAI] Generating text
# NOT: [OpenRouter] Generating text
```

**Fix:** Set `modelProvider: 'openai'` in `src/character.ts`

#### Service not found
**Symptom:** Error "TokenMetricsService not available"

**Debug:**
```bash
# Check service initialization
grep "TokenMetrics.*initialize" /tmp/otaku-server.log
```

**Fix:** Verify plugin is imported in `src/index.ts`

#### API returns mock data
**Symptom:** `marketCap: 0`, `volume24h: 0` in results

**Debug:**
```bash
# Check API responses
grep "API.*404\|API.*401" /tmp/otaku-server.log
```

**Fix:** Upgrade Token Metrics account or accept mock data for free tier

---

## 📚 9. References

### ElizaOS Documentation
- Actions: https://elizaos.github.io/eliza/docs/core/actions
- Services: https://elizaos.github.io/eliza/docs/core/services
- Plugins: https://elizaos.github.io/eliza/docs/core/plugins

### Token Metrics API
- Official Docs: https://docs.tokenmetrics.com/
- API Reference: https://api.tokenmetrics.com/docs

### Related Files
- `docs/TROUBLESHOOTING.md` - Common issues and fixes
- `docs/REBUILD_AND_RESTART.md` - Build and deployment guide
- `TEST_TOKEN_METRICS.md` - Testing instructions

---

## 🎓 Summary

**Plugin Token Metrics** là một ElizaOS plugin cung cấp 4 actions và 1 service để tích hợp Token Metrics API:

**Actions:**
1. `GET_TOKEN_ANALYSIS` - Token ratings, risk scores, sentiment
2. `GET_TRADING_SIGNALS` - Entry/target/stop-loss signals
3. `GET_PORTFOLIO_RECOMMENDATIONS` - Asset allocation advice
4. `EXECUTE_AUTO_TRADE` - Auto-trading based on signals

**Service:**
- `TokenMetricsService` - API wrapper với error handling và mock data fallback

**Execution Flow:**
```
User Query → ElizaOS AI → Action Selection → Action Handler →
Service Method → Token Metrics API → Format Results →
Callback to UI → WebSocket → Frontend Display
```

**Key Files:**
- `src/index.ts` - Plugin entry point
- `src/services/token-metrics.service.ts` - API service
- `src/actions/*.action.ts` - 4 action implementations

**Known Limitations:**
- Free tier API returns 404/401 for most endpoints
- Fallback to mock data when API fails
- Emoji warnings not shown on UI (backend logs only)
