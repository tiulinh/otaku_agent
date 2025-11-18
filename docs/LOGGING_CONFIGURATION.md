# Logging Configuration Guide

Hướng dẫn cấu hình logging cho Otaku Agent để kiểm soát mức độ hiển thị logs.

## Tổng quan

Hệ thống logging có 2 cấp độ kiểm soát:

1. **ElizaOS Core Logger** - Logs từ ElizaOS framework và các plugins
2. **Console Log Filter** - Bộ lọc tùy chỉnh trong `start-server.ts`

## Cấu hình ElizaOS Core Logger

### File: `.env`

```bash
# Logging level (default: info)
# Options: error, warn, info, debug
LOG_LEVEL="error"
```

### Các mức độ LOG_LEVEL:

| Mức độ | Mô tả | Khi nào dùng |
|--------|-------|--------------|
| `error` | Chỉ hiển thị lỗi nghiêm trọng | Production, khi muốn môi trường sạch sẽ |
| `warn` | Hiển thị cảnh báo và lỗi | Khi cần theo dõi vấn đề tiềm ẩn |
| `info` | Hiển thị thông tin chung + warn + error | Development bình thường |
| `debug` | Hiển thị tất cả logs chi tiết | Debug/troubleshooting |

### Ví dụ:

```bash
# Production mode - logs tối thiểu
LOG_LEVEL="error"

# Development mode - logs đầy đủ
LOG_LEVEL="debug"

# Balanced mode
LOG_LEVEL="info"
```

## Console Log Filter (Custom)

### File: `start-server.ts`

Bộ lọc này kiểm soát **chính xác** logs nào được hiển thị bằng cách override các console methods.

### Cấu hình hiện tại:

```typescript
const ALLOWED_KEYWORDS = [
  'Token Metrics',
  'TokenMetrics',
  'TOKEN_METRICS',
  'GET_TRADING_SIGNALS',
  'GET_TOKEN_ANALYSIS',
  'tmai-api',
  'Loading project from:', // Keep startup message
  'Started', // Keep startup message
  'Server with custom UI', // Keep startup message
];
```

### Cách chỉnh sửa bộ lọc:

#### 1. Hiển thị logs từ plugin cụ thể:

```typescript
const ALLOWED_KEYWORDS = [
  'Token Metrics',    // Token Metrics plugin
  'TokenMetrics',
  'CDP',             // Thêm CDP wallet logs
  'CoinGecko',       // Thêm CoinGecko logs
  'WebSocket',       // Thêm WebSocket logs
];
```

#### 2. Tắt hoàn toàn bộ lọc (hiển thị TẤT CẢ logs):

Thay thế toàn bộ phần log filtering bằng:

```typescript
// ============================================================
// LOG FILTERING: DISABLED - Show all logs
// ============================================================
// (Comment out hoặc xóa toàn bộ phần override console methods)
```

Hoặc đơn giản hơn, thay đổi hàm `shouldShowLog`:

```typescript
function shouldShowLog(args: any[]): boolean {
  return true; // Hiển thị tất cả
}
```

#### 3. Chỉ hiển thị logs lỗi (errors only):

```typescript
// Override chỉ console.log, info, warn - giữ nguyên error
console.log = (...args: any[]) => {
  if (shouldShowLog(args)) {
    originalConsoleLog(...args);
  }
};

console.info = (...args: any[]) => {
  if (shouldShowLog(args)) {
    originalConsoleInfo(...args);
  }
};

console.warn = (...args: any[]) => {
  if (shouldShowLog(args)) {
    originalConsoleWarn(...args);
  }
};

// KHÔNG override console.error - luôn hiển thị
// console.error = originalConsoleError; // Bỏ comment dòng này
```

## Token Metrics Plugin Debug Logs

### File: `src/plugins/plugin-token-metrics/src/actions/getTradingSignals.action.ts`

Các logs debug đã bị loại bỏ để giảm noise. Nếu cần bật lại:

### Logs có thể bật lại:

```typescript
// Line 22: Fetching data
console.log(`[Token Metrics] Fetching data for: ${symbols.join(", ")}`);

// Line 31: Retrieved tokens count
console.log(`[Token Metrics] ✅ Retrieved ${tokensResult.data.length} tokens`);

// Line 52: Latest price for each token
console.log(`[Token Metrics] Using latest price for token_id ${tokenId}: $${latestPrice.current_price}`);

// Line 65: Skipping invalid tokens
console.log(`[Token Metrics] Skipping token without symbol:`, token);

// Line 79: Filtering results
console.log(`[Token Metrics] Filtered ${tokensResult.data.length} tokens → ${filteredTokens.length} unique`);

// Line 81: Token details
console.log(`[Token Metrics] - ${t.token_symbol}: ${t.token_name} (market_cap: $${(t.market_cap / 1e9).toFixed(2)}B)`);

// Line 82-85: API endpoint calls
console.log(`[Token Metrics] Fetching resistanceSupport for ${symbol}...`);
console.log(`[Token Metrics] ✅ resistanceSupport for ${symbol}: Support=${...}, Resistance=${...}`);

// Line 90-93: Price prediction
console.log(`[Token Metrics] Fetching pricePrediction for ${symbol}...`);
console.log(`[Token Metrics] ✅ pricePrediction for ${symbol}: ${ppData.predicted_price}`);

// Line 128-133: Signal generation
console.log(`[Token Metrics] ${tokenSymbol} signal: ${signal} from ${signalSource}`);

// Line 151: Price targets
console.log(`[Token Metrics] Using resistanceSupport for ${tokenSymbol}: Target=$${targetPrice}, Stop=$${stopLoss}`);

// Line 159: Volatility calculation
console.log(`[Token Metrics] Using volatility-based calculation for ${tokenSymbol} (volatility: ${(volatility * 100).toFixed(2)}%)`);

// Line 167: Final signal
console.log(`[Token Metrics] ${tokenSymbol}: ${signal} at $${currentPrice.toFixed(2)} (${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%)`);
```

### Cách bật lại logs debug:

1. Mở file `src/plugins/plugin-token-metrics/src/actions/getTradingSignals.action.ts`
2. Uncomment hoặc thêm lại các dòng `console.log()` ở trên
3. Rebuild plugin:
   ```bash
   cd src/plugins/plugin-token-metrics
   bun run build
   cd ../../..
   bun run build:backend
   ```

## Các kịch bản sử dụng thường gặp

### 1. Production - Logs tối thiểu

**.env:**
```bash
LOG_LEVEL="error"
```

**start-server.ts:** Giữ nguyên bộ lọc hiện tại

**Kết quả:** Chỉ hiển thị lỗi nghiêm trọng và startup messages

---

### 2. Development - Logs đầy đủ

**.env:**
```bash
LOG_LEVEL="debug"
```

**start-server.ts:** Tắt bộ lọc
```typescript
function shouldShowLog(args: any[]): boolean {
  return true; // Hiển thị tất cả
}
```

**Kết quả:** Hiển thị mọi log từ ElizaOS và plugins

---

### 3. Debug Token Metrics Plugin only

**.env:**
```bash
LOG_LEVEL="error"  # Tắt ElizaOS logs
```

**start-server.ts:** Giữ nguyên bộ lọc (chỉ Token Metrics keywords)

**getTradingSignals.action.ts:** Bật lại các debug logs

**Kết quả:** Chỉ hiển thị logs từ Token Metrics plugin

---

### 4. Debug tất cả plugins

**.env:**
```bash
LOG_LEVEL="debug"
```

**start-server.ts:** Tắt bộ lọc hoặc thêm keywords cho tất cả plugins:
```typescript
const ALLOWED_KEYWORDS = [
  'Token Metrics',
  'CDP',
  'CoinGecko',
  'WebSearch',
  'DeFiLlama',
  'Relay',
  'Etherscan',
  // ... thêm các plugin khác
];
```

**Kết quả:** Hiển thị logs từ tất cả plugins được chỉ định

---

## Sau khi thay đổi cấu hình

### Chỉ thay đổi `.env`:
```bash
# Không cần rebuild, chỉ restart
bun run start
```

### Thay đổi `start-server.ts`:
```bash
# Không cần rebuild, chỉ restart
bun run start
```

### Thay đổi plugin code:
```bash
# Phải rebuild plugin + backend
cd src/plugins/plugin-token-metrics
bun run build
cd ../../..
bun run build:backend
bun run start
```

## Ghi chú

- **LOG_LEVEL** trong `.env` kiểm soát logs từ ElizaOS core (database, WebSocket, routing, etc.)
- **Console Filter** trong `start-server.ts` kiểm soát logs từ plugins và custom code
- Kết hợp cả 2 để có kiểm soát tốt nhất
- Để troubleshooting, nên bật `LOG_LEVEL="debug"` + tắt console filter
- Để production, nên dùng `LOG_LEVEL="error"` + bật console filter với keywords cần thiết

## Debug checklist

Khi gặp vấn đề và cần debug:

- [ ] Set `LOG_LEVEL="debug"` trong `.env`
- [ ] Tắt console filter trong `start-server.ts` (return true)
- [ ] Bật lại debug logs trong plugin code nếu cần
- [ ] Rebuild nếu có thay đổi code: `bun run build`
- [ ] Restart server: `bun run start`
- [ ] Quan sát logs để tìm vấn đề
- [ ] Sau khi fix, nhớ tắt debug mode lại
