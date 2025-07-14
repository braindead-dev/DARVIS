import { Client, Message } from 'discord.js';

/**
 * Tool definition for searching and retrieving GIFs using Discord's API.
 * 
 * This tool allows the AI to search for GIFs using Discord's built-in GIF search endpoint.
 * It returns the URL of the first matching GIF result.
 */
export const gifSearchTool = {
  type: 'function' as const,
  name: 'search_gif',
  description: `Searches for GIFs using Discord's API and returns the first result URL.
Use this liberally; whenever you want to express an emotion or something visually.
The query should be descriptive of what kind of GIF they want (e.g., "laughing", "dancing", "cute cat"). Not too specific.
Returns the URL of the first GIF found that matches the search query.

When you send a gif, prefer to ONLY send the gif URL in your message and no other text. Ex. instead of "Here's a gif for you: [url]", just send the url"`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query for the GIF (e.g., "laughing", "dancing", "cute cat").',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  strict: true,
};

/**
 * Searches for GIFs using Discord's API and returns the first result.
 * 
 * This function makes a request to Discord's GIF search endpoint and parses
 * the response to extract the URL of the first matching GIF.
 * 
 * @param client - The Discord.js client instance (unused but required for tool signature)
 * @param message - The original Discord message (unused but required for tool signature)
 * @param query - The search query for the GIF
 * @returns Promise that resolves to the GIF URL or an error message
 */
export async function searchGif(
  client: Client,
  message: Message,
  query: string
): Promise<any> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://discord.com/api/v9/gifs/search?q=${encodedQuery}&media_format=mp4&provider=tenor&locale=en-US`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return {
        error: `Failed to fetch GIFs: ${response.status} ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    
    if (!Array.isArray(data) || data.length === 0) {
      return {
        error: `No GIFs found for query: "${query}"`,
      };
    }
    
    const firstGif = data[0];
    const gifUrl = firstGif.url;
    
    return {
      summary: `Found GIF for "${query}"`,
      url: gifUrl,
    };
  } catch (error: any) {
    return {
      error: `GIF search failed: ${error.message}`,
    };
  }
} 