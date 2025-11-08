# Hướng Dẫn Sử Dụng Token Metrics Plugin

## Tổng Quan

Token Metrics Plugin cung cấp 4 tính năng chính để phân tích và giao dịch tiền mã hóa tự động bằng AI:

1. **Phân Tích Token (Token Analysis)** - Đánh giá và xếp hạng token
2. **Tín Hiệu Giao Dịch (Trading Signals)** - Khuyến nghị mua/bán
3. **Khuyến Nghị Danh Mục (Portfolio Recommendations)** - Tư vấn phân bổ vốn
4. **Giao Dịch Tự Động (Auto Trading)** - Thực thi lệnh tự động

---

## 1. Phân Tích Token (GET_TOKEN_ANALYSIS)

### File Code
`src/plugins/plugin-token-metrics/src/actions/getTokenAnalysis.action.ts`

### Mục Đích
Cung cấp phân tích chuyên sâu về token bằng AI, bao gồm:
- **Điểm xếp hạng AI** (AI Rating Score) từ 0-100
- **Mức độ rủi ro** (Risk Level): Thấp/Trung bình/Cao
- **Khuyến nghị đầu tư** (Investment Recommendation): Mua/Giữ/Bán
- **Phân tích kỹ thuật** (Technical Analysis): Xu hướng giá, chỉ số kỹ thuật

### Cách Hoạt Động
```
User → Frontend → Action → TokenMetricsService → API Token Metrics → Response
```

1. User nhập: "Phân tích BTC và ETH"
2. Action gọi `TokenMetricsService.getTokenAnalysis(["BTC", "ETH"])`
3. Service gọi API: `https://api.tokenmetrics.com/v2/token-analysis?symbols=BTC,ETH`
4. Trả về phân tích chi tiết cho từng token

### Ví Dụ Sử Dụng
```
User: "Analyze BTC and ETH using Token Metrics"
User: "Phân tích SOL"
User: "Đánh giá MATIC và AVAX"
```

### Kết Quả Hiển Thị
```
📊 Phân Tích Token: BTC

✅ Điểm AI: 85/100
⚠️ Rủi ro: Trung bình
📈 Khuyến nghị: MUA

Phân tích kỹ thuật:
- Xu hướng: Tăng mạnh
- Hỗ trợ: $42,000
- Kháng cự: $48,000
```

### Tích Hợp Frontend
Trong `src/frontend/components/chat/chat-interface.tsx`:
```typescript
tokenMetrics: {
  name: "Token Metrics AI",
  icon: TrendingUp,
  description: "AI-powered analysis and trading signals",
  prompts: [
    "Analyze BTC and ETH using Token Metrics", // ← Kích hoạt action này
    ...
  ]
}
```

---

## 2. Tín Hiệu Giao Dịch (GET_TRADING_SIGNALS)

### File Code
`src/plugins/plugin-token-metrics/src/actions/getTradingSignals.action.ts`

### Mục Đích
Cung cấp tín hiệu giao dịch chi tiết bao gồm:
- **Tín hiệu** (Signal): MUA/BÁN/GIỮ
- **Độ tin cậy** (Confidence): 0-100%
- **Điểm vào** (Entry Price): Giá mua đề xuất
- **Điểm thoát** (Exit Price): Giá bán đề xuất
- **Cắt lỗ** (Stop Loss): Mức giá dừng lỗ
- **Khung thời gian** (Timeframe): Ngắn hạn/Trung hạn/Dài hạn

### Cách Hoạt Động
```
User → Frontend → Action → TokenMetricsService → API Token Metrics → Response
```

1. User nhập: "Lấy tín hiệu giao dịch cho SOL"
2. Action gọi `TokenMetricsService.getTradingSignals(["SOL"])`
3. Service gọi API: `https://api.tokenmetrics.com/v2/trading-signals?symbols=SOL`
4. Trả về tín hiệu giao dịch với điểm vào/thoát

### Ví Dụ Sử Dụng
```
User: "Get trading signals for SOL"
User: "Tín hiệu giao dịch BTC"
User: "Có nên mua ETH không?"
```

### Kết Quả Hiển Thị
```
📡 Tín Hiệu Giao Dịch: SOL

🟢 Tín hiệu: MUA
✅ Độ tin cậy: 78%

💰 Điểm vào: $95.50
🎯 Điểm thoát: $110.00 (+15.2%)
🛑 Cắt lỗ: $88.00 (-7.9%)

⏰ Khung thời gian: Trung hạn (2-4 tuần)
```

### Tích Hợp Frontend
```typescript
prompts: [
  ...,
  "Get trading signals for SOL", // ← Kích hoạt action này
  ...
]
```

---

## 3. Khuyến Nghị Danh Mục (GET_PORTFOLIO_RECOMMENDATIONS)

### File Code
`src/plugins/plugin-token-metrics/src/actions/getPortfolioRecommendations.action.ts`

### Mục Đích
Tư vấn cách phân bổ vốn đầu tư dựa trên:
- **Mức độ rủi ro** (Risk Tolerance): THẤP/TRUNG BÌNH/CAO
- **Phân bổ tài sản** (Asset Allocation): % cho mỗi token
- **Đa dạng hóa** (Diversification): Cân bằng rủi ro
- **Lợi nhuận kỳ vọng** (Expected Return): Dự báo lợi nhuận

### Cách Hoạt Động
```
User → Frontend → Action → Phân tích risk → TokenMetricsService → Response
```

1. User nhập: "Khuyến nghị danh mục đầu tư"
2. Action phân tích từ khóa để xác định mức độ rủi ro:
   - "an toàn", "ổn định" → THẤP
   - "cân bằng", "trung bình" → TRUNG BÌNH
   - "mạo hiểm", "cao" → CAO
3. Gọi `TokenMetricsService.getPortfolioRecommendations(riskLevel)`
4. Trả về danh sách token và % phân bổ

### Ví Dụ Sử Dụng
```
User: "Show portfolio recommendations"
User: "Khuyến nghị danh mục đầu tư an toàn"
User: "Tư vấn danh mục rủi ro cao"
```

### Kết Quả Hiển Thị
```
💼 Khuyến Nghị Danh Mục (Rủi ro TRUNG BÌNH)

📊 Phân bổ tài sản:
- BTC: 40% (Nền tảng)
- ETH: 30% (Smart contracts)
- SOL: 15% (Tăng trưởng)
- USDC: 15% (Ổn định)

📈 Lợi nhuận kỳ vọng: +25-35% (12 tháng)
⚖️ Tỷ lệ Sharpe: 1.8
🛡️ Đa dạng hóa: Tốt
```

### Tích Hợp Frontend
```typescript
prompts: [
  ...,
  "Show portfolio recommendations", // ← Kích hoạt action này
  ...
]
```

---

## 4. Giao Dịch Tự Động (EXECUTE_AUTO_TRADE)

### File Code
`src/plugins/plugin-token-metrics/src/actions/executeAutoTrade.action.ts`

### Mục Đích
Tự động thực thi lệnh giao dịch dựa trên tín hiệu AI với các biện pháp an toàn:
- **Kiểm tra độ tin cậy** (Confidence Check): Chỉ giao dịch nếu > ngưỡng
- **Xác minh số dư** (Balance Verification): Đảm bảo đủ tiền
- **Tích hợp CDP Wallet**: Thực thi swap thực tế qua Coinbase
- **Giới hạn số tiền**: Bảo vệ khỏi giao dịch lỗi lớn

### Cách Hoạt Động
```
User → Action → Lấy tín hiệu → Kiểm tra độ tin cậy → CDP Swap → Xác nhận
```

1. User nhập: "Auto-trade ETH với $100"
2. Action phân tích để lấy: token (ETH), số tiền ($100)
3. Gọi `getTradingSignals(["ETH"])` để lấy tín hiệu
4. **Kiểm tra an toàn**:
   - Độ tin cậy >= 70%? (mặc định)
   - Tín hiệu là MUA/BÁN? (không phải GIỮ)
   - Số dư ví đủ không?
5. Nếu OK → Gọi CDP `SWAP_TOKENS` để thực thi
6. Nếu không → Từ chối và giải thích lý do

### Biện Pháp An Toàn

#### 1. Ngưỡng Độ Tin Cậy
```typescript
const minConfidence = 70; // Chỉ giao dịch nếu AI tin >= 70%

if (signal.confidence < minConfidence) {
  return {
    text: `⚠️ Độ tin cậy (${signal.confidence}%) thấp hơn ngưỡng an toàn.
    Giao dịch KHÔNG được thực thi.`,
    success: false,
  };
}
```

#### 2. Bỏ Qua Tín Hiệu "GIỮ"
```typescript
if (signal.signal === "HOLD") {
  return {
    text: "📊 Tín hiệu là GIỮ. Không giao dịch.",
    success: true,
  };
}
```

#### 3. Xác Minh Trước Khi Giao Dịch
```typescript
// Hiển thị kế hoạch trước khi thực thi
📋 Kế hoạch giao dịch:
- Token: ETH
- Tín hiệu: MUA
- Số tiền: $100
- Độ tin cậy: 85%
- Điểm vào: $3,200

⚠️ Bạn có chắc chắn muốn thực thi?
```

### Ví Dụ Sử Dụng
```
User: "Auto-trade ETH with $100"
User: "Giao dịch tự động BTC 0.01"
User: "Mua SOL theo tín hiệu AI"
```

### Kết Quả Hiển Thị

**Trường hợp thành công:**
```
✅ Giao dịch tự động thực thi thành công!

📊 Chi tiết:
- Token: ETH
- Tín hiệu: MUA (85% tin cậy)
- Số tiền: $100
- Giá vào: $3,200
- Số lượng: 0.03125 ETH

🔗 Transaction: 0x1234...5678
```

**Trường hợp từ chối:**
```
⚠️ Giao dịch KHÔNG được thực thi

Lý do: Độ tin cậy (65%) thấp hơn ngưỡng an toàn (70%)

💡 Khuyến nghị:
- Đợi tín hiệu mạnh hơn
- Hoặc giao dịch thủ công với số tiền nhỏ
```

### Tích Hợp Frontend
```typescript
prompts: [
  ...,
  "Auto-trade ETH with $100", // ← Kích hoạt action này
]
```

---

## Kiến Trúc Tổng Thể

### Luồng Dữ Liệu

```
┌─────────────────┐
│   Frontend      │
│  Quick Start    │
│   (Click card)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Chat Input    │
│  "Analyze BTC"  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│   ElizaOS Framework     │
│  (Nhận diện action)     │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Token Metrics Action    │
│  (1 trong 4 actions)     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  TokenMetricsService     │
│  (Gọi API)               │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Token Metrics API       │
│  (api.tokenmetrics.com)  │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Response Format         │
│  (JSON → Text)           │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│  Frontend Display        │
│  (Hiển thị kết quả)      │
└──────────────────────────┘
```

### Cấu Trúc File

```
src/plugins/plugin-token-metrics/
├── src/
│   ├── index.ts                              # Plugin export chính
│   ├── services/
│   │   └── token-metrics.service.ts          # Service gọi API
│   └── actions/
│       ├── getTokenAnalysis.action.ts        # Feature 1: Phân tích
│       ├── getTradingSignals.action.ts       # Feature 2: Tín hiệu
│       ├── getPortfolioRecommendations.action.ts  # Feature 3: Danh mục
│       └── executeAutoTrade.action.ts        # Feature 4: Auto-trade
```

---

## Cách Đăng Ký Plugin

### 1. Trong Backend (`src/index.ts`)
```typescript
import tokenMetricsPlugin from './plugins/plugin-token-metrics/src/index.ts';

export const projectAgent: ProjectAgent = {
  character,
  plugins: [
    sqlPlugin,
    bootstrapPlugin,
    // ... các plugin khác
    tokenMetricsPlugin,  // ← Đăng ký plugin
  ],
};
```

### 2. Trong Frontend (`src/frontend/components/chat/chat-interface.tsx`)
```typescript
const PLUGIN_ACTIONS = {
  // ... các plugin khác
  tokenMetrics: {
    name: "Token Metrics AI",
    icon: TrendingUp,
    description: "AI-powered analysis and trading signals",
    prompts: [
      "Analyze BTC and ETH using Token Metrics",     // → Feature 1
      "Get trading signals for SOL",                  // → Feature 2
      "Show portfolio recommendations",               // → Feature 3
      "Auto-trade ETH with $100",                     // → Feature 4
    ]
  }
}
```

### 3. Biến Môi Trường (`.env`)
```bash
# Token Metrics API Key
TOKENMETRICS_API_KEY="tm-5272ec22-454d-4143-b46d-6675e172ba92"
```

---

## Cách Frontend Gắn Vào

### Bước 1: User Click Quick Start Card
User click vào card "Token Metrics AI" trong giao diện:

```typescript
// File: src/frontend/components/chat/chat-interface.tsx
<div className="quick-start-cards">
  {Object.entries(PLUGIN_ACTIONS).map(([key, plugin]) => (
    <Card onClick={() => handlePromptClick(plugin.prompts[0])}>
      <plugin.icon />
      <h3>{plugin.name}</h3>
      <p>{plugin.description}</p>
    </Card>
  ))}
</div>
```

### Bước 2: Prompt Được Gửi Qua WebSocket
```typescript
// File: src/frontend/lib/socketManager.ts
socket.emit('message', {
  type: 'SEND_MESSAGE',
  userId: currentUserId,
  channelId: currentChannelId,
  content: 'Analyze BTC and ETH using Token Metrics'
});
```

### Bước 3: ElizaOS Nhận Diện Action
```typescript
// ElizaOS framework tự động:
1. Phân tích message
2. Tìm action phù hợp dựa trên:
   - action.name: "GET_TOKEN_ANALYSIS"
   - action.similes: ["TOKEN_ANALYSIS", "ANALYZE_TOKEN", ...]
   - action.description
3. Gọi action.handler()
```

### Bước 4: Action Xử Lý
```typescript
// File: src/plugins/plugin-token-metrics/src/actions/getTokenAnalysis.action.ts
handler: async (runtime, message, _state, _options, callback) => {
  // 1. Parse tokens từ message
  const tokens = extractTokens(message.content); // ["BTC", "ETH"]

  // 2. Gọi service
  const service = runtime.getService<TokenMetricsService>("token-metrics");
  const analyses = await service.getTokenAnalysis(tokens);

  // 3. Format response
  const response = formatAnalysisResponse(analyses);

  // 4. Gửi về frontend qua callback
  callback({ text: response, success: true });
}
```

### Bước 5: Frontend Nhận Response
```typescript
// File: src/frontend/lib/socketManager.ts
socket.on('messageBroadcast', (data) => {
  // Nhận response từ agent
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: data.text,
    timestamp: new Date()
  }]);
});
```

---

## So Sánh 4 Features

| Feature | File | Input | Output | Tích hợp CDP |
|---------|------|-------|--------|--------------|
| **Token Analysis** | `getTokenAnalysis.action.ts` | Token symbols (BTC, ETH) | Điểm AI, rủi ro, khuyến nghị | ❌ Không |
| **Trading Signals** | `getTradingSignals.action.ts` | Token symbols | Tín hiệu MUA/BÁN, điểm vào/thoát | ❌ Không |
| **Portfolio Recommendations** | `getPortfolioRecommendations.action.ts` | Mức độ rủi ro | Danh sách token và % phân bổ | ❌ Không |
| **Auto Trading** | `executeAutoTrade.action.ts` | Token + số tiền | Transaction hash | ✅ Có (CDP SWAP) |

---

## Cấu Hình API Key

### Lấy API Key
1. Đăng ký tại: https://tokenmetrics.com/api
2. Copy API key có dạng: `tm-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Thêm Vào Môi Trường

**Local (.env):**
```bash
TOKENMETRICS_API_KEY="tm-5272ec22-454d-4143-b46d-6675e172ba92"
```

**Production (Railway):**
1. Vào Railway Dashboard
2. Chọn project → Variables
3. Thêm: `TOKENMETRICS_API_KEY` = `tm-5272ec22-454d-4143-b46d-6675e172ba92`
4. Save → Railway tự động deploy lại

---

## Kiểm Tra Plugin Hoạt Động

### 1. Check Backend Logs
```bash
bun run dev
# Xem log:
# [TokenMetrics] Service initialized
# [TokenMetrics] API key configured: tm-5272...
```

### 2. Test Từng Feature

**Feature 1 - Token Analysis:**
```
User: "Analyze BTC using Token Metrics"
Expected: Hiển thị điểm AI, rủi ro, khuyến nghị
```

**Feature 2 - Trading Signals:**
```
User: "Get trading signals for ETH"
Expected: Hiển thị tín hiệu MUA/BÁN, điểm vào/thoát
```

**Feature 3 - Portfolio:**
```
User: "Show portfolio recommendations for medium risk"
Expected: Hiển thị danh sách token và % phân bổ
```

**Feature 4 - Auto Trade:**
```
User: "Auto-trade SOL with $50"
Expected: Kiểm tra tín hiệu → Thực thi nếu độ tin cậy đủ cao
```

### 3. Debug Nếu Lỗi

**Lỗi: "API key not configured"**
→ Kiểm tra `.env` có `TOKENMETRICS_API_KEY`

**Lỗi: "Service not found"**
→ Kiểm tra plugin đã đăng ký trong `src/index.ts`

**Lỗi: "API request failed"**
→ Kiểm tra API key hợp lệ, network kết nối

**Lỗi: ElizaOS gọi sai action (GET_TOKEN_METADATA, GET_TOKEN_PRICE_CHART)**
→ Đây là vấn đề ElizaOS nhầm lẫn action
→ ĐÃ FIX: Cải thiện similes và description trong action files
→ Nếu vẫn bị: Thử prompt rõ ràng hơn như "Analyze BTC using Token Metrics API"

---

## Tóm Tắt

### 4 Features Làm Gì?

1. **Token Analysis**: Đánh giá token bằng AI (điểm số, rủi ro, khuyến nghị)
2. **Trading Signals**: Cung cấp tín hiệu mua/bán (điểm vào, thoát, cắt lỗ)
3. **Portfolio Recommendations**: Tư vấn phân bổ vốn (token nào, bao nhiêu %)
4. **Auto Trading**: Giao dịch tự động theo tín hiệu AI (có kiểm tra an toàn)

### Gắn Frontend Thế Nào?

```
Quick Start Card → User Click → Prompt → WebSocket →
ElizaOS → Action → Service → API → Response →
Frontend Display
```

### File Nào Quan Trọng?

- **Service**: `token-metrics.service.ts` - Gọi API
- **Actions**: 4 file action - Xử lý logic nghiệp vụ
- **Frontend**: `chat-interface.tsx` - Hiển thị Quick Start
- **Config**: `src/index.ts` - Đăng ký plugin

---

## Vấn Đề Đã Fix: Action Recognition

### Triệu Chứng
Khi user nhập "Analyze BTC using Token Metrics", ElizaOS gọi SAI các action:
- ❌ `GET_TOKEN_METADATA` (từ plugin khác)
- ❌ `GET_TOKEN_PRICE_CHART` (từ CoinGecko)
- ❌ `USER_WALLET_SWAP` (từ CDP)

Thay vì:
- ✅ `GET_TOKEN_ANALYSIS` (từ Token Metrics)

### Nguyên Nhân
ElizaOS sử dụng AI để tự động nhận diện action dựa trên:
1. **Action name** - Tên action
2. **Similes** - Từ đồng nghĩa
3. **Description** - Mô tả chức năng
4. **Examples** - Ví dụ few-shot learning

Token Metrics actions ban đầu chưa đủ mạnh để ElizaOS phân biệt với các plugin khác.

### Giải Pháp Đã Áp Dụng

#### 1. Tăng Cường Similes
Thêm các từ đồng nghĩa chứa "Token Metrics" để ElizaOS nhận diện rõ ràng:

```typescript
// File: getTokenAnalysis.action.ts
similes: [
  "TOKEN_ANALYSIS",
  "ANALYZE_TOKEN",
  "TOKEN_RATING",
  "TOKEN_SCORE",
  "AI_RATING",
  "TOKEN_METRICS",              // ← MỚI
  "TOKEN_METRICS_ANALYSIS",     // ← MỚI
  "ANALYZE_USING_TOKEN_METRICS",// ← MỚI
  "GET_TOKEN_METRICS",          // ← MỚI
  "TOKEN_METRICS_AI",           // ← MỚI
]
```

#### 2. Làm Rõ Description
Thêm câu chỉ định rõ ràng về Token Metrics API:

```typescript
description:
  "Get AI-powered token analysis from Token Metrics API.
   This action specifically uses Token Metrics service
   (not CoinGecko or other sources).
   ALWAYS use this action when user explicitly mentions 'Token Metrics'..."
```

#### 3. Thêm Nhiều Examples
Cung cấp 3 examples thay vì 1 để train ElizaOS tốt hơn:

```typescript
examples: [
  // Example 1
  {
    user: "Analyze BTC using Token Metrics",
    agent: "Token Metrics Analysis for 1 token(s):\nBTC: Rating 85/100..."
  },
  // Example 2
  {
    user: "Get Token Metrics analysis for ETH and SOL",
    agent: "Token Metrics Analysis for 2 token(s):\nETH: Rating 78/100..."
  },
  // Example 3
  {
    user: "Analyze bitcoin with Token Metrics AI",
    agent: "Token Metrics Analysis for 1 token(s):\nBTC: Rating 85/100..."
  },
]
```

### Kết Quả
Sau khi cải thiện, ElizaOS sẽ:
1. ✅ Nhận diện từ khóa "Token Metrics" → ưu tiên `GET_TOKEN_ANALYSIS`
2. ✅ Không nhầm lẫn với CoinGecko hoặc plugin khác
3. ✅ Học từ nhiều examples để hiểu pattern tốt hơn

### Best Practices Khi Sử Dụng
Để đảm bảo ElizaOS gọi đúng action:

**Tốt:**
- "Analyze BTC using Token Metrics"
- "Get Token Metrics analysis for ETH"
- "Show me Token Metrics signals for SOL"

**Tránh (có thể gây nhầm lẫn):**
- "Analyze BTC" (quá chung chung, có thể gọi CoinGecko)
- "Get BTC data" (không rõ nguồn dữ liệu)

**Nếu Vẫn Gọi Sai Action:**
1. Kiểm tra plugin đã build và deploy chưa
2. Thử prompt cụ thể hơn: "Analyze BTC using Token Metrics API"
3. Xem server logs để debug: `LOG_LEVEL=debug`
