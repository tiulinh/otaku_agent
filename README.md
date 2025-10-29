# My Eliza App

A custom React application powered by ElizaOS, featuring a beautiful UI for chatting with AI agents.

## 🚀 Features

- ✅ **Single Port** - Server and UI run on the same port (default: 3000)
- ✅ **One Command** - Start everything with `bun run dev`
- ✅ **Real-time Chat** - WebSocket-powered instant messaging
- ✅ **Beautiful UI** - Modern, responsive design with Tailwind CSS
- ✅ **Hot Reload** - Fast development with Vite HMR
- ✅ **Agent Management** - View and chat with multiple AI agents

## 📋 Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Node.js 18+ (for compatibility)

## 🛠️ Setup

### 1. Install Dependencies

Since this project uses workspace dependencies, you need to run it from within the Eliza monorepo:

```bash
# From the eliza root directory
cd ../../eliza  # Navigate to eliza monorepo root

# Install all dependencies
bun install
```

### 2. Configure Environment

The `.env` file is already set up with sensible defaults:

```bash
SERVER_PORT=3000
ELIZA_UI_ENABLE=true
PGLITE_DATA_DIR=./data
NODE_ENV=development
```

You can modify these if needed.

## 🚀 Running the App

### Development Mode

From the `my-eliza-app` directory:

```bash
bun run dev
```

This will:
1. Build your React frontend with Vite
2. Start the Vite dev server (for hot reload)
3. Start the Eliza server with your agent
4. Serve everything on **http://localhost:3000**

### Production Build

```bash
# Build everything
bun run build

# Start production server
bun run start
```

## 📁 Project Structure

```
my-eliza-app/
├── src/
│   ├── index.ts              # Main entry point (agent config)
│   ├── character.ts          # Your agent's character definition
│   └── frontend/             # React application
│       ├── index.html
│       ├── index.tsx         # React entry point
│       ├── App.tsx           # Main App component
│       ├── index.css         # Global styles
│       ├── lib/
│       │   ├── elizaClient.ts    # API client
│       │   └── socketManager.ts  # WebSocket manager
│       └── components/
│           ├── AgentList.tsx     # Agent selection UI
│           └── Chat.tsx          # Chat interface
├── dist/                     # Built files
│   ├── src/                  # Backend build
│   └── frontend/             # Frontend build
├── build.ts                  # Backend build script
├── vite.config.ts           # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies & scripts
└── .env                     # Environment variables
```

## 🔧 Customization

### Modifying the Agent

Edit `src/character.ts` to customize your agent:

```typescript
export const character: Character = {
  name: 'YourAgentName',
  system: 'Your system prompt...',
  bio: ['Bio line 1', 'Bio line 2'],
  // ... more settings
};
```

### Customizing the UI

- **Styles**: Edit `src/frontend/index.css` or modify Tailwind classes
- **Components**: Create new components in `src/frontend/components/`
- **Colors**: Update `tailwind.config.js` theme

### Adding Features

1. **New API Endpoints**: Use `elizaClient` in your components
2. **Real-time Updates**: Use `socketManager` for WebSocket events
3. **New Routes**: Add routes in `App.tsx`

## 🎨 UI Components

### AgentList
Displays available agents in a grid layout. Click an agent to start chatting.

### Chat
Real-time chat interface with:
- Message history
- Typing indicators
- Smooth scrolling
- Send on Enter key

## 🔌 API Usage

### REST API

```typescript
import { elizaClient } from './lib/elizaClient';

// List agents
const agents = await elizaClient.agents.listAgents();

// Get agent details
const agent = await elizaClient.agents.getAgent(agentId);

// Get messages
const messages = await elizaClient.messaging.getMessagesForChannel(channelId);
```

### WebSocket

```typescript
import { socketManager } from './lib/socketManager';

// Connect
socketManager.connect(userId);

// Join channel
socketManager.joinChannel(channelId);

// Send message
socketManager.sendMessage(channelId, 'Hello!', serverId);

// Listen for messages
socketManager.onMessage((data) => {
  console.log('New message:', data);
});
```

## 🐛 Troubleshooting

### Port Already in Use

Change the port in `.env`:
```bash
SERVER_PORT=3001
```

### Dependencies Not Found

Make sure you're in the Eliza monorepo and run:
```bash
cd ../../eliza
bun install
```

### Frontend Not Loading

1. Check that `vite.config.ts` exists
2. Verify `ELIZA_UI_ENABLE=true` in `.env`
3. Run `bun run build:frontend` manually

### Hot Reload Not Working

The Vite dev server should start automatically. Check the console for:
```
Vite dev server running on http://localhost:5173
```

## 📝 Scripts

- `bun run dev` - Start development server (frontend + backend)
- `bun run build` - Build for production
- `bun run build:frontend` - Build frontend only
- `bun run start` - Start production server
- `bun run type-check` - Check TypeScript types

## 🌐 Accessing the App

Once running:
- **UI**: http://localhost:3000
- **API**: http://localhost:3000/api/
- **Health Check**: http://localhost:3000/api/server/ping

## 🔌 Plugins

### CDP Plugin

The CDP (Coinbase Developer Platform) plugin provides wallet and payment functionality:

#### Available Actions

- **USER_WALLET_INFO** - View wallet balances, tokens, and NFTs
- **USER_WALLET_TOKEN_TRANSFER** - Transfer tokens to other addresses
- **USER_WALLET_NFT_TRANSFER** - Transfer NFTs to other addresses
- **USER_WALLET_SWAP** - Swap tokens using DEX aggregators
- **FETCH_WITH_PAYMENT** ⭐ - Make paid API requests using x402 protocol

#### FETCH_WITH_PAYMENT Action

Make HTTP requests to x402-enabled paid APIs with automatic onchain payment handling.

**Features:**
- Automatic 402 Payment Required response handling
- Onchain USDC payments on Base network
- Configurable payment limits
- Support for GET and POST requests
- Returns both API response and payment receipt

**Usage Examples:**
```
"fetch https://api.example.com/paid-data with payment"
"make a paid request to https://x402-service.com/premium with max payment 2 USDC"
"POST to https://api.example.com/submit with body {\"key\": \"value\"}"
```

**Parameters:**
- `url` (required) - The x402-enabled API endpoint
- `method` (optional) - HTTP method (GET or POST, defaults to GET)
- `headers` (optional) - Custom HTTP headers
- `body` (optional) - Request body for POST requests
- `maxPayment` (optional) - Maximum payment in USDC (defaults to 1.0)

**Response includes:**
- API response data
- Payment transaction hash
- Network and payer information
- Success status

Learn more: https://docs.cdp.coinbase.com/x402/quickstart-for-buyers

### Web Search Plugin

Provides web search and crypto news functionality using Tavily and CoinDesk APIs.

## 📖 Next Steps

1. **Customize your agent** in `src/character.ts`
2. **Style the UI** in `src/frontend/`
3. **Add plugins** to extend functionality
4. **Deploy** your app to production

## 🤝 Contributing

This is your custom Eliza app! Feel free to modify it however you like.

## 📄 License

MIT

---

Built with ❤️ using [ElizaOS](https://github.com/elizaos/eliza)

# otaku-fe
