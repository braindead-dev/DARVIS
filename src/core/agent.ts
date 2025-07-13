import OpenAI from 'openai';
import {
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
} from 'openai/resources/index.mjs';
import { Client, Message } from 'discord.js';
import { executeCode, executeDiscordJsCodeTool } from '../tools/executor.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Maximum number of iterations the agent can perform before stopping.
 * This prevents infinite loops and controls API usage costs.
 */
const MAX_ITERATIONS = 5;

/**
 * Runs the AI agent to process a Discord message and execute appropriate actions.
 * 
 * The agent operates in a loop where it:
 * 1. Analyzes the user's request using OpenAI
 * 2. Decides whether to execute Discord.js code or respond directly
 * 3. Executes code if needed and incorporates results into the conversation
 * 4. Continues until the task is complete or max iterations reached
 * 
 * @param client - The Discord.js client instance
 * @param message - The Discord message that triggered the agent
 * @returns Promise that resolves when the agent completes its task
 */
export async function runAgent(client: Client, message: Message) {
  const tools: ChatCompletionTool[] = [executeDiscordJsCodeTool];
  const conversation: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `You are a helpful Discord bot. Your goal is to fulfill the user's request by executing Discord.js v14 code.
You can use the provided 'execute_discord_js_code' tool to run code.
The user's message is: "${message.cleanContent}".
The message was sent in a channel with ID: ${message.channel.id} in a server with ID: ${message.guildId}.
Think step-by-step.
If a request is complex, break it down into smaller pieces of code.
For example, to ban a user, first find the user with 'message.guild.members.search', then use the returned ID to ban them.
After a successful operation, your final step should be to use 'message.reply()' to inform the user of the outcome.
If you don't know what to do or the user is just having a conversation, just respond with a friendly message using 'message.reply()'.`,
    },
    {
      role: 'user',
      content: message.cleanContent,
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: conversation,
      tools: tools,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls) {
      conversation.push(responseMessage);
      for (const toolCall of toolCalls) {
        if (toolCall.function.name === 'execute_discord_js_code') {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await executeCode(client, message, args.code);

          console.log(`[Iteration ${i + 1}] Executing code:\n${args.code}`);
          console.log(`[Iteration ${i + 1}] Result:`, result);
          
          conversation.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(result),
          });
        }
      }
    } else {
      if (responseMessage.content) {
        await message.reply(responseMessage.content);
      } else {
        await message.reply("I've finished my task but have nothing more to say!");
      }
      return;
    }
  }

  await message.reply(
    "I've reached my maximum number of steps for this task. If I haven't finished, please try rephrasing your request."
  );
} 