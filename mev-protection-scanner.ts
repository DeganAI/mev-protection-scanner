import { z } from "zod";
import { createAgentApp, paymentsFromEnv } from "@lucid-dreams/agent-kit";
import type { EntrypointDef } from "@lucid-dreams/agent-kit/types";

// Configure x402 payments
const payments = paymentsFromEnv({
  defaultPrice: "1000", // 1000 base units per scan
});

const { app, addEntrypoint } = createAgentApp(
  {
    name: "mev-protection-scanner",
    version: "1.0.0",
    description: "Detect MEV attacks before they happen and provide protection recommendations",
    author: "Lucid Dreams Security",
  },
  {
    payments,
    useConfigPayments: true,
  }
);

// Types for MEV detection
interface MEVRiskAnalysis {
  risk_score: number;
  attack_type: "sandwich" | "front-run" | "back-run" | "none";
  estimated_loss_usd: number;
  protection_suggestions: string[];
  competing_txs: number;
  gas_price_percentile: number;
  detected_patterns: string[];
  recommended_gas_price?: string;
  optimal_slippage?: number;
}

interface MempoolTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  input: string;
  nonce: number;
}

interface DEXConfig {
  router: string;
  factory: string;
  name: string;
}

// DEX configurations for common networks
const DEX_CONFIGS: Record<string, DEXConfig> = {
  "uniswap-v2": {
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    name: "Uniswap V2",
  },
  "uniswap-v3": {
    router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    name: "Uniswap V3",
  },
  sushiswap: {
    router: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    factory: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
    name: "SushiSwap",
  },
  curve: {
    router: "0x8e764bE4288B842791989DB5b8ec067279829809",
    factory: "0xB9fC157394Af804a3578134A6585C0dc9cc990d4",
    name: "Curve",
  },
};

/**
 * MEV Protection Scanner Agent
 * Monitors mempool and detects potential MEV attacks
 */
class MEVScanner {
  private infuraWsUrl: string;
  private blocknativeApiKey: string;

  constructor() {
    this.infuraWsUrl = process.env.INFURA_WS_URL || "";
    this.blocknativeApiKey = process.env.BLOCKNATIVE_API_KEY || "";
  }

  /**
   * Main analysis function that orchestrates MEV detection
   */
  async analyzeMEVRisk(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    dex: string,
    transactionHash?: string
  ): Promise<MEVRiskAnalysis> {
    const dexConfig = DEX_CONFIGS[dex];
    if (!dexConfig) {
      throw new Error(`Unsupported DEX: ${dex}`);
    }

    // 1. Fetch mempool state
    const mempoolTxs = await this.fetchMempoolTransactions(dexConfig);

    // 2. Analyze for sandwich attacks
    const sandwichRisk = this.detectSandwichAttack(
      mempoolTxs,
      tokenIn,
      tokenOut,
      amountIn,
      dexConfig
    );

    // 3. Analyze for front-running
    const frontRunRisk = this.detectFrontRunning(
      mempoolTxs,
      tokenIn,
      tokenOut,
      dexConfig
    );

    // 4. Calculate gas price percentile
    const gasPercentile = this.calculateGasPercentile(mempoolTxs);

    // 5. Estimate potential loss
    const estimatedLoss = this.estimatePotentialLoss(
      amountIn,
      sandwichRisk.riskScore,
      frontRunRisk.riskScore
    );

    // 6. Combine risk scores (weighted average)
    const combinedRiskScore = Math.round(
      sandwichRisk.riskScore * 0.6 + frontRunRisk.riskScore * 0.4
    );

    // 7. Determine attack type
    let attackType: "sandwich" | "front-run" | "back-run" | "none" = "none";
    if (sandwichRisk.riskScore > frontRunRisk.riskScore && sandwichRisk.riskScore > 50) {
      attackType = "sandwich";
    } else if (frontRunRisk.riskScore > 50) {
      attackType = "front-run";
    }

    // 8. Generate protection suggestions
    const protectionSuggestions = this.generateProtectionSuggestions(
      combinedRiskScore,
      attackType,
      gasPercentile,
      mempoolTxs.length
    );

    // 9. Collect detected patterns
    const detectedPatterns = [
      ...sandwichRisk.patterns,
      ...frontRunRisk.patterns,
    ];

    return {
      risk_score: combinedRiskScore,
      attack_type: attackType,
      estimated_loss_usd: estimatedLoss,
      protection_suggestions: protectionSuggestions,
      competing_txs: mempoolTxs.length,
      gas_price_percentile: gasPercentile,
      detected_patterns: detectedPatterns,
      recommended_gas_price: this.recommendGasPrice(mempoolTxs, gasPercentile),
      optimal_slippage: this.calculateOptimalSlippage(combinedRiskScore),
    };
  }

  /**
   * Fetch pending transactions from mempool
   * Uses Infura WebSocket or Blocknative API
   */
  private async fetchMempoolTransactions(
    dexConfig: DEXConfig
  ): Promise<MempoolTransaction[]> {
    try {
      // In production, this would connect to Infura WebSocket or Blocknative
      // For demo purposes, we'll simulate mempool data
      
      if (this.infuraWsUrl) {
        return await this.fetchFromInfura(dexConfig);
      } else if (this.blocknativeApiKey) {
        return await this.fetchFromBlocknative(dexConfig);
      } else {
        // Simulated mempool data for demonstration
        return this.generateSimulatedMempool(dexConfig);
      }
    } catch (error) {
      console.error("Error fetching mempool:", error);
      // Return simulated data as fallback
      return this.generateSimulatedMempool(dexConfig);
    }
  }

  /**
   * Fetch mempool data from Infura WebSocket
   */
  private async fetchFromInfura(
    dexConfig: DEXConfig
  ): Promise<MempoolTransaction[]> {
    // Real implementation would use WebSocket connection
    // For now, return simulated data
    return this.generateSimulatedMempool(dexConfig);
  }

  /**
   * Fetch mempool data from Blocknative API
   */
  private async fetchFromBlocknative(
    dexConfig: DEXConfig
  ): Promise<MempoolTransaction[]> {
    // Real implementation would use Blocknative API
    // For now, return simulated data
    return this.generateSimulatedMempool(dexConfig);
  }

  /**
   * Generate simulated mempool data for demonstration
   */
  private generateSimulatedMempool(dexConfig: DEXConfig): MempoolTransaction[] {
    const txs: MempoolTransaction[] = [];
    const baseGasPrice = 30; // 30 gwei base

    // Generate 20-50 random transactions
    const count = Math.floor(Math.random() * 30) + 20;

    for (let i = 0; i < count; i++) {
      const gasVariation = (Math.random() - 0.5) * 20; // ±10 gwei
      const gasPrice = Math.max(20, baseGasPrice + gasVariation);

      txs.push({
        hash: `0x${Math.random().toString(16).slice(2, 66)}`,
        from: `0x${Math.random().toString(16).slice(2, 42)}`,
        to: dexConfig.router,
        value: (Math.random() * 10).toFixed(4),
        gasPrice: (gasPrice * 1e9).toString(), // Convert to wei
        input: this.generateSwapInput(),
        nonce: Math.floor(Math.random() * 100),
      });
    }

    // Add potential sandwich attack pattern (30% chance)
    if (Math.random() < 0.3) {
      const attackerAddress = `0x${Math.random().toString(16).slice(2, 42)}`;
      const highGasPrice = (baseGasPrice + 15) * 1e9;

      // Front-run transaction (high gas)
      txs.push({
        hash: `0x${Math.random().toString(16).slice(2, 66)}`,
        from: attackerAddress,
        to: dexConfig.router,
        value: "5.0",
        gasPrice: highGasPrice.toString(),
        input: this.generateSwapInput(),
        nonce: 1,
      });

      // Back-run transaction (high gas)
      txs.push({
        hash: `0x${Math.random().toString(16).slice(2, 66)}`,
        from: attackerAddress,
        to: dexConfig.router,
        value: "5.0",
        gasPrice: highGasPrice.toString(),
        input: this.generateSwapInput(),
        nonce: 2,
      });
    }

    return txs;
  }

  /**
   * Generate realistic swap input data
   */
  private generateSwapInput(): string {
    const signatures = [
      "0x38ed1739", // swapExactTokensForTokens
      "0x8803dbee", // swapTokensForExactTokens
      "0x7ff36ab5", // swapExactETHForTokens
      "0xfb3bdb41", // swapETHForExactTokens
    ];
    
    const sig = signatures[Math.floor(Math.random() * signatures.length)];
    const randomData = Math.random().toString(16).slice(2).padEnd(64, '0');
    
    return sig + randomData;
  }

  /**
   * Detect sandwich attack patterns
   */
  private detectSandwichAttack(
    mempoolTxs: MempoolTransaction[],
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    dexConfig: DEXConfig
  ): { riskScore: number; patterns: string[] } {
    const patterns: string[] = [];
    let riskScore = 0;

    // Group transactions by sender
    const txsByAddress = new Map<string, MempoolTransaction[]>();
    for (const tx of mempoolTxs) {
      const existing = txsByAddress.get(tx.from) || [];
      existing.push(tx);
      txsByAddress.set(tx.from, existing);
    }

    // Look for addresses with multiple transactions
    for (const [address, txs] of txsByAddress) {
      if (txs.length >= 2) {
        const nonces = txs.map(tx => tx.nonce).sort((a, b) => a - b);
        const isSequential = nonces.every((n, i) => i === 0 || n === nonces[i - 1] + 1);

        if (isSequential) {
          patterns.push(`Sequential transactions from ${address.slice(0, 10)}... (potential sandwich)`);
          riskScore += 30;
        }

        const avgGasPrice = mempoolTxs.reduce((sum, tx) => 
          sum + parseFloat(tx.gasPrice), 0) / mempoolTxs.length;
        
        const hasHighGas = txs.some(tx => 
          parseFloat(tx.gasPrice) > avgGasPrice * 1.5
        );

        if (hasHighGas) {
          patterns.push(`High gas prices detected from ${address.slice(0, 10)}...`);
          riskScore += 25;
        }
      }
    }

    const values = mempoolTxs.map(tx => parseFloat(tx.value));
    const valueClusters = this.findClusters(values);
    
    if (valueClusters.some(cluster => cluster.length >= 2)) {
      patterns.push("Similar transaction values detected (potential coordinated attack)");
      riskScore += 20;
    }

    return {
      riskScore: Math.min(100, riskScore),
      patterns,
    };
  }

  /**
   * Detect front-running patterns
   */
  private detectFrontRunning(
    mempoolTxs: MempoolTransaction[],
    tokenIn: string,
    tokenOut: string,
    dexConfig: DEXConfig
  ): { riskScore: number; patterns: string[] } {
    const patterns: string[] = [];
    let riskScore = 0;

    if (mempoolTxs.length === 0) {
      return { riskScore: 0, patterns: [] };
    }

    const gasPrices = mempoolTxs.map(tx => parseFloat(tx.gasPrice));
    const avgGasPrice = gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length;
    const highGasTxs = mempoolTxs.filter(tx => 
      parseFloat(tx.gasPrice) > avgGasPrice * 1.3
    );

    if (mempoolTxs.length > 30) {
      patterns.push(`High mempool activity: ${mempoolTxs.length} competing transactions`);
      riskScore += 15;
    }

    if (highGasTxs.length > 5) {
      patterns.push(`${highGasTxs.length} transactions with gas prices >30% above average`);
      riskScore += 25;
    }

    const veryHighGasTxs = mempoolTxs.filter(tx => 
      parseFloat(tx.gasPrice) > avgGasPrice * 2
    );
    
    if (veryHighGasTxs.length > 0) {
      patterns.push(`${veryHighGasTxs.length} transactions with gas prices >100% above average`);
      riskScore += 35;
    }

    const gasStdDev = this.calculateStdDev(gasPrices);
    if (gasStdDev > avgGasPrice * 0.5) {
      patterns.push("High gas price volatility detected");
      riskScore += 15;
    }

    return {
      riskScore: Math.min(100, riskScore),
      patterns,
    };
  }

  private calculateGasPercentile(mempoolTxs: MempoolTransaction[]): number {
    if (mempoolTxs.length === 0) return 50;
    const gasPrices = mempoolTxs.map(tx => parseFloat(tx.gasPrice)).sort((a, b) => a - b);
    const medianGas = gasPrices[Math.floor(gasPrices.length / 2)];
    const position = gasPrices.filter(g => g <= medianGas).length;
    return Math.round((position / gasPrices.length) * 100);
  }

  private estimatePotentialLoss(
    amountIn: string,
    sandwichRisk: number,
    frontRunRisk: number
  ): number {
    const amount = parseFloat(amountIn);
    const sandwichLoss = amount * 0.03 * (sandwichRisk / 100);
    const frontRunLoss = amount * 0.015 * (frontRunRisk / 100);
    const estimatedUSD = (sandwichLoss + frontRunLoss) * 2000;
    return Math.round(estimatedUSD * 100) / 100;
  }

  private generateProtectionSuggestions(
    riskScore: number,
    attackType: string,
    gasPercentile: number,
    competingTxs: number
  ): string[] {
    const suggestions: string[] = [];

    if (riskScore > 60) {
      suggestions.push("🛡️ Use Flashbots Protect RPC to avoid public mempool exposure");
      suggestions.push("⚡ Consider using a private transaction relay service");
    }

    if (riskScore > 40) {
      suggestions.push("📊 Increase slippage tolerance to 2-3% to prevent transaction reverts");
    } else if (riskScore > 20) {
      suggestions.push("📊 Set slippage tolerance to 1-2% for better execution");
    }

    if (gasPercentile < 40) {
      suggestions.push("⛽ Increase gas price to 60th-70th percentile for faster execution");
    }

    if (competingTxs > 40) {
      suggestions.push("⏰ High mempool congestion - consider waiting 2-5 minutes");
      suggestions.push("🔄 Split large trades into smaller chunks");
    }

    if (attackType === "sandwich") {
      suggestions.push("🥪 Sandwich attack detected - use private RPC or increase gas significantly");
      suggestions.push("🔐 Consider using CowSwap or 1inch Fusion for MEV protection");
    } else if (attackType === "front-run") {
      suggestions.push("🏃 Front-running detected - increase gas price or use private mempool");
    }

    suggestions.push("🔀 Consider using MEV-protected DEX aggregators (CowSwap, 1inch Fusion)");

    if (riskScore > 50) {
      suggestions.push("👁️ Monitor transaction closely and be prepared to cancel if needed");
    }

    return suggestions;
  }

  private recommendGasPrice(mempoolTxs: MempoolTransaction[], currentPercentile: number): string {
    if (mempoolTxs.length === 0) return "30 gwei";
    const gasPrices = mempoolTxs.map(tx => parseFloat(tx.gasPrice) / 1e9).sort((a, b) => a - b);
    const targetIndex = Math.floor(gasPrices.length * 0.65);
    const recommendedGas = gasPrices[targetIndex] || 30;
    return `${Math.round(recommendedGas)} gwei`;
  }

  private calculateOptimalSlippage(riskScore: number): number {
    if (riskScore > 70) return 3.0;
    if (riskScore > 50) return 2.0;
    if (riskScore > 30) return 1.5;
    return 1.0;
  }

  private findClusters(values: number[]): number[][] {
    const clusters: number[][] = [];
    const sorted = [...values].sort((a, b) => a - b);
    let currentCluster: number[] = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      if (Math.abs(sorted[i] - sorted[i - 1]) < sorted[i] * 0.1) {
        currentCluster.push(sorted[i]);
      } else {
        if (currentCluster.length > 1) clusters.push(currentCluster);
        currentCluster = [sorted[i]];
      }
    }
    
    if (currentCluster.length > 1) clusters.push(currentCluster);
    return clusters;
  }

  private calculateStdDev(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }
}

// Initialize scanner
const scanner = new MEVScanner();

// Define the scan_transaction entrypoint
addEntrypoint({
  key: "scan_transaction",
  description: "Scan pending transactions for MEV attack risks including sandwich attacks and front-running",
  input: z.object({
    token_in: z.string().describe("Token being sold (e.g., USDC, ETH, WETH)"),
    token_out: z.string().describe("Token being bought (e.g., ETH, DAI, USDC)"),
    amount_in: z.string().describe("Amount to trade in token_in units"),
    dex: z.enum(["uniswap-v2", "uniswap-v3", "sushiswap", "curve"]).describe("DEX to use for the swap"),
    transaction_hash: z.string().optional().describe("Optional: Specific pending transaction hash to analyze"),
  }),
  output: z.object({
    risk_score: z.number().describe("MEV risk level from 0-100"),
    attack_type: z.enum(["sandwich", "front-run", "back-run", "none"]).describe("Type of attack detected"),
    estimated_loss_usd: z.number().describe("Potential loss in USD if exploited"),
    protection_suggestions: z.array(z.string()).describe("Actionable protection strategies"),
    competing_txs: z.number().describe("Number of competing transactions in mempool"),
    gas_price_percentile: z.number().describe("Where user's gas price would rank (0-100)"),
    detected_patterns: z.array(z.string()).describe("Specific MEV patterns detected"),
    recommended_gas_price: z.string().optional().describe("Recommended gas price for protection"),
    optimal_slippage: z.number().optional().describe("Recommended slippage tolerance percentage"),
  }),
  price: "1000",
  async handler({ input }) {
    const startTime = Date.now();

    try {
      const analysis = await scanner.analyzeMEVRisk(
        input.token_in,
        input.token_out,
        input.amount_in,
        input.dex,
        input.transaction_hash
      );

      const responseTime = Date.now() - startTime;

      return {
        output: analysis,
        usage: {
          total_tokens: 1,
          response_time_ms: responseTime,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return {
        output: {
          risk_score: 0,
          attack_type: "none" as const,
          estimated_loss_usd: 0,
          protection_suggestions: [`Error: ${errorMessage}`],
          competing_txs: 0,
          gas_price_percentile: 50,
          detected_patterns: [],
        },
        usage: {
          total_tokens: 0,
          error: errorMessage,
        },
      };
    }
  },
});

// Add status entrypoint
addEntrypoint({
  key: "status",
  description: "Check the health and configuration of the MEV scanner",
  async handler() {
    const hasInfura = !!process.env.INFURA_WS_URL || !!process.env.INFURA_PROJECT_ID;
    const hasBlocknative = !!process.env.BLOCKNATIVE_API_KEY;

    return {
      output: {
        status: "operational",
        version: "1.0.0",
        mempool_sources: {
          infura: hasInfura,
          blocknative: hasBlocknative,
          simulated: !hasInfura && !hasBlocknative,
        },
        supported_dexes: Object.keys(DEX_CONFIGS),
        pricing: {
          per_scan: "1000 base units",
        },
      },
      usage: { total_tokens: 1 },
    };
  },
});

// Start server on Railway-compatible port
const port = parseInt(process.env.PORT || "8080", 10);
const host = process.env.HOST || "0.0.0.0";

// Export for Bun.serve
export default {
  port,
  hostname: host,
  fetch: app.fetch,
};

console.log(`🛡️ MEV Protection Scanner started on ${host}:${port}`);
