import OpenAI from 'openai';
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
  const tools = [executeDiscordJsCodeTool];

  const systemPrompt = `You are DARVIS (Dumb Ass Rogue Virtual Indian Sidekick), a helpful Discord bot. Your goal is to fulfill the user's request, and you can executing Discord.js v14 code to do so.

To run code / use Discord.js v14, use the provided 'execute_discord_js_code' tool (e.g. moderating members, managing roles, fetching data, sending embeds, etc.).

ALL **assistant messages** are automatically sent without needing a tool call. If the request can be satisfied with plain text, reply normally and DO NOT call the tool.

When you *do* choose to call the tool to run code:
• Return a single function_call named 'execute_discord_js_code'.
• Provide only the minimal code required to fulfil the request.
• Avoid using "message.reply" to send messages unless strictly necessary, since all assistant messages are sent to the user already (without needing to run code). Prefer regular assistant messages over sending messages with code.

After a tool call you will receive its execution result in the next turn (sometimes it will return nothing, but that's fine).

For multi-step tasks, you may break them into several iterations / steps. Aim to complete tasks in as few steps as possible. You may use up to ${MAX_ITERATIONS} iterations.

For example, if asked to ban an unknown user, you might first find the user with 'message.guild.members.search', then use the returned ID to ban them.

The user's message was sent in the channel and server IDs below:
  channelId: ${message.channel.id}
  guildId: ${message.guildId}`;

  let input: any[] = [
    {
      role: 'system',
      content: [
        {
          type: 'input_text',
          text: systemPrompt,
        },
      ],
    },
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `[User: ${message.author.displayName} (${message.author.id})]\n${message.cleanContent}`,
        },
      ],
    },
  ];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.responses.create({
      model: 'gpt-4.1',
      input,
      tools,
    });

    const output = response.output;
    let hasFunctionCalls = false;

    for (const item of output) {
      if (item.type === 'function_call') {
        hasFunctionCalls = true;
        
        if (item.name === 'execute_discord_js_code') {
          const args = JSON.parse(item.arguments);
          const result = await executeCode(client, message, args.code);

          console.log(`[Iteration ${i + 1}] Executing code:\n${args.code}`);
          console.log(`[Iteration ${i + 1}] Result:`, result);
          
          input.push(item);
          input.push({
            type: 'function_call_output',
            call_id: item.call_id,
            output: JSON.stringify(result),
          });
        }
      }
    }

    if (!hasFunctionCalls) {
      if (response.output_text) {
        await message.reply(response.output_text);
      }
      return;
    }
  }

  await message.reply(
    "I've reached my maximum number of steps for this task. If I haven't finished, please try rephrasing your request."
  );
} 