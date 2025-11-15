# Token Metrics API Documentation

## Tổng quan

Token Metrics là dịch vụ phân tích crypto sử dụng AI, cung cấp trading signals, ratings, và predictions cho hơn 6,000+ tokens. SDK: `tmai-api` (TypeScript).

**API Key:** `TOKENMETRICS_API_KEY` trong `.env`

---

## 1. Các API hiện có trong dự án

### 1.1 `tokens.get()`
**Endpoint:** `/v2/tokens`
**Plan:** ✅ FREE | ✅ PAID

#### Mô tả:
Lấy thông tin cơ bản về token: tên, symbol, giá, market cap, volume.

#### Khi nào kích hoạt:
- User hỏi "Analyze BTC using Token Metrics"
- Action `GET_TRADING_SIGNALS` được gọi
- Luôn được gọi đầu tiên để lấy token_id và metadata

#### Request:
```typescript
await client.tokens.get({ symbol: 'BTC,ETH,SOL' });
```

#### Response:
```json
{
  "success": true,
  "data": [
    {
      "token_id": 3375,
      "token_name": "Bitcoin",
      "token_symbol": "BTC",
      "current_price": 96849,
      "price_change_percentage_24h_in_currency": null,
      "market_cap": 1935277800000,
      "total_volume": 114858230000
    }
  ]
}
```

#### Ý nghĩa kết quả:
- `token_id`: ID nội bộ của Token Metrics (dùng để query các API khác)
- `current_price`: Giá hiện tại (có thể null)
- `price_change_percentage_24h_in_currency`: % thay đổi 24h (thường null ở free tier)
- `market_cap`: Vốn hóa thị trường (USD)
- `total_volume`: Volume giao dịch 24h (USD)

#### Vấn đề:
- API trả về **NHIỀU tokens** cùng symbol "BTC" (10+ tokens)
- Ví dụ: "ETH" trả về 3 tokens (Ethereum, Wormhole Bridged ETH, StarkGate Bridged ETH)
- Code filter để lấy token chính xác (market cap cao nhất) dựa theo logic:
  ```typescript
  // Group by symbol, keep only highest market cap
  const symbolToTokenMap = new Map();
  tokensResult.data.forEach((token) => {
    const symbol = token.token_symbol.toUpperCase();
    const existing = symbolToTokenMap.get(symbol);
    if (!existing || token.market_cap > existing.market_cap) {
      symbolToTokenMap.set(symbol, token);
    }
  });
  ```

---

### 1.2 `price.get()`
**Endpoint:** `/v2/price`
**Plan:** ✅ FREE | ✅ PAID

#### Mô tả:
Lấy lịch sử giá token theo ngày (historical price data).

#### Khi nào kích hoạt:
- Action `GET_TRADING_SIGNALS` gọi để lấy giá chính xác hơn
- Dùng để tính 24h price change (nếu cần)

#### Request:
```typescript
await client.price.get({ symbol: 'BTC' });
```

#### Response:
```json
{
  "success": true,
  "data": [
    {
      "token_id": 3375,
      "current_price": 96849,
      "timestamp": "2025-11-14T00:00:00.000Z"
    },
    {
      "token_id": 3375,
      "current_price": 102436,
      "timestamp": "2025-11-13T00:00:00.000Z"
    }
  ]
}
```

#### Ý nghĩa kết quả:
- Trả về **50 records** với nhiều ngày khác nhau
- Cần sort theo `timestamp` DESC để lấy giá MỚI NHẤT
- Dùng để tính volatility/price change

#### Xử lý trong code:
```typescript
// Group by token_id, sort by date DESC, pick latest non-null price
const latestPrice = sortedPrices.find(p => p.current_price !== null);
priceMap.set(tokenId, latestPrice.current_price);
```

---

### 1.3 `resistanceSupport.get()`
**Endpoint:** `/v2/resistance-support`
**Plan:** ❌ FREE | ✅ PAID

#### Mô tả:
Lấy mức kháng cự (resistance) và hỗ trợ (support) từ AI analysis.

#### Khi nào kích hoạt:
- Action `GET_TRADING_SIGNALS` TRY gọi (free tier → 401 error)
- Nếu PAID tier thành công → dùng cho Target/Stop Loss

#### Request:
```typescript
await client.resistanceSupport.get({ symbol: 'BTC' });
```

#### Response (PAID tier):
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "resistance": 105000,
      "support": 92000,
      "confidence": 85
    }
  ]
}
```

#### Response (FREE tier):
```json
❌ Error: 401 - You are not authorized to access this endpoint with your current plan.
```

#### Ý nghĩa kết quả:
- `resistance`: Mức giá kháng cự (khó vượt lên) → dùng làm **Target** cho BUY signal
- `support`: Mức giá hỗ trợ (khó giảm xuống) → dùng làm **Stop Loss** cho BUY signal
- `confidence`: Độ tin cậy của AI prediction (%)

#### Xử lý trong code:
```typescript
if (rsData && rsData.resistance && rsData.support) {
  targetPrice = signal === "BUY" ? rsData.resistance : rsData.support;
  stopLoss = signal === "BUY" ? rsData.support : rsData.resistance;
} else {
  // Fallback: use 2% default volatility
}
```

---

### 1.4 `pricePrediction.get()`
**Endpoint:** `/v2/price-prediction`
**Plan:** ❌ FREE | ✅ PAID

#### Mô tả:
Dự đoán giá token trong các kịch bản thị trường khác nhau (bullish, bearish, neutral).

#### Khi nào kích hoạt:
- Action `GET_TRADING_SIGNALS` TRY gọi (free tier → 401 error)
- Nếu PAID tier thành công → hiển thị thêm predicted price

#### Request:
```typescript
await client.pricePrediction.get({ symbol: 'BTC' });
```

#### Response (PAID tier):
```json
{
  "success": true,
  "data": [
    {
      "symbol": "BTC",
      "predicted_price": 110000,
      "scenario": "bullish",
      "confidence": 78
    }
  ]
}
```

#### Response (FREE tier):
```json
❌ Error: 401 - You are not authorized to access this endpoint with your current plan.
```

#### Ý nghĩa kết quả:
- `predicted_price`: Giá dự đoán (USD)
- `scenario`: Kịch bản thị trường (bullish/bearish/neutral)
- `confidence`: Độ tin cậy dự đoán (%)

#### Xử lý trong code:
```typescript
if (ppData && ppData.predicted_price) {
  predictionInfo = ` | Predicted: $${ppData.predicted_price}`;
}
// Chỉ hiển thị thêm vào reasoning, không ảnh hưởng Target/Stop
```

---

## 2. So sánh FREE vs PAID tier

| API | FREE tier | PAID tier | Mục đích |
|-----|-----------|-----------|----------|
| **tokens.get** | ✅ Có | ✅ Có | Lấy metadata token |
| **price.get** | ✅ Có | ✅ Có | Lấy giá historical |
| **resistanceSupport.get** | ❌ 401 | ✅ Có | Target/Stop Loss AI |
| **pricePrediction.get** | ❌ 401 | ✅ Có | Predicted price |

---

## 3. Kết quả hiển thị

### FREE tier (hiện tại):
```
🟢 BTC: BUY
Price: $96,899.00
Target: $99,806.00 (+3.0%)
Stop: $95,349.00 (-1.6%)
Confidence: 70%
Volume (24h): $114,924.8M
Market Cap: $1,936.44B
```

**Cách tính:**
- Entry: Từ `price.get()` (giá mới nhất)
- Target: `Entry × (1 + 0.02 × 1.5)` = Entry × 1.03
- Stop: `Entry × (1 - 0.02 × 0.8)` = Entry × 0.984
- Volatility: **2% default** (vì không có resistanceSupport)

### PAID tier (sau khi upgrade):
```
🟢 BTC: BUY
Price: $96,899.00
Target: $105,000.00 (resistance)
Stop: $92,000.00 (support)
Confidence: 85%
Predicted: $110,000.00
Volume (24h): $114,924.8M
Market Cap: $1,936.44B
```

**Cách tính:**
- Entry: Từ `price.get()`
- Target: Từ `resistanceSupport.resistance` (AI analysis)
- Stop: Từ `resistanceSupport.support` (AI analysis)
- Predicted: Từ `pricePrediction.predicted_price`

---

## 4. Ghi chú quan trọng

### 4.1 FREE tier limitations
❌ **Không sử dụng được:**
- `resistanceSupport.get()` → 401 error
- `pricePrediction.get()` → 401 error

✅ **Có thể sử dụng:**
- `tokens.get()` - metadata token
- `price.get()` - historical prices

**Workaround:**
- Dùng 2% default volatility thay vì resistance/support từ API
- Target/Stop vẫn hợp lý (+3% / -1.6%)

### 4.2 Khi nâng cấp lên PAID tier

**❓ Có cần sửa code không?**

**✅ KHÔNG CẦN!** Code đã được thiết kế future-proof:

```typescript
// Code tự động check và dùng API nếu có
if (rsData && rsData.resistance && rsData.support) {
  // PAID tier: use API data
  targetPrice = rsData.resistance;
  stopLoss = rsData.support;
} else {
  // FREE tier: fallback to 2% volatility
  targetPrice = currentPrice * 1.03;
  stopLoss = currentPrice * 0.984;
}
```

**Các bước sau khi upgrade:**
1. ✅ Không cần sửa code
2. ✅ Không cần rebuild
3. ✅ Chỉ cần update `TOKENMETRICS_API_KEY` trong Railway
4. ✅ Redeploy (hoặc đợi auto-deploy lần sau)
5. ✅ API tự động dùng resistanceSupport/pricePrediction

### 4.3 Test PAID tier

Sau khi upgrade, response sẽ tự động thay đổi:

**Console logs sẽ thấy:**
```
[Token Metrics] ✅ resistanceSupport for BTC: Support=$92000, Resistance=$105000
[Token Metrics] ✅ pricePrediction for BTC: $110000
[Token Metrics] Using resistanceSupport for BTC: Target=$105000, Stop=$92000
```

Thay vì:
```
[Token Metrics] ⚠️ resistanceSupport for BTC unavailable (401)
[Token Metrics] ⚠️ pricePrediction for BTC unavailable (401)
[Token Metrics] Using volatility-based calculation for BTC (volatility: 2.00%)
```

---

## 5. File liên quan

**Action:** `src/plugins/plugin-token-metrics/src/actions/getTradingSignals.action.ts`
- Line 25: `tokens.get()` call
- Line 34: `price.get()` call with latest price filtering (sort by timestamp DESC)
- Line 59-76: Token filtering logic (keep highest market cap per symbol)
- Line 84: `resistanceSupport.get()` call (with try-catch)
- Line 95: `pricePrediction.get()` call (with try-catch)
- Line 112-125: Logic chọn giữa API data vs volatility calculation (2% default)

**Environment:** `.env` / `.railway.env`
```bash
TOKENMETRICS_API_KEY="tm-5272ec22-454d-4143-b46d-6675e172ba92"
```

---

## 6. Tài liệu tham khảo

- **GitHub SDK:** https://github.com/token-metrics/tmai-api-sdk-typescript
- **Official Docs:** https://developers.tokenmetrics.com/
- **Pricing:** https://tokenmetrics.com/pricing

---

## 7. Case Study: "Analyze dogecoin using Token Metrics"

### User Input:
```
Analyze dogecoin using Token Metrics
```

### Hành vi của Agent:

Khi user gõ câu này, ElizaOS AI sẽ **kích hoạt 2 actions đồng thời**:

#### 1. **GET_TRADING_SIGNALS** (Trading Signals)
**Mục đích:** Lấy tín hiệu giao dịch (BUY/SELL) với entry, target, stop loss

**API calls:**
- `tokens.get({ symbol: 'DOGE' })` → Lấy metadata
- `price.get({ symbol: 'DOGE' })` → Lấy giá mới nhất
- `resistanceSupport.get({ symbol: 'DOGE' })` → TRY (401 ở free tier)
- `pricePrediction.get({ symbol: 'DOGE' })` → TRY (401 ở free tier)

**Output hiển thị:**
```
Token Metrics Analysis - 1 token(s):

🟢 DOGE: BUY
   Price: $0.385000 | Target: $0.396550 | Stop: $0.378840
   Confidence: 72% | Token Metrics: Dogecoin @ $0.385000 | 24h: +0.00% | Vol: $5234.5M | MCap: $56.78B
```

**Console logs:**
```
[Token Metrics] Fetching data for: DOGE
[Token Metrics] ✅ Retrieved 5 tokens
[Token Metrics] Filtered 5 tokens → 1 unique (highest market cap)
[Token Metrics] - DOGE: Dogecoin (token_id: 74, market_cap: $56.78B)
[Token Metrics] Using latest price for token_id 74: $0.385000 (2025-11-14)
[Token Metrics] ⚠️ resistanceSupport for DOGE unavailable (401)
[Token Metrics] ⚠️ pricePrediction for DOGE unavailable (401)
[Token Metrics] Using volatility-based calculation for DOGE (volatility: 2.00%)
```

---

#### 2. **GET_TOKEN_ANALYSIS** (Market Analysis)
**Mục đích:** Phân tích thị trường tổng quan (sentiment, metrics, fundamentals)

**Dữ liệu sử dụng:**
- Token Metrics API data từ GET_TRADING_SIGNALS
- CoinGecko API cho market data bổ sung
- Web search cho news/sentiment (nếu có)

**Output hiển thị:**
```
Dogecoin Market Analysis:

📊 Price & Performance:
- Current Price: $0.385000
- 24h Change: +0.00%
- Market Cap: $56.78B
- Volume (24h): $5,234.5M

🎯 Technical Analysis:
- Signal: BUY
- Entry: $0.385000
- Target: $0.396550 (+3.0%)
- Stop Loss: $0.378840 (-1.6%)
- Confidence: 72%

💡 Market Sentiment:
[Analysis from web search/CoinGecko data]
```

---

### Tại sao kích hoạt cả 2 actions?

**ElizaOS AI nhận diện intent:** "Analyze" + "Token Metrics" → User muốn cả trading signals VÀ market analysis

**GET_TRADING_SIGNALS** phù hợp vì:
- Description: "Get AI-powered trading signals... Use when user asks for trading signals... Also use when user mentions 'Token Metrics' with signals."
- Similes: `TOKEN_METRICS_SIGNALS`, `GET_TOKEN_METRICS_SIGNALS`

**GET_TOKEN_ANALYSIS** phù hợp vì:
- Description: "Analyze token fundamentals, market metrics, and sentiment"
- Similes: `ANALYZE_TOKEN`, `TOKEN_ANALYSIS`

**Kết quả:** Agent cung cấp **đầy đủ cả 2 góc độ**:
1. **Trading signals** (entry/exit points) từ Token Metrics
2. **Market analysis** (fundamentals, sentiment) từ nhiều nguồn

---

### So sánh với các prompt khác:

| User Prompt | Actions Triggered | Lý do |
|-------------|------------------|-------|
| "Get trading signals for DOGE" | GET_TRADING_SIGNALS only | Rõ ràng chỉ muốn signals |
| "Analyze DOGE" | GET_TOKEN_ANALYSIS only | Không mention Token Metrics |
| "Analyze DOGE using Token Metrics" | **BOTH** | "Analyze" + "Token Metrics" |
| "DOGE price prediction Token Metrics" | GET_TRADING_SIGNALS only | Focus vào prediction/signals |

---

*Cập nhật lần cuối: 2025-11-14*
