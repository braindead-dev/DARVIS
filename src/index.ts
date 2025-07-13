import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { runAgent } from './core/agent.js';

/**
 * Validates that required environment variables are present.
 * Throws an error if any required variables are missing.
 */
if (!process.env.DISCORD_TOKEN || !process.env.OPENAI_API_KEY) {
  throw new Error('Missing DISCORD_TOKEN or OPENAI_API_KEY in .env file');
}

/**
 * Discord client configuration with necessary intents and partials.
 * 
 * Intents enable the bot to receive specific types of events:
 * - Guilds: Access to guild information
 * - GuildMessages: Read messages in guilds
 * - MessageContent: Access to message content
 * - GuildMembers: Access to member information
 * 
 * Partials allow the bot to work with partial data structures.
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

/**
 * Event handler for when the bot successfully connects to Discord.
 * Logs the bot's tag to confirm successful login.
 */
client.once('ready', () => {
  console.log(`Logged in as ${client.user?.tag}!`);
});

/**
 * Event handler for new messages in Discord channels.
 * 
 * This handler:
 * 1. Filters out bot messages and messages that don't mention this bot
 * 2. Shows typing indicator while processing
 * 3. Delegates to the AI agent for processing
 * 4. Handles any errors that occur during processing
 * 
 * @param message - The Discord message that was created
 */
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.mentions.has(client.user!.id)) {
    return;
  }

  try {
    await message.channel.sendTyping();
    await runAgent(client, message);
  } catch (error) {
    console.error('An error occurred in the agent:', error);
    await message.reply('I ran into an unexpected error. Please try again.');
  }
});

/**
 * Initiates the bot's connection to Discord using the token from environment variables.
 */
client.login(process.env.DISCORD_TOKEN); 