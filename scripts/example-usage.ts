#!/usr/bin/env bun
/**
 * Example: Sử dụng Otaku Client từ dự án khác
 *
 * Cách chạy:
 * 1. Tạo file .env với PRIVATE_KEY
 * 2. bun run scripts/example-usage.ts
 */

import { OtakuClient, createOtakuClient, askOtaku } from './otaku-client';

// ============================================================================
// CÁC VÍ DỤ SỬ DỤNG
// ============================================================================

/**
 * VÍ DỤ 1: Sử dụng OtakuClient class (khuyến nghị cho nhiều requests)
 */
async function example1_UsingClass() {
  console.log('\n========================================');
  console.log('VÍ DỤ 1: Sử dụng OtakuClient Class');
  console.log('========================================\n');

  // Tạo client instance
  const client = new OtakuClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    apiUrl: 'https://www.daugianft.site', // Optional, đây là default
    maxPayment: BigInt(20_000), // Optional, 0.02 USDC (có buffer)
  });

  console.log(`Wallet address: ${client.getWalletAddress()}\n`);

  // Check health
  try {
    const health = await client.health();
    console.log('API Health:', health);
  } catch (error) {
    console.error('Health check failed:', error);
    return;
  }

  // Gửi request đơn giản
  try {
    const answer = await client.ask(
      'What are the top 3 DeFi trends in 2024?'
    );
    console.log('\nAnswer:', answer);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * VÍ DỤ 2: Sử dụng helper function askOtaku (nhanh cho 1 request)
 */
async function example2_QuickAsk() {
  console.log('\n========================================');
  console.log('VÍ DỤ 2: Quick Ask Function');
  console.log('========================================\n');

  try {
    const answer = await askOtaku(
      'Summarize the latest news about Ethereum',
      process.env.PRIVATE_KEY as `0x${string}`
    );
    console.log('Answer:', answer);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * VÍ DỤ 3: Tạo job và theo dõi manually
 */
async function example3_ManualJobTracking() {
  console.log('\n========================================');
  console.log('VÍ DỤ 3: Manual Job Tracking');
  console.log('========================================\n');

  const client = new OtakuClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  try {
    // Tạo job
    const job = await client.createJob({
      prompt: 'Analyze Bitcoin price trends in the last 7 days',
      timeoutMs: 300000, // 5 minutes
      metadata: { source: 'example-script' },
    });

    console.log('Job created:');
    console.log(`  ID: ${job.jobId}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${new Date(job.createdAt).toISOString()}`);
    console.log(`  Expires: ${new Date(job.expiresAt).toISOString()}`);

    // Đợi kết quả
    const result = await client.waitForCompletion(job.jobId);
    console.log('\nResult:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * VÍ DỤ 4: Multiple requests với cùng một client
 */
async function example4_MultipleRequests() {
  console.log('\n========================================');
  console.log('VÍ DỤ 4: Multiple Requests');
  console.log('========================================\n');

  const client = new OtakuClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  const questions = [
    'What is the current state of AI in blockchain?',
    'Explain DeFi yield farming in simple terms',
    'What are the risks of using DEX vs CEX?',
  ];

  for (const question of questions) {
    try {
      console.log(`\nQuestion: ${question}`);
      const answer = await client.ask(question);
      console.log(`Answer: ${answer.substring(0, 200)}...`);
    } catch (error) {
      console.error(`Error for "${question}":`, error);
    }
  }
}

/**
 * VÍ DỤ 5: Error handling
 */
async function example5_ErrorHandling() {
  console.log('\n========================================');
  console.log('VÍ DỤ 5: Error Handling');
  console.log('========================================\n');

  const client = new OtakuClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  });

  // Test với prompt rỗng (sẽ lỗi)
  try {
    await client.createJob({ prompt: '' });
  } catch (error) {
    console.log('✅ Caught expected error for empty prompt:', (error as Error).message);
  }

  // Test với job ID không tồn tại
  try {
    await client.getJob('00000000-0000-0000-0000-000000000000');
  } catch (error) {
    console.log('✅ Caught expected error for invalid job ID:', (error as Error).message);
  }
}

/**
 * VÍ DỤ 6: Sử dụng trong dự án thực tế
 */
async function example6_RealWorldUsage() {
  console.log('\n========================================');
  console.log('VÍ DỤ 6: Real World Usage Pattern');
  console.log('========================================\n');

  // Tạo singleton client cho toàn bộ app
  const otakuClient = createOtakuClient({
    privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    apiUrl: process.env.OTAKU_API_URL || 'https://www.daugianft.site',
  });

  // Hàm wrapper cho business logic
  async function analyzeMarket(symbol: string) {
    const prompt = `Analyze the current market sentiment for ${symbol}. Include:
1. Recent price action
2. Key support/resistance levels
3. Overall sentiment (bullish/bearish)
4. Short-term outlook`;

    try {
      const analysis = await otakuClient.ask(prompt, {
        metadata: { symbol, type: 'market-analysis' },
      });
      return { success: true, data: analysis };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Sử dụng
  const result = await analyzeMarket('BTC');
  if (result.success) {
    console.log('Market Analysis:', result.data);
  } else {
    console.error('Analysis failed:', result.error);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Validate environment
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ Error: PRIVATE_KEY not found in environment variables');
    console.log('\nPlease set PRIVATE_KEY in your .env file:');
    console.log('PRIVATE_KEY=0x...');
    process.exit(1);
  }

  console.log('🤖 Otaku Client Examples\n');
  console.log('API: https://www.daugianft.site/api/messaging/jobs');
  console.log('Price: $0.015 USDC per request');
  console.log('Network: Base Mainnet');

  // Chọn example để chạy
  const exampleToRun = process.argv[2] || '1';

  switch (exampleToRun) {
    case '1':
      await example1_UsingClass();
      break;
    case '2':
      await example2_QuickAsk();
      break;
    case '3':
      await example3_ManualJobTracking();
      break;
    case '4':
      await example4_MultipleRequests();
      break;
    case '5':
      await example5_ErrorHandling();
      break;
    case '6':
      await example6_RealWorldUsage();
      break;
    case 'all':
      await example1_UsingClass();
      await example2_QuickAsk();
      await example3_ManualJobTracking();
      await example5_ErrorHandling();
      await example6_RealWorldUsage();
      break;
    default:
      console.log('\nUsage: bun run scripts/example-usage.ts [1|2|3|4|5|6|all]');
      console.log('\n1: Using OtakuClient Class');
      console.log('2: Quick Ask Function');
      console.log('3: Manual Job Tracking');
      console.log('4: Multiple Requests');
      console.log('5: Error Handling');
      console.log('6: Real World Usage Pattern');
      console.log('all: Run all examples');
      break;
  }

  console.log('\n✅ Done!\n');
}

main().catch(console.error);
