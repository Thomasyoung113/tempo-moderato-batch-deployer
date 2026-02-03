#!/usr/bin/env node
// ============================================
// TEMPO MODERATO FAST CONTRACT DEPLOYER
// Deploys 1000 unique contracts in under 5 minutes
// 50% NFT contracts, 50% Simple contracts
// ============================================

const { ethers } = require('ethers');
const fs = require('fs');
const config = require('./config');

// ============================================
// MINIMAL CONTRACT BYTECODES
// ============================================

// Simple storage contract that stores unique ID + owner
const SIMPLE_BYTECODE = "0x608060405234801561001057600080fd5b5060405161016938038061016983398181016040528101906100329190610090565b805f8190555033600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550506100bd565b5f80fd5b5f819050919050565b61006f81610060565b811461007a575f80fd5b50565b5f8151905061008b81610066565b92915050565b5f602082840312156100a6576100a561005b565b5b5f6100b38482850161007d565b91505092915050565b60a9806100c05f395ff3fe6080604052348015600e575f80fd5b50600436106030575f3560e01c8063af640d0f1460345780638da5cb5b146051575b5f80fd5b603a606b565b60405160479190607c565b60405180910390f35b60575f5481565b005b5f5481565b5f819050919050565b607681606e565b82525050565b5f602082019050608f5f830184606f565b9291505056fea2646970667358";

// NFT-like contract with name storage
const NFT_BYTECODE = "0x608060405234801561001057600080fd5b5060405161027238038061027283398181016040528101906100329190610150565b805f908161004091906103c2565b5033600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550506104915656";

// ============================================
// CONFIGURATION
// ============================================

let TOTAL_CONTRACTS = config.deployment.totalContracts || 1000;
const NFT_PERCENTAGE = config.deployment.nftPercentage || 50;
const BATCH_SIZE = config.deployment.batchSize || 50;
const CONCURRENCY = config.deployment.concurrency || 20;

// ============================================
// HELPER FUNCTIONS
// ============================================

function getSimpleBytecode(id) {
  const abiCoder = new ethers.AbiCoder();
  const encodedId = abiCoder.encode(['uint256'], [id]);
  return SIMPLE_BYTECODE + encodedId.slice(2);
}

function getNFTBytecode(id) {
  const name = `TempoNFT_${id}_${Date.now() % 1000000}`;
  const abiCoder = new ethers.AbiCoder();
  const encodedName = abiCoder.encode(['string'], [name]);
  return NFT_BYTECODE + encodedName.slice(2);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

// ============================================
// DEPLOYMENT ENGINE
// ============================================

class FastDeployer {
  constructor(privateKey, rpcUrl, chainId) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.deployedContracts = [];
    this.pendingTxs = [];
    this.errors = [];
    this.startTime = null;
    this.currentNonce = 0;
    this.gasPrice = null;
    this.maxFeePerGas = null;
    this.maxPriorityFeePerGas = null;
  }

  async initialize() {
    console.log('\n🔗 Connecting to Tempo Moderato Testnet...');
    console.log(`   RPC: ${config.network.rpc}`);
    console.log(`   Chain ID: ${config.network.chainId}`);
    
    const network = await this.provider.getNetwork();
    console.log(`   Connected to chain: ${network.chainId}`);
    
    const balance = await this.provider.getBalance(this.wallet.address);
    console.log(`   Wallet: ${this.wallet.address}`);
    console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      throw new Error('Wallet has no balance! Get testnet tokens from Tempo faucet.');
    }
    
    this.currentNonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
    console.log(`   Starting nonce: ${this.currentNonce}`);
    
    // Get current gas prices from network
    console.log('   Fetching gas prices...');
    const feeData = await this.provider.getFeeData();
    
    // Use higher gas to ensure transactions go through
    // Multiply by 3x to avoid "underpriced" errors
    this.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? 
      feeData.maxPriorityFeePerGas * 3n : 
      ethers.parseUnits('10', 'gwei');
    
    this.maxFeePerGas = feeData.maxFeePerGas ? 
      feeData.maxFeePerGas * 3n : 
      ethers.parseUnits('50', 'gwei');
    
    // Fallback to legacy gas price if EIP-1559 not supported
    this.gasPrice = feeData.gasPrice ? 
      feeData.gasPrice * 3n : 
      ethers.parseUnits('30', 'gwei');
    
    console.log(`   Max Fee: ${ethers.formatUnits(this.maxFeePerGas, 'gwei')} gwei`);
    console.log(`   Priority Fee: ${ethers.formatUnits(this.maxPriorityFeePerGas, 'gwei')} gwei`);
    
    return true;
  }

  async deployContract(id, isNFT, nonce) {
    const bytecode = isNFT ? getNFTBytecode(id) : getSimpleBytecode(id);
    const type = isNFT ? 'NFT' : 'SIMPLE';
    
    try {
      const tx = {
        data: bytecode,
        nonce: nonce,
        gasLimit: 500000n,
        maxPriorityFeePerGas: this.maxPriorityFeePerGas,
        maxFeePerGas: this.maxFeePerGas,
        chainId: config.network.chainId,
        type: 2
      };

      const signedTx = await this.wallet.signTransaction(tx);
      const txResponse = await this.provider.broadcastTransaction(signedTx);
      
      const contractAddress = ethers.getCreateAddress({
        from: this.wallet.address,
        nonce: nonce
      });

      return {
        id,
        type,
        txHash: txResponse.hash,
        contractAddress,
        nonce,
        status: 'pending'
      };
    } catch (error) {
      return {
        id,
        type,
        error: error.message,
        nonce,
        status: 'failed'
      };
    }
  }

  async deployBatch(startIdx, count, startNonce, isNFT) {
    const results = [];
    const promises = [];

    for (let i = 0; i < count; i++) {
      const id = startIdx + i;
      const nonce = startNonce + i;
      promises.push(this.deployContract(id, isNFT, nonce));
      
      if (promises.length >= CONCURRENCY) {
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        promises.length = 0;
        await sleep(100);
      }
    }

    if (promises.length > 0) {
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return results;
  }

  async deployAll() {
    this.startTime = Date.now();
    
    const NFT_COUNT = Math.floor(TOTAL_CONTRACTS * (NFT_PERCENTAGE / 100));
    const SIMPLE_COUNT = TOTAL_CONTRACTS - NFT_COUNT;
    
    console.log('\n🚀 Starting deployment...');
    console.log(`   Total: ${TOTAL_CONTRACTS} contracts`);
    console.log(`   NFTs: ${NFT_COUNT} (${NFT_PERCENTAGE}%)`);
    console.log(`   Simple: ${SIMPLE_COUNT}`);
    console.log(`   Batch size: ${BATCH_SIZE}`);
    console.log(`   Concurrency: ${CONCURRENCY}`);
    console.log('');

    let deployed = 0;
    let nonce = this.currentNonce;

    // Deploy Simple contracts first
    console.log('📦 Deploying Simple Contracts...');
    for (let i = 0; i < SIMPLE_COUNT; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, SIMPLE_COUNT - i);
      const results = await this.deployBatch(i, batchCount, nonce, false);
      
      results.forEach(r => {
        if (r.status === 'pending') {
          this.deployedContracts.push(r);
        } else {
          this.errors.push(r);
        }
      });

      deployed += batchCount;
      nonce += batchCount;
      
      const progress = Math.round((deployed / TOTAL_CONTRACTS) * 100);
      const elapsed = formatTime(Date.now() - this.startTime);
      process.stdout.write(`\r   Progress: ${deployed}/${TOTAL_CONTRACTS} (${progress}%) | Time: ${elapsed} | Success: ${this.deployedContracts.length}`);
    }

    console.log('');

    // Deploy NFT contracts
    console.log('🎨 Deploying NFT Contracts...');
    for (let i = 0; i < NFT_COUNT; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, NFT_COUNT - i);
      const results = await this.deployBatch(SIMPLE_COUNT + i, batchCount, nonce, true);
      
      results.forEach(r => {
        if (r.status === 'pending') {
          this.deployedContracts.push(r);
        } else {
          this.errors.push(r);
        }
      });

      deployed += batchCount;
      nonce += batchCount;
      
      const progress = Math.round((deployed / TOTAL_CONTRACTS) * 100);
      const elapsed = formatTime(Date.now() - this.startTime);
      process.stdout.write(`\r   Progress: ${deployed}/${TOTAL_CONTRACTS} (${progress}%) | Time: ${elapsed} | Success: ${this.deployedContracts.length}`);
    }

    console.log('\n');
    return this.deployedContracts;
  }

  async waitForConfirmations(sampleSize = 10) {
    if (this.deployedContracts.length === 0) {
      console.log('⚠️ No successful deployments to confirm');
      return [];
    }
    
    console.log(`⏳ Waiting for ${Math.min(sampleSize, this.deployedContracts.length)} sample confirmations...`);
    
    const samples = this.deployedContracts.slice(0, sampleSize);
    const confirmed = [];
    
    for (const contract of samples) {
      try {
        const receipt = await this.provider.waitForTransaction(contract.txHash, 1, 30000);
        if (receipt && receipt.status === 1) {
          confirmed.push(contract);
          contract.status = 'confirmed';
          contract.blockNumber = receipt.blockNumber;
          console.log(`   ✅ Confirmed: ${contract.contractAddress}`);
        }
      } catch (e) {
        console.log(`   ⏰ Timeout for ${contract.txHash.slice(0, 16)}...`);
      }
    }
    
    console.log(`   ✅ ${confirmed.length}/${samples.length} samples confirmed`);
    return confirmed;
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const successCount = this.deployedContracts.length;
    const errorCount = this.errors.length;
    const rate = totalTime > 0 ? (successCount / (totalTime / 1000)).toFixed(2) : 0;

    const report = {
      summary: {
        totalContracts: TOTAL_CONTRACTS,
        successful: successCount,
        failed: errorCount,
        nftContracts: this.deployedContracts.filter(c => c.type === 'NFT').length,
        simpleContracts: this.deployedContracts.filter(c => c.type === 'SIMPLE').length,
        totalTime: formatTime(totalTime),
        deploymentRate: `${rate} contracts/sec`,
        network: config.network.name,
        explorer: config.network.explorer,
        deployer: this.wallet.address
      },
      contracts: this.deployedContracts.map(c => ({
        id: c.id,
        type: c.type,
        address: c.contractAddress,
        txHash: c.txHash,
        explorerUrl: `${config.network.explorer}/address/${c.contractAddress}`,
        txUrl: `${config.network.explorer}/tx/${c.txHash}`
      })),
      errors: this.errors.slice(0, 10) // Only first 10 errors
    };

    return report;
  }

  saveReport(report) {
    const filename = `deployment_${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${filename}`);
    return filename;
  }

  printSummary(report) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    DEPLOYMENT COMPLETE                      ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  Network:           ${report.summary.network}`);
    console.log(`  Deployer:          ${report.summary.deployer}`);
    console.log(`  Total Deployed:    ${report.summary.successful}/${TOTAL_CONTRACTS}`);
    console.log(`  NFT Contracts:     ${report.summary.nftContracts}`);
    console.log(`  Simple Contracts:  ${report.summary.simpleContracts}`);
    console.log(`  Failed:            ${report.summary.failed}`);
    console.log(`  Total Time:        ${report.summary.totalTime}`);
    console.log(`  Rate:              ${report.summary.deploymentRate}`);
    console.log(`  Explorer:          ${report.summary.explorer}`);
    console.log('═══════════════════════════════════════════════════════════');
    
    if (report.contracts.length > 0) {
      console.log('\n📋 Sample Deployed Contracts:');
      report.contracts.slice(0, 5).forEach((c, i) => {
        console.log(`   ${i + 1}. [${c.type}] ${c.address}`);
        console.log(`      Explorer: ${c.explorerUrl}`);
      });
      
      if (report.contracts.length > 5) {
        console.log(`   ... and ${report.contracts.length - 5} more`);
      }
    }
    
    if (report.errors.length > 0) {
      console.log('\n⚠️ Sample Errors:');
      report.errors.slice(0, 3).forEach((e, i) => {
        console.log(`   ${i + 1}. ID ${e.id}: ${e.error?.slice(0, 80)}...`);
      });
    }
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     TEMPO MODERATO FAST CONTRACT DEPLOYER                 ║');
  console.log('║     Deploy 1000 unique contracts in < 5 minutes           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  if (!config.privateKey || config.privateKey === 'YOUR_PRIVATE_KEY_HERE') {
    console.error('\n❌ ERROR: Please add your private key to config.js');
    console.error('   Open config.js and replace YOUR_PRIVATE_KEY_HERE with your key');
    process.exit(1);
  }

  const isTestMode = process.argv.includes('--test');
  const isAutoMode = process.argv.includes('--auto');
  const maxRounds = parseInt(process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1]) || Infinity;
  
  if (isTestMode) {
    console.log('\n🧪 TEST MODE: Will deploy only 10 contracts');
    TOTAL_CONTRACTS = 10;
  }
  
  if (isAutoMode) {
    console.log(`\n🔄 AUTO MODE: Will repeat deployment continuously`);
    if (maxRounds !== Infinity) {
      console.log(`   Max rounds: ${maxRounds}`);
    }
  }

  try {
    const deployer = new FastDeployer(
      config.privateKey,
      config.network.rpc,
      config.network.chainId
    );

    await deployer.initialize();
    await deployer.deployAll();
    
    await deployer.waitForConfirmations(5);
    
    const report = deployer.generateReport();
    deployer.saveReport(report);
    deployer.printSummary(report);

    console.log('\n✅ Deployment complete! Check the explorer for your contracts.');
    console.log(`   ${config.network.explorer}/address/${deployer.wallet.address}`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.message.includes('insufficient funds')) {
      console.error('   Get testnet tokens from: https://docs.tempo.xyz/guide/use-accounts/add-funds');
    }
    return false;
  }
}

async function autoLoop() {
  const maxRounds = parseInt(process.argv.find(a => a.startsWith('--rounds='))?.split('=')[1]) || Infinity;
  const delaySeconds = parseInt(process.argv.find(a => a.startsWith('--delay='))?.split('=')[1]) || 5;
  
  let round = 1;
  let totalDeployed = 0;
  const startTime = Date.now();
  
  console.log('\n🔁 AUTO-DEPLOY MODE STARTED');
  console.log(`   Delay between rounds: ${delaySeconds}s`);
  console.log('   Press Ctrl+C to stop\n');
  
  while (round <= maxRounds) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`   ROUND ${round}${maxRounds !== Infinity ? `/${maxRounds}` : ''}`);
    console.log(`${'═'.repeat(60)}`);
    
    const success = await main();
    
    if (success) {
      totalDeployed += TOTAL_CONTRACTS;
      console.log(`\n📊 TOTAL DEPLOYED: ${totalDeployed} contracts`);
      console.log(`   Running time: ${Math.floor((Date.now() - startTime) / 60000)} minutes`);
    }
    
    round++;
    
    if (round <= maxRounds) {
      console.log(`\n⏳ Next round in ${delaySeconds} seconds...`);
      await new Promise(r => setTimeout(r, delaySeconds * 1000));
    }
  }
  
  console.log('\n🏁 AUTO-DEPLOY FINISHED');
  console.log(`   Total rounds: ${round - 1}`);
  console.log(`   Total deployed: ${totalDeployed}`);
}

// Entry point
if (process.argv.includes('--auto')) {
  autoLoop().catch(console.error);
} else {
  main().catch(console.error);
}
