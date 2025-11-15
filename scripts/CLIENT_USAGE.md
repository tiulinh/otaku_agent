# Hướng Dẫn Sử Dụng Otaku Agent API

Tài liệu này hướng dẫn cách sử dụng Otaku Agent từ dự án khác với thanh toán tự động qua x402 protocol.

## 📋 Thông Tin API

- **URL**: `https://www.daugianft.site/api/messaging/jobs`
- **Giá**: $0.015 USDC per request
- **Network**: Base Mainnet
- **Payment**: Tự động qua x402 protocol
- **Timeout**: 3 phút (default), tối đa 5 phút

## 🚀 Quick Start

### 1. Cài Đặt Dependencies

Trong dự án của bạn:

```bash
# Nếu dùng npm
npm install viem x402-fetch

# Nếu dùng bun
bun add viem x402-fetch
```

### 2. Chuẩn Bị Wallet

Bạn cần:
- ✅ Private key của wallet
- ✅ USDC trên Base Mainnet (tối thiểu $0.02)
- ✅ Một ít ETH cho gas fees

**USDC Contract trên Base**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Bridge USDC lên Base: [bridge.base.org](https://bridge.base.org)

### 3. Setup Environment Variables

Tạo file `.env`:

```bash
PRIVATE_KEY=0x...your-private-key...
```

### 4. Copy Client Code

Copy file `otaku-client.ts` vào dự án của bạn:

```bash
# Copy từ repo này
cp scripts/otaku-client.ts your-project/src/lib/
```

## 💡 Cách Sử Dụng

### Cách 1: Sử dụng OtakuClient Class (Khuyến nghị)

```typescript
import { OtakuClient } from './lib/otaku-client';

// Tạo client instance
const client = new OtakuClient({
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  apiUrl: 'https://www.daugianft.site', // Optional
});

// Gửi request và nhận kết quả
const answer = await client.ask('What are the top 3 DeFi trends?');
console.log(answer);
```

### Cách 2: Quick Ask Function

```typescript
import { askOtaku } from './lib/otaku-client';

const answer = await askOtaku(
  'Explain DeFi yield farming',
  process.env.PRIVATE_KEY as `0x${string}`
);
```

### Cách 3: Manual Job Tracking

```typescript
// Tạo job
const job = await client.createJob({
  prompt: 'Analyze Bitcoin price trends',
  timeoutMs: 300000, // 5 minutes
  metadata: { source: 'my-app' }
});

console.log(`Job ID: ${job.jobId}`);

// Đợi kết quả
const result = await client.waitForCompletion(job.jobId);
console.log(result);
```

## 🔧 API Reference

### OtakuClient Class

#### Constructor

```typescript
new OtakuClient(config: OtakuClientConfig)
```

**Config Options:**
- `privateKey` (required): Private key của wallet
- `apiUrl` (optional): API URL, default: `https://www.daugianft.site`
- `maxPayment` (optional): Max payment per request, default: 20000 (0.02 USDC)
- `pollInterval` (optional): Polling interval ms, default: 2000
- `maxPollAttempts` (optional): Max poll attempts, default: 100

#### Methods

##### `ask(prompt: string, options?: Partial<CreateJobRequest>): Promise<string>`

Tạo job và đợi kết quả (one-shot).

```typescript
const answer = await client.ask('Your question here');
```

##### `createJob(request: CreateJobRequest): Promise<CreateJobResponse>`

Tạo một job mới.

```typescript
const job = await client.createJob({
  prompt: 'Your question',
  timeoutMs: 180000, // 3 minutes
  metadata: { key: 'value' }
});
```

##### `getJob(jobId: string): Promise<JobDetailsResponse>`

Lấy thông tin chi tiết của job.

```typescript
const jobDetails = await client.getJob(jobId);
```

##### `waitForCompletion(jobId: string): Promise<string>`

Đợi job hoàn thành và trả về kết quả.

```typescript
const result = await client.waitForCompletion(jobId);
```

##### `health(): Promise<any>`

Check health của API.

```typescript
const health = await client.health();
console.log(health);
```

##### `getWalletAddress(): string`

Lấy địa chỉ wallet.

```typescript
const address = client.getWalletAddress();
```

## 📊 Response Types

### CreateJobResponse

```typescript
{
  jobId: string;           // UUID của job
  status: JobStatus;       // 'pending' | 'processing' | 'completed' | 'failed' | 'timeout'
  createdAt: number;       // Timestamp (ms)
  expiresAt: number;       // Timestamp (ms)
}
```

### JobDetailsResponse

```typescript
{
  jobId: string;
  status: JobStatus;
  agentId: string;
  userId: string;
  prompt: string;
  createdAt: number;
  expiresAt: number;
  result?: {
    message: {
      id: string;
      content: string;     // Câu trả lời từ agent
      authorId: string;
      createdAt: number;
    };
    processingTimeMs: number;
  };
  error?: string;
  metadata?: Record<string, any>;
}
```

## 🎯 Use Cases

### 1. Research Assistant

```typescript
const client = new OtakuClient({ privateKey: process.env.PRIVATE_KEY as `0x${string}` });

async function researchTopic(topic: string) {
  const answer = await client.ask(
    `Research the latest developments in ${topic} and summarize the key findings.`
  );
  return answer;
}

const result = await researchTopic('AI in blockchain');
```

### 2. News Summarization

```typescript
async function getNewsSummary(category: string) {
  return await client.ask(
    `Summarize today's top news in ${category} from major sources.`
  );
}

const techNews = await getNewsSummary('technology');
```

### 3. Data Analysis

```typescript
async function analyzeMarket(symbol: string) {
  return await client.ask(
    `Analyze the market sentiment for ${symbol}. Include price trends and outlook.`
  );
}

const btcAnalysis = await analyzeMarket('BTC');
```

### 4. Batch Processing

```typescript
const questions = [
  'What is DeFi?',
  'Explain yield farming',
  'Compare DEX vs CEX'
];

for (const question of questions) {
  const answer = await client.ask(question);
  console.log(`Q: ${question}`);
  console.log(`A: ${answer}\n`);
}
```

## ⚠️ Error Handling

```typescript
try {
  const answer = await client.ask('Your question');
  console.log(answer);
} catch (error) {
  if (error.message.includes('Payment Required')) {
    console.error('Không đủ USDC hoặc payment failed');
  } else if (error.message.includes('timeout')) {
    console.error('Job timeout - câu hỏi quá phức tạp hoặc server busy');
  } else {
    console.error('Error:', error.message);
  }
}
```

## 💰 Payment Flow

1. **Tạo request** → Client gọi API với `x402-fetch`
2. **402 Response** → Server trả về payment details
3. **Auto Payment** → `x402-fetch` tự động:
   - Sign USDC payment transaction
   - Submit lên Base network
   - Retry request với proof of payment
4. **Process** → Server verify payment và xử lý request
5. **Response** → Nhận kết quả + payment receipt

Payment receipt nằm trong header `x-payment-response`:

```typescript
const paymentHeader = response.headers.get('x-payment-response');
if (paymentHeader) {
  const payment = JSON.parse(
    Buffer.from(paymentHeader, 'base64').toString('utf-8')
  );
  console.log('TX:', payment.transaction);
  console.log('View on BaseScan:', `https://basescan.org/tx/${payment.transaction}`);
}
```

## 🔍 Troubleshooting

### Payment Failed (402 Error)

✅ Check:
- Wallet có đủ USDC ($0.015 + buffer)?
- Đúng network (Base mainnet)?
- Private key đúng format `0x...`?
- Đang dùng `x402-fetch` (KHÔNG phải `x402-axios`)?

### Job Timeout

✅ Solutions:
- Tăng `timeoutMs` lên 300000 (5 phút)
- Đơn giản hóa câu hỏi
- Retry với prompt khác

### No Response

✅ Check:
- API health: `await client.health()`
- Network connection
- Server logs

## 🧪 Testing

Chạy example scripts:

```bash
# Tất cả examples
bun run scripts/example-usage.ts all

# Example cụ thể
bun run scripts/example-usage.ts 1
bun run scripts/example-usage.ts 2
```

## 📚 Resources

- **API Documentation**: [docs/x402-payments.md](../docs/x402-payments.md)
- **x402 Protocol**: [x402.gitbook.io](https://x402.gitbook.io/x402)
- **Base Network**: [base.org](https://base.org)
- **Bridge USDC**: [bridge.base.org](https://bridge.base.org)

## 🆘 Support

Nếu gặp vấn đề:
1. Check API health endpoint
2. Verify USDC balance trên Base
3. Review error messages
4. Check BaseScan cho payment transactions

---

**Ready to integrate?** Copy `otaku-client.ts` vào dự án và bắt đầu! 🚀
