import type { IAgentRuntime, Memory } from '@elizaos/core';
import { type Config, adjectives, names, uniqueNamesGenerator } from 'unique-names-generator';

/**
 * Configuration for name generation in examples
 */
const nameConfig: Config = {
  dictionaries: [adjectives, names],
  separator: '',
  length: 2,
  style: 'capital',
};

/**
 * Example messages to determine if the agent should respond
 * Used to guide LLM on when to RESPOND, IGNORE, or STOP
 */
const messageExamples = [
  // Examples where agent should RESPOND
  `// {{name1}}: Hey {{agentName}}, can you help me with something
// Response: RESPOND`,

  `// {{name1}}: Hey {{agentName}}, can I ask you a question
// {{agentName}}: Sure, what is it
// {{name1}}: can you help me create a basic react module that demonstrates a counter
// Response: RESPOND`,

  `// {{name1}}: {{agentName}} can you tell me a story
// {{name1}}: about a girl named {{characterName}}
// {{agentName}}: Sure.
// {{agentName}}: Once upon a time, in a quaint little village, there was a curious girl named {{characterName}}.
// {{agentName}}: {{characterName}} was known for her adventurous spirit and her knack for finding beauty in the mundane.
// {{name1}}: I'm loving it, keep going
// Response: RESPOND`,

  `// {{name1}}: okay, i want to test something. can you say marco?
// {{agentName}}: marco
// {{name1}}: great. okay, now do it again
// Response: RESPOND`,

  `// {{name1}}: what do you think about artificial intelligence?
// Response: RESPOND`,

  // Examples where agent should IGNORE
  `// {{name1}}: I just saw a really great movie
// {{name2}}: Oh? Which movie?
// Response: IGNORE`,

  `// {{name1}}: i need help
// {{agentName}}: how can I help you?
// {{name1}}: no. i need help from {{name2}}
// Response: IGNORE`,

  `// {{name1}}: {{name2}} can you answer a question for me?
// Response: IGNORE`,

  `// {{agentName}}: Oh, this is my favorite scene
// {{name1}}: sick
// {{name2}}: wait, why is it your favorite scene
// Response: RESPOND`,

  // Examples where agent should STOP
  `// {{name1}}: {{agentName}} stop responding plz
// Response: STOP`,

  `// {{name1}}: stfu bot
// Response: STOP`,

  `// {{name1}}: {{agentName}} stfu plz
// Response: STOP`,
];

/**
 * Generates formatted should-respond examples with random names
 * Used to provide context to the LLM about when to respond
 *
 * @param runtime - Agent runtime for accessing character name
 * @returns Formatted examples text
 */
export function generateShouldRespondExamples(runtime: IAgentRuntime): string {
  // Get agent name
  const agentName = runtime.character.name;

  // Create random user names and character name
  const name1 = uniqueNamesGenerator(nameConfig);
  const name2 = uniqueNamesGenerator(nameConfig);
  const characterName = uniqueNamesGenerator(nameConfig);

  // Shuffle the message examples array and use a subset
  const shuffledExamples = [...messageExamples].sort(() => 0.5 - Math.random()).slice(0, 7);

  // Replace placeholders with generated names
  const formattedExamples = shuffledExamples.map((example) => {
    return example
      .replace(/{{name1}}/g, name1)
      .replace(/{{name2}}/g, name2)
      .replace(/{{agentName}}/g, agentName)
      .replace(/{{characterName}}/g, characterName);
  });

  return formattedExamples.join('\n\n');
}

/**
 * Determines if the agent should respond based on message context
 * Checks various factors like message age, direct mentions, DM status, etc.
 *
 * @param runtime - Agent runtime
 * @param message - Message to evaluate
 * @returns Boolean indicating whether agent should respond
 */
export async function shouldRespondToMessage(
  runtime: IAgentRuntime,
  message: Memory
): Promise<boolean> {
  // Always respond to DMs
  if (message.content?.channelType === ('dm' as string)) {
    return true;
  }

  // Check if agent is directly mentioned
  const agentName = runtime.character.name.toLowerCase();
  const messageText = message.content.text?.toLowerCase() || '';

  if (messageText.includes(agentName) || messageText.includes(`@${agentName}`)) {
    return true;
  }

  // Check if message is a reply to agent's previous message
  if (message.content.inReplyTo) {
    const recentMessages = await runtime.getMemories({
      tableName: 'messages',
      roomId: message.roomId,
      count: 10,
    });

    const inReplyTo = recentMessages.find((m) => m.id === message.content.inReplyTo);
    if (inReplyTo && inReplyTo.entityId === runtime.agentId) {
      return true;
    }
  }

  // Default to not responding in group chats unless explicitly triggered
  return false;
}

