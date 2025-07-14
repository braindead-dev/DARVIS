# DARVIS - The Agentic Discord Bot

DARVIS is an intelligent Discord bot that can understands natural language and can execute complex, multi-step commands using Javascript and Discord.js.

- **Natural Language**: Understands complex Discord-related requests in natural language
- **Dynamic Generation**: Generates and executes Discord.js v14 code on-the-fly to perform any Discord operation
- **Multi-Step Operations**: Performs complex tasks by breaking them down into steps, enabling sophisticated and unique commands that go beyond traditional bot capabilities
- **Extensible Tooling**: Custom built-in GIF tool, and ability to easily add as many tools as needed
- **Conversation Context**: Maintains conversation history through Discord reply chains
- **Configurable Limits**: Customizable iteration limits and conversation depth

### ⚠️ Security Consideration ⚠️
- The bot executes LLM-generated code in an unsandboxed environment
- The current implementation relies on AI alignment + system prompting to prevent malicious code generation. While this gaurdrail works effectively for most cases with a SotA model, this is not a production ready security solution. In production, code should ONLY be executed in a fully isolated sandbox environment.

### Prerequisites

- Node.js (v16+)
- A Discord Bot Token (with intents enabled)
- An LLM API Key (for any standard completions API; e.g. OpenAI, Anthropic, xAI)

### Setup

#### 1. Clone and Install

```bash
git clone https://github.com/braindead-dev/DARVIS
cd Darvis
npm i
```
#### 2. Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Navigate to the "Bot" section
4. Create a bot and copy the token
5. Enable the following privileged gateway intents:
   - **Message Content Intent** (required for reading message content)
   - **Server Members Intent** (required for member operations)
  
#### 3. Environment Configuration

Create a `.env` file in the root directory that follows the .env.template

#### 4. Invite and Run the Bot

```bash
# Development
npm run dev

# Production
npm start
```

### Configuration Options

The bot's behavior is controlled through `src/core/config.ts`. Here's what each setting means:

#### Core Configuration (`AgentConfig`)

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| `apiEndpoint` | string | LLM API endpoint URL | OpenAI's GPT API |
| `model` | string | LLM model to use | `gpt-4.1` |
| `systemPrompt` | function | Generates the system prompt for the LLM | Detailed Discord bot instructions |
| `fallbackMessage` | string | Message sent when max iterations reached | Error message |
| `maxIterations` | number | Maximum LLM calls per request | `5` |
| `maxConversationDepth` | number | Max messages to include in context | `10` |

### Logic Flow

#### 1. Message Processing Pipeline

```
Discord Message → Filter (mentions bot?) → Build Context → LLM Processing → Execute Actions → Respond
```

#### 2. Detailed Flow

1. **Message Reception** (`src/index.ts`)
   - Bot receives a message in Discord
   - Filters out bot messages and non-mentions
   - Shows typing indicator

2. **Context Building** (`src/core/agent.ts#buildConversationHistory`)
   - Traverses reply chain backwards up to `maxConversationDepth`
   - Builds conversation history with user info and roles
   - Formats messages for LLM consumption

3. **LLM Processing Loop** (`src/core/agent.ts#runAgent`)
   - Sends conversation + system prompt to LLM
   - LLM decides whether to:
     - Respond directly with text
     - Execute Discord.js code
     - Search for GIFs
   - Up to `maxIterations` loops allowed

4. **Code Execution** (`src/tools/executor.ts`)
   - Creates sandboxed environment
   - Provides access to `client` and `message` objects
   - Executes generated Discord.js code
   - Returns results back to LLM

5. **Response Delivery**
   - Attempts to reply to original message
   - Falls back to new message if reply fails
   - Handles deleted messages gracefully

#### 3. Tool System

The bot uses a tool-based architecture:

- **`execute_discord_js_code`**: Executes Discord.js operations
- **`search_gif`**: Searches and posts GIFs
- Tools are defined with strict schemas for the LLM

#### Adding New Tools

1. Create a new tool file in `src/tools/`
2. Export a tool definition object and execution function
3. Import and add to the tools array in `src/core/agent.ts`

Example tool structure:
```typescript
export const myTool = {
  type: 'function' as const,
  function: {
    name: 'my_tool',
    description: 'Description of what the tool does',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter description' }
      },
      required: ['param1']
    }
  }
};
```

### 📖 Usage Examples

#### Basic Commands
```
@DARVIS ban Henry for spamming
@DARVIS send a funny gif
@DARVIS DM a philosophical quote to everyone with the philosophy role
@DARVIS who has sent the most messages in this channel?
@DARVIS @ a random user in the server
@DARVIS show me the member count of this server
@DARVIS list all users who joined in the last 24h
```

--- 
### Contributions
Always open for contributions!! Feel free to submit a PR
