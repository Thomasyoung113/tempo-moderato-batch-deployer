# Simple Tempo Contract 1K

Fast deployer for 1000 unique contracts on Tempo Moderato Testnet.

## Features

- ⚡ Deploys 1000 contracts in under 5 minutes
- 🎨 50% NFT contracts, 50% Simple contracts
- 🔗 All contracts visible on Tempo Explorer
- 📊 Generates deployment report with all contract addresses
- 🚀 Parallel deployment with optimized gas settings

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Add Your Private Key

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your private key:

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

### 3. Get Testnet Tokens

Visit the Tempo faucet to get test tokens:
- https://docs.tempo.xyz/guide/use-accounts/add-funds

### 4. Deploy!

```bash
npm run deploy
```

Or test with 10 contracts first:

```bash
npm run test
```

## Auto-Deploy (Continuous Loop)

Run unlimited rounds (Ctrl+C to stop):
```bash
npm run auto
```

Run specific number of rounds:
```bash
npm run auto:10      # 10 rounds = 10,000 contracts
npm run auto:100     # 100 rounds = 100,000 contracts
```

Custom options:
```bash
node deploy.js --auto --rounds=50 --delay=10
```

Options:
- `--auto` - Enable auto-repeat mode
- `--rounds=N` - Number of rounds (default: unlimited)
- `--delay=N` - Seconds between rounds (default: 5)

## Configuration

Edit `config.js` to customize:

```javascript
deployment: {
  totalContracts: 1000,    // Number of contracts to deploy
  nftPercentage: 50,       // Percentage of NFT contracts
  batchSize: 50,           // Contracts per batch
  concurrency: 20,         // Parallel transactions
  gasLimit: 3000000,
  maxPriorityFeePerGas: "1000000000",  // 1 gwei
  maxFeePerGas: "5000000000"           // 5 gwei
}
```

## Network Details

- **Network:** Tempo Testnet (Moderato)
- **Chain ID:** 42431
- **RPC:** https://rpc.moderato.tempo.xyz
- **WebSocket:** wss://rpc.moderato.tempo.xyz
- **Explorer:** https://explore.tempo.xyz
- **Currency:** USD

## Output

After deployment, you'll get:
- Console summary with contract addresses
- `deployment_[timestamp].json` file with full report

## Contract Types

### Simple Contracts (50%)
Minimal storage contracts with unique IDs:
- Stores unique ID
- Stores owner address
- ~100 bytes of bytecode

### NFT Contracts (50%)
ERC721-like contracts with unique names:
- Unique name per contract
- Owner address
- Counter for minting

## Troubleshooting

**"Wallet has no balance"**
→ Get tokens from Tempo faucet

**"Nonce too low"**
→ Wait for pending transactions to confirm, or restart

**"Transaction underpriced"**
→ Increase gas settings in config.js

## Explorer Links

View all your contracts:
```
https://explore.tempo.xyz/address/YOUR_WALLET_ADDRESS
```

View specific contract:
```
https://explore.tempo.xyz/address/CONTRACT_ADDRESS
```
