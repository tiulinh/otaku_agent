/**
 * Otaku Agent Client
 *
 * Client library để sử dụng Otaku AI Agent từ dự án khác
 * với thanh toán tự động qua x402 protocol
 *
 * API Endpoint: https://www.daugianft.site/api/messaging/jobs
 * Price: $0.015 USDC per request
 * Network: Base Mainnet
 */

import { createWalletClient, http, type WalletClient } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';

// ============================================================================
// TYPES
// ============================================================================

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
}

export interface CreateJobRequest {
  prompt: string;
  agentId?: string;
  timeoutMs?: number; // Default: 180000 (3 minutes), Max: 300000 (5 minutes)
  metadata?: Record<string, any>;
}

export interface CreateJobResponse {
  jobId: string;
  status: JobStatus;
  createdAt: number;
  expiresAt: number;
}

export interface JobDetailsResponse {
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
      content: string;
      authorId: string;
      createdAt: number;
    };
    processingTimeMs: number;
  };
  error?: string;
  metadata?: Record<string, any>;
}

export interface OtakuClientConfig {
  privateKey: `0x${string}`;
  apiUrl?: string; // Default: https://www.daugianft.site
  maxPayment?: bigint; // Default: 20000 (0.02 USDC with buffer)
  pollInterval?: number; // Default: 2000ms
  maxPollAttempts?: number; // Default: 100 (supports 3-minute timeout)
}

export interface PaymentInfo {
  transaction: string;
  payer: string;
  network: string;
  amount: string;
}

// ============================================================================
// OTAKU CLIENT CLASS
// ============================================================================

export class OtakuClient {
  private walletClient: WalletClient;
  private fetchWithPayment: typeof fetch;
  private apiUrl: string;
  private pollInterval: number;
  private maxPollAttempts: number;

  constructor(config: OtakuClientConfig) {
    // Setup wallet
    const account = privateKeyToAccount(config.privateKey);
    this.walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(),
    });

    // Configuration
    this.apiUrl = config.apiUrl || 'https://www.daugianft.site';
    const maxPayment = config.maxPayment || BigInt(20_000); // 0.02 USDC
    this.pollInterval = config.pollInterval || 2000;
    this.maxPollAttempts = config.maxPollAttempts || 100;

    // Wrap fetch with payment capability
    this.fetchWithPayment = wrapFetchWithPayment(
      fetch,
      this.walletClient,
      maxPayment
    );
  }

  /**
   * Tạo một job mới với payment tự động
   */
  async createJob(request: CreateJobRequest): Promise<CreateJobResponse> {
    const response = await this.fetchWithPayment(`${this.apiUrl}/api/messaging/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create job: ${error.error || response.statusText}`);
    }

    // Extract payment info if available
    const paymentHeader = response.headers.get('x-payment-response');
    if (paymentHeader) {
      const paymentInfo = this.parsePaymentInfo(paymentHeader);
      console.log('✅ Payment successful:');
      console.log(`   Transaction: ${paymentInfo.transaction}`);
      console.log(`   View on BaseScan: https://basescan.org/tx/${paymentInfo.transaction}`);
    }

    return await response.json();
  }

  /**
   * Lấy thông tin chi tiết của job
   */
  async getJob(jobId: string): Promise<JobDetailsResponse> {
    const response = await fetch(`${this.apiUrl}/api/messaging/jobs/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get job: ${error.error || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Đợi job hoàn thành và trả về kết quả
   */
  async waitForCompletion(jobId: string): Promise<string> {
    console.log(`⏳ Waiting for job ${jobId} to complete...`);

    for (let i = 0; i < this.maxPollAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));

      const job = await this.getJob(jobId);

      console.log(`   [${i + 1}/${this.maxPollAttempts}] Status: ${job.status}`);

      if (job.status === JobStatus.COMPLETED) {
        if (!job.result) {
          throw new Error('Job completed but no result available');
        }
        console.log(`✅ Job completed in ${job.result.processingTimeMs}ms`);
        return job.result.message.content;
      }

      if (job.status === JobStatus.FAILED) {
        throw new Error(`Job failed: ${job.error || 'Unknown error'}`);
      }

      if (job.status === JobStatus.TIMEOUT) {
        throw new Error('Job timed out waiting for agent response');
      }
    }

    throw new Error('Polling timeout - job may still be processing');
  }

  /**
   * Tạo job và đợi kết quả (one-shot)
   */
  async ask(prompt: string, options?: Partial<CreateJobRequest>): Promise<string> {
    console.log(`🤖 Asking Otaku: "${prompt}"`);

    // Create job with payment
    const job = await this.createJob({
      prompt,
      ...options,
    });

    console.log(`📝 Job created: ${job.jobId}`);

    // Wait for completion
    return await this.waitForCompletion(job.jobId);
  }

  /**
   * Parse payment info từ response header
   */
  private parsePaymentInfo(headerValue: string): PaymentInfo {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  }

  /**
   * Lấy địa chỉ wallet của client
   */
  getWalletAddress(): string {
    return this.walletClient.account.address;
  }

  /**
   * Check health của API
   */
  async health(): Promise<any> {
    const response = await fetch(`${this.apiUrl}/api/messaging/jobs/health`);
    if (!response.ok) {
      throw new Error('Health check failed');
    }
    return await response.json();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Tạo Otaku client instance
 */
export function createOtakuClient(config: OtakuClientConfig): OtakuClient {
  return new OtakuClient(config);
}

/**
 * Quick ask function (không cần tạo client instance)
 */
export async function askOtaku(
  prompt: string,
  privateKey: `0x${string}`,
  options?: Partial<CreateJobRequest>
): Promise<string> {
  const client = new OtakuClient({ privateKey });
  return await client.ask(prompt, options);
}
