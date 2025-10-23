import type { Action } from "@elizaos/core";

/**
 * Extended Action type that includes parameter schemas for tool calling.
 * This enables the LLM to understand what parameters each action requires
 * and extract them in a single pass, reducing LLM calls by 50%.
 */
export interface ActionWithParams extends Action {
  parameters?: Record<string, {
    type: string;
    description: string;
    required: boolean;
  }>;
}

