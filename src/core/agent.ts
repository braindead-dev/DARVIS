import axios from 'axios';
import { Client, Message } from 'discord.js';
import { executeCode, executeDiscordJsCodeTool } from '../tools/executor.js';
import { searchGif, gifSearchTool } from '../tools/gif-search.js';
import { AGENT_CONFIG } from './config.js';

/**
 * Builds conversation history by traversing the reply chain backwards.
 * Fetches all messages in the reply chain and formats them for the LLM.
 * 
 * @param message - The current Discord message
 * @param client - The Discord.js client instance
 * @param maxDepth - Maximum number of messages to traverse (default: 10)
 * @returns Promise that resolves to an array of conversation messages
 */
async function buildConversationHistory(message: Message, client: Client, maxDepth: number = 10): Promise<any[]> {
  const conversationMessages: any[] = [];
  let currentMessage: Message | null = message;
  let depth = 0;

  // Traverse backwards through the reply chain
  while (currentMessage && depth < maxDepth) {
    // Determine the role based on whether the author is the bot
    const role = currentMessage.author.id === client.user?.id ? 'assistant' : 'user';
    
    // Format the message content
    let content: string;
    if (role === 'user') {
      content = `[${currentMessage.author.displayName} (username: ${currentMessage.author.username}, id: ${currentMessage.author.id})]\n${currentMessage.cleanContent}`;
    } else {
      content = currentMessage.content;
    }

    // Add to the beginning of the array (since we're going backwards)
    conversationMessages.unshift({
      role,
      content
    });

    depth++;

    // Move to the referenced message (if it exists)
    if (currentMessage.reference?.messageId) {
      try {
        currentMessage = await currentMessage.channel.messages.fetch(currentMessage.reference.messageId);
      } catch (error) {
        // If we can't fetch the referenced message, break the chain
        console.log(`Could not fetch referenced message at depth ${depth}:`, error);
        break;
      }
    } else {
      // No more references, end the chain
      break;
    }
  }

  if (depth >= maxDepth) {
    console.log(`Conversation chain truncated at ${maxDepth} messages`);
  }

  return conversationMessages;
}

/**
 * Attempts to send a message with fallback logic.
 * First tries to reply to the original message, then falls back to sending a new message.
 * Handles cases where the original message is deleted or channel is inaccessible.
 * 
 * @param message - The Discord message to reply to
 * @param content - The content to send
 * @returns Promise that resolves when the message is sent or fails silently
 */
async function sendMessageWithFallback(message: Message, content: string) {
  try {
    // First attempt: Try to reply to the original message
    await message.reply(content);
  } catch (error) {
    // Second attempt: Try to send as a new message if reply fails
    try {
      if (message.channel.isTextBased()) {
        await (message.channel as any).send(content);
      }
    } catch (channelError) {
      // If all attempts fail, log the error but continue execution
      console.error('Failed to send message:', channelError);
    }
  }
}

/**
 * Makes a request to the LLM API to generate a response.
 * 
 * @param messages - Array of messages
 * @param tools - Array of available tools
 * @returns Promise that resolves to the API response
 */
async function callLLM(messages: any[], tools: any[]) {
  const response = await axios.post(AGENT_CONFIG.apiEndpoint, {
    model: AGENT_CONFIG.model,
    messages,
    tools
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LLM_API_KEY}`
    }
  });

  return response.data;
}

/**
 * Runs the AI agent to process a Discord message and execute appropriate actions.
 * 
 * The agent operates in a loop where it:
 * 1. Builds conversation history from reply chains
 * 2. Analyzes the user's request using the LLM with full context
 * 3. Decides whether to execute Discord.js code or respond directly
 * 4. Executes code if needed and incorporates results into the conversation
 * 5. Continues until the task is complete or max iterations reached
 * 
 * @param client - The Discord.js client instance
 * @param message - The Discord message that triggered the agent
 * @returns Promise that resolves when the agent completes its task
 */
export async function runAgent(client: Client, message: Message) {
  const tools = [executeDiscordJsCodeTool, gifSearchTool];

  const systemPrompt = AGENT_CONFIG.systemPrompt({ message });

  // Build conversation history from reply chain, using config for max depth
  const conversationHistory = await buildConversationHistory(message, client, AGENT_CONFIG.maxConversationDepth);
  
  let messages: any[] = [
    {
      role: 'system',
      content: systemPrompt,
    },
    ...conversationHistory
  ];

  for (let i = 0; i < AGENT_CONFIG.maxIterations; i++) {
    const response = await callLLM(messages, tools);
    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // Add the assistant's message to the conversation
    messages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls
    });

    let hasFunctionCalls = false;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      hasFunctionCalls = true;
      
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        let result;


        // Direct the tool call to the correct tool
        if (toolCall.function.name === 'execute_discord_js_code') {
          result = await executeCode(client, message, args.code);
        } else if (toolCall.function.name === 'search_gif') {
          result = await searchGif(client, message, args.query);
        }

        console.log(`[Iteration ${i + 1}] Executing ${toolCall.function.name}:`, args);
        console.log(`[Iteration ${i + 1}] Result:`, result);
        
        // Add the tool result to the conversation
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }

    if (!hasFunctionCalls) {
      if (assistantMessage.content) {
        await sendMessageWithFallback(message, assistantMessage.content);
      }
      return;
    }
  }

  await sendMessageWithFallback(
    message,
    AGENT_CONFIG.fallbackMessage
  );
} 