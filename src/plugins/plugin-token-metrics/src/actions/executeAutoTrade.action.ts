import {
  Action,
  ActionResult,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  logger,
} from "@elizaos/core";
import { TokenMetricsService, TradingSignal } from "../services/token-metrics.service";

export const executeAutoTradeAction: Action = {
  name: "EXECUTE_AUTO_TRADE",
  similes: [
    "AUTO_TRADE",
    "EXECUTE_TRADE",
    "AUTO_BUY",
    "AUTO_SELL",
    "TRADE_ON_SIGNAL",
  ],
  description:
    "Automatically execute buy/sell trades based on Token Metrics signals. CRITICAL: This action executes real blockchain transactions with real money. Only use when user explicitly requests auto-trading or confirms they want to trade based on AI signals. Always verify signal strength and user confirmation before executing.",

  parameters: {
    symbol: {
      type: "string",
      description: "Token symbol to trade (e.g., 'ETH', 'BTC')",
      required: true,
    },
    amount_usd: {
      type: "string",
      description: "Amount in USD to trade (e.g., '100')",
      required: true,
    },
    min_confidence: {
      type: "string",
      description: "Minimum signal confidence threshold (0-100). Default: 70. Only execute if signal confidence is above this level.",
      required: false,
    },
  },

  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const tmSvc = runtime.getService(TokenMetricsService.serviceType) as TokenMetricsService | undefined;
    if (!tmSvc) {
      logger.error("TokenMetricsService not available");
      return false;
    }
    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: any,
    callback?: HandlerCallback,
  ): Promise<ActionResult> => {
    try {
      const tmSvc = runtime.getService(TokenMetricsService.serviceType) as TokenMetricsService | undefined;
      if (!tmSvc) {
        throw new Error("TokenMetricsService not available");
      }

      const composedState = await runtime.composeState(message, ["ACTION_STATE"], true);
      const actionParams = composedState?.data?.actionParams as Record<string, string | undefined> | undefined;

      const symbol = actionParams?.symbol?.toUpperCase();
      const amountUsdRaw = actionParams?.amount_usd;
      const minConfidenceRaw = actionParams?.min_confidence || "70";

      if (!symbol || !amountUsdRaw) {
        const errorMsg = "Missing required parameters 'symbol' and 'amount_usd'.";
        logger.error(`[EXECUTE_AUTO_TRADE] ${errorMsg}`);
        return {
          text: errorMsg,
          success: false,
          error: "missing_required_parameter",
        };
      }

      const amountUsd = parseFloat(amountUsdRaw);
      const minConfidence = parseFloat(minConfidenceRaw);

      if (isNaN(amountUsd) || amountUsd <= 0) {
        const errorMsg = "Invalid amount_usd. Must be a positive number.";
        logger.error(`[EXECUTE_AUTO_TRADE] ${errorMsg}`);
        return {
          text: errorMsg,
          success: false,
          error: "invalid_parameter",
        };
      }

      logger.info(`[EXECUTE_AUTO_TRADE] Evaluating auto-trade for ${symbol}, amount: $${amountUsd}`);

      // Step 1: Get trading signal
      const signals: TradingSignal[] = await tmSvc.getTradingSignals([symbol]);
      const signal = signals[0];

      if (!signal) {
        const errorMsg = `No trading signal available for ${symbol}.`;
        logger.error(`[EXECUTE_AUTO_TRADE] ${errorMsg}`);
        return {
          text: errorMsg,
          success: false,
          error: "no_signal",
        };
      }

      // Step 2: Check signal confidence
      if (signal.confidence < minConfidence) {
        const warningMsg = `Signal confidence (${signal.confidence.toFixed(0)}%) is below threshold (${minConfidence.toFixed(0)}%). Trade NOT executed for safety.`;
        logger.warn(`[EXECUTE_AUTO_TRADE] ${warningMsg}`);

        if (callback) {
          await callback({
            text: warningMsg,
            content: {
              signal,
              reason: "low_confidence",
              threshold: minConfidence,
            },
          });
        }

        return {
          text: warningMsg,
          success: false,
          error: "low_confidence",
          data: { signal },
        };
      }

      // Step 3: Check if signal is actionable (BUY or SELL, not HOLD)
      if (signal.signal === "HOLD") {
        const msg = `Signal for ${symbol} is HOLD. No trade executed.`;
        logger.info(`[EXECUTE_AUTO_TRADE] ${msg}`);

        if (callback) {
          await callback({
            text: msg,
            content: { signal },
          });
        }

        return {
          text: msg,
          success: true,
          data: { signal },
        };
      }

      // Step 4: Execute trade via CDP (this would integrate with CDP swap action)
      const tradeAction = signal.signal;
      const summaryMsg = `
🤖 Auto-Trade Signal Detected for ${symbol}:

Signal: ${tradeAction}
Entry Price: $${signal.entryPrice.toFixed(2)}
Target Price: $${signal.targetPrice.toFixed(2)}
Stop Loss: $${signal.stopLoss.toFixed(2)}
Confidence: ${signal.confidence.toFixed(0)}%
Amount: $${amountUsd}

⚠️ IMPLEMENTATION NOTE:
This action would integrate with CDP SWAP action to execute the trade.
For safety, actual trade execution is NOT implemented in this initial version.
User should manually execute based on signal, or you can integrate with existing CDP swap functionality.

Reasoning: ${signal.reasoning}
      `.trim();

      logger.info(`[EXECUTE_AUTO_TRADE] Signal summary:\n${summaryMsg}`);

      if (callback) {
        await callback({
          text: summaryMsg,
          actions: ["EXECUTE_AUTO_TRADE"],
          content: {
            signal,
            action: tradeAction,
            amount_usd: amountUsd,
            status: "signal_ready",
          },
          source: message.content.source,
        });
      }

      return {
        text: summaryMsg,
        success: true,
        data: {
          signal,
          action: tradeAction,
          amount_usd: amountUsd,
        },
        values: {
          symbol,
          action: tradeAction,
          confidence: signal.confidence,
          entry: signal.entryPrice,
          target: signal.targetPrice,
          stopLoss: signal.stopLoss,
        },
      };

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[EXECUTE_AUTO_TRADE] Action failed: ${msg}`);

      const errorResult: ActionResult = {
        text: `Failed to execute auto-trade: ${msg}`,
        success: false,
        error: msg,
      };

      if (callback) {
        await callback({
          text: errorResult.text,
          content: { error: "action_failed", details: msg },
        });
      }
      return errorResult;
    }
  },

  examples: [
    [
      {
        name: "{{user}}",
        content: { text: "Auto-trade ETH with $100 based on Token Metrics signals" },
      },
      {
        name: "{{agent}}",
        content: {
          text: "Signal: BUY ETH | Confidence: 85% | Entry: $2,500 | Target: $2,800 | Stop: $2,400",
          actions: ["EXECUTE_AUTO_TRADE"],
        },
      },
    ],
  ],
};
