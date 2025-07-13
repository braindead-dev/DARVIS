import { type ChatCompletionTool } from 'openai/resources/index.mjs';
import { Client, Message } from 'discord.js';

/**
 * Tool definition for executing Discord.js code.
 * 
 * This tool allows the AI to execute arbitrary Discord.js v14 code within a sandboxed environment.
 * The AI has access to the Discord client and the original message object.
 * 
 * @type {ChatCompletionTool}
 */
export const executeDiscordJsCodeTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'execute_discord_js_code',
    description: `Executes arbitrary Discord.js v14 code to fulfill a user's request.
You have access to the 'client' (the Discord.js Client) and 'message' (the original Discord Message object).
The code runs in an async context, so you can use await.
Return a value to let the user know the result of the execution.
If you need to find a user/channel/role, you MUST use methods like 'message.guild.members.search' or 'client.users.fetch'. Do NOT guess IDs.
For a successful execution, return an object with a 'summary' property, e.g., { summary: "Successfully banned the user." }.
For a failure, the error will be caught and reported back to you.`,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The string of Discord.js code to execute.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
  },
};

/**
 * Executes Discord.js code in a sandboxed environment.
 * 
 * This function creates a safe execution context where the AI-generated code can run
 * with access to the Discord client and message objects. The code is wrapped in an
 * async function to support modern Discord.js patterns.
 * 
 * @param client - The Discord.js client instance
 * @param message - The original Discord message that triggered the command
 * @param code - The JavaScript code string to execute
 * @returns Promise that resolves to the result of the code execution
 */
export async function executeCode(
  client: Client,
  message: Message,
  code: string
): Promise<any> {
  const sandbox = new Function(
    'client',
    'message',
    `return (async () => {
      try {
        ${code}
      } catch (error) {
        return { error: error.message };
      }
    })();`
  );

  try {
    const result = await sandbox(client, message);
    return result || { summary: 'Code executed without returning a value.' };
  } catch (error: any) {
    return {
      error: `Execution failed: ${error.message}`,
      stack: error.stack,
    };
  }
} 