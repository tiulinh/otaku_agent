import type { IAgentRuntime, Memory, Provider } from '@elizaos/core';
import { addHeader } from '@elizaos/core';
import { generateShouldRespondExamples } from '../utils/index.js';

/**
 * Represents a provider that generates response examples for the agent.
 * @type {Provider}
 */
export const shouldRespondProvider: Provider = {
  name: 'SHOULD_RESPOND',
  description: 'Examples of when the agent should respond, ignore, or stop responding',
  position: -1,
  get: async (runtime: IAgentRuntime, _message: Memory) => {
    const examplesText = generateShouldRespondExamples(runtime);
    const text = addHeader('# RESPONSE EXAMPLES', examplesText);

    return {
      text,
    };
  },
};
