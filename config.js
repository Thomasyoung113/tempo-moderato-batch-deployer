// ============================================
// TEMPO MODERATO TESTNET CONFIGURATION
// ============================================

require('dotenv').config();

module.exports = {
  // Network Configuration
  network: {
    name: "Tempo Testnet (Moderato)",
    chainId: 42431,
    rpc: "https://rpc.moderato.tempo.xyz",
    wsRpc: "wss://rpc.moderato.tempo.xyz",
    explorer: "https://explore.tempo.xyz",
    currency: "USD"
  },

  // Deployment Settings
  deployment: {
    totalContracts: 1000,
    nftPercentage: 50,
    batchSize: 50,
    concurrency: 20,
    gasLimit: 3000000,
    maxPriorityFeePerGas: "1000000000",
    maxFeePerGas: "5000000000"
  },

  // Private key from .env file
  privateKey: process.env.PRIVATE_KEY
};
