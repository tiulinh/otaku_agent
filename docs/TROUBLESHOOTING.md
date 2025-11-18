# Otaku Agent - Troubleshooting Guide

## Lỗi 1: Stuck tại "Analyzing your request..."

### Triệu chứng:
- UI hiển thị "Analyzing your request..." và không bao giờ trả về kết quả
- Không có response từ agent
- Server không crash nhưng không xử lý được request

### Nguyên nhân:
1. **ElizaOS version không tương thích**:
   - Version không đúng gây conflict giữa các packages
   - Cần dùng ElizaOS 1.6.4 (version ổn định)

2. **API Key hết credit hoặc invalid**:
   - `OPENAI_API_KEY` hết credit hoặc bị revoke
   - `OPENROUTER_API_KEY` hết credit hoặc không còn hiệu lực
   - Model provider không thể gọi API được

### Cách fix:

#### Fix 1: Kiểm tra và đảm bảo ElizaOS version đúng

Mở `package.json` và kiểm tra version:

```json
{
  "dependencies": {
    "@elizaos/core": "1.6.4",
    "@elizaos/cli": "1.6.4",
    "@elizaos/plugin-sql": "1.6.4"
  }
}
```

**QUAN TRỌNG**: Không dùng `^` hoặc `latest` trước version number. Phải pin exact version `1.6.4`.

Nếu sai version, sửa lại và chạy:

```bash
bun install
bun run build
bun start
```

#### Fix 2: Kiểm tra API keys

Kiểm tra logs khi server khởi động:

```bash
tail -100 /tmp/otaku-server.log | grep -E "(OpenAI|OpenRouter|API key)"
```

Nên thấy:
```
✅ Log        OpenAI API key validated successfully
✅ Log        OpenRouter API key validated successfully
```

Nếu thấy lỗi validation, test API keys:

```bash
# Test OpenAI API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Test OpenRouter API key
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Nếu API key hết credit hoặc invalid:
1. Tạo API key mới từ dashboard
2. Update trong `.env`
3. Restart server

---

## Lỗi 2: Token Metrics không execute actions (No execution steps)

### Triệu chứng:
- Khi query "Analyze BTC Token Metrics", không có "execution steps" hiển thị trên UI
- Agent trả về mock data từ LLM knowledge thay vì gọi Token Metrics API thật
- Response giống như:
  ```
  BTC: Rating 85/100 | Risk Score 15/100 | Recommendation: BUY | Sentiment: BULLISH
  ```
  Nhưng KHÔNG có steps như:
  ```
  Step 1/6: GET_TOKEN_ANALYSIS - Completed
  Step 2/6: GET_TRADING_SIGNALS - Running...
  ```

### Nguyên nhân:
**OpenRouter proxy có function calling capability kém hơn OpenAI native API**.

Khi ElizaOS dùng OpenRouter:
- AI model ít trigger actions hơn
- Xu hướng tự trả lời thay vì gọi functions
- Function calling không ổn định

Khi dùng OpenAI native API:
- Function calling hoạt động tốt hơn nhiều
- AI chủ động gọi actions khi cần
- Execution steps hiển thị rõ ràng

### Cách fix:

#### Bước 1: Thêm `modelProvider` vào character

Mở `src/character.ts` và thêm `modelProvider: 'openai'`:

```typescript
export const character: Character = {
  name: 'Otaku',
  plugins: [],
  modelProvider: 'openai',  // <-- THÊM DÒNG NÀY
  settings: {
    secrets: {},
    avatar: '/avatars/otaku.png',
    mcp: {
      // ... mcp config
    }
  },
  system: `You are Otaku...`,
  // ... rest of character config
};
```

#### Bước 2: Thêm OpenAI model config vào .env

Mở `.env` và thêm:

```bash
# OpenAI model selection (native API with better function calling)
OPENAI_SMALL_MODEL="gpt-4o-mini"
OPENAI_LARGE_MODEL="gpt-4o"
```

**QUAN TRỌNG**: Phải có cả 2 biến `OPENAI_SMALL_MODEL` và `OPENAI_LARGE_MODEL`, nếu không ElizaOS sẽ fallback về OpenRouter.

File `.env` đầy đủ nên có:

```bash
# AI Model API Keys (at least one required)
OPENAI_API_KEY="sk-proj-..."
OPENROUTER_API_KEY="sk-or-v1-..."

# OpenAI model selection (native API with better function calling)
OPENAI_SMALL_MODEL="gpt-4o-mini"
OPENAI_LARGE_MODEL="gpt-4o"

# OpenRouter model selection (backup)
OPENROUTER_SMALL_MODEL="openai/gpt-4o-mini"
OPENROUTER_LARGE_MODEL="openai/gpt-4o-mini"
```

#### Bước 3: Rebuild và restart

```bash
bun run build
bun start
```

#### Bước 4: Xác nhận fix thành công

Kiểm tra logs khi server khởi động:

```bash
tail -100 /tmp/otaku-server.log | grep -E "(OpenAI|model.*gpt)"
```

Nên thấy:
```
✅ Log        OpenAI API key validated successfully
✅ Debug      [OpenAI] Generating text with TEXT_LARGE model: gpt-4o-mini
```

**KHÔNG** nên thấy:
```
❌ Debug      [OpenRouter] Generating text with TEXT_LARGE model: openai/gpt-4o-mini
```

Test lại với query "Analyze BTC Token Metrics", bây giờ nên thấy execution steps:

```
Step 1/6: GET_TOKEN_ANALYSIS - Completed
Step 2/6: GET_TRADING_SIGNALS - Running...
```

### Lưu ý về GET_TRADING_SIGNALS Error:

Nếu thấy lỗi:
```
Step 2/6: GET_TRADING_SIGNALS - Error
```

Đây là do **Token Metrics free tier không support trading signals API**. Có 3 options:

1. **Upgrade Token Metrics account** lên paid tier
2. **Chỉ dùng GET_TOKEN_ANALYSIS** (đã đủ thông tin cơ bản: rating, risk score, sentiment, recommendation)
3. **Update code để handle free tier gracefully** (không retry nhiều lần khi biết API không support)

---

## Debugging Tips

### 1. Kiểm tra server logs

```bash
# Theo dõi logs real-time
tail -f /tmp/otaku-server.log

# Lọc logs cho Token Metrics
tail -f /tmp/otaku-server.log | grep -E "(TOKEN|ANALYSIS|SIGNAL)"

# Kiểm tra model provider đang dùng
tail -100 /tmp/otaku-server.log | grep -E "(OpenAI|OpenRouter)"
```

### 2. Test API keys manually

```bash
# Test OpenAI
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'

# Test Token Metrics
curl https://api.tokenmetrics.com/v2/tokens \
  -H "api_key: $TOKENMETRICS_API_KEY" \
  -H "Content-Type: application/json"
```

### 3. Verify ElizaOS packages

```bash
# Kiểm tra installed versions
bun pm ls | grep @elizaos

# Should see:
# @elizaos/core@1.6.4
# @elizaos/cli@1.6.4
# @elizaos/plugin-sql@1.6.4
```

### 4. Clean rebuild

Nếu vẫn gặp vấn đề, thử clean rebuild:

```bash
# Clean everything
rm -rf node_modules dist .eliza
rm bun.lock

# Fresh install
bun install
bun run build
bun start
```

---

## Railway vs Local Differences

Nếu code chạy tốt trên Railway nhưng local bị lỗi, kiểm tra:

1. **Environment variables**: So sánh Railway variables với local `.env`
2. **ElizaOS versions**: Đảm bảo cùng version `1.6.4`
3. **Model provider**: Railway có thể dùng OpenAI native, local dùng OpenRouter
4. **API keys**: Railway có thể có paid API keys, local có thể dùng free tier

Command để compare:

```bash
# Check Railway commit
git show <railway-commit-hash>:package.json | grep elizaos

# Check local
cat package.json | grep elizaos

# Compare character.ts
git diff <railway-commit-hash> HEAD -- src/character.ts
```

---

## Quick Fix Checklist

Khi gặp vấn đề, làm theo checklist này:

- [ ] ElizaOS version = 1.6.4 (không có `^` hoặc `latest`)
- [ ] `OPENAI_API_KEY` còn credit và valid
- [ ] `OPENROUTER_API_KEY` còn credit và valid
- [ ] `src/character.ts` có `modelProvider: 'openai'`
- [ ] `.env` có `OPENAI_SMALL_MODEL="gpt-4o-mini"`
- [ ] `.env` có `OPENAI_LARGE_MODEL="gpt-4o"`
- [ ] Đã chạy `bun run build` sau khi sửa code
- [ ] Đã restart server sau khi sửa `.env`
- [ ] Server logs hiển thị "OpenAI API key validated successfully"
- [ ] Server logs KHÔNG hiển thị "OpenRouter Generating text"

Nếu tất cả đều OK mà vẫn lỗi, check Discord/GitHub issues của ElizaOS.
