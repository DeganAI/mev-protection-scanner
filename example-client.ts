/**
 * Example Client for MEV Protection Scanner
 * 
 * This demonstrates how to integrate the MEV scanner into your application
 * with proper x402 payment handling.
 */

// Example 1: Basic scan without authentication
async function basicScan() {
  const AGENT_URL = "https://mev-scanner.yourdomain.com";

  try {
    // Step 1: Make initial request (will return 402)
    const response = await fetch(`${AGENT_URL}/entrypoints/scan_transaction/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          token_in: "USDC",
          token_out: "ETH",
          amount_in: "1000",
          dex: "uniswap-v2",
        },
      }),
    });

    if (response.status === 402) {
      // Step 2: Parse payment requirements
      const paymentInfo = await response.json();
      console.log("Payment required:", paymentInfo);

      /**
       * paymentInfo structure:
       * {
       *   x402Version: 1,
       *   accepts: [{
       *     scheme: "exact",
       *     network: "base",
       *     maxAmountRequired: "1000",
       *     resource: "/entrypoints/scan_transaction/invoke",
       *     payTo: "0xYourAddress",
       *     asset: "base-unit"
       *   }]
       * }
       */

      // Step 3: Make payment using your wallet
      const paymentProof = await makePayment(paymentInfo.accepts[0]);

      // Step 4: Retry request with payment proof
      const paidResponse = await fetch(`${AGENT_URL}/entrypoints/scan_transaction/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Transaction": paymentProof,
        },
        body: JSON.stringify({
          input: {
            token_in: "USDC",
            token_out: "ETH",
            amount_in: "1000",
            dex: "uniswap-v2",
          },
        }),
      });

      if (paidResponse.ok) {
        const result = await paidResponse.json();
        console.log("MEV Scan Result:", result.output);
        
        // Display results to user
        displayResults(result.output);
      }
    }
  } catch (error) {
    console.error("Scan error:", error);
  }
}

// Example 2: Using agent-kit's payment utilities
async function scanWithAgentKit() {
  const { createRuntimePaymentContext } = await import("@lucid-dreams/agent-kit");
  const { AgentRuntime } = await import("@lucid-dreams/agent-auth");

  // Initialize agent runtime with wallet
  const { runtime } = await AgentRuntime.load({
    wallet: {
      signer: {
        async signChallenge(challenge) {
          // Implement your signing logic
          return `signed:${challenge.id}`;
        },
      },
    },
  });

  // Create payment-enabled fetch
  const { fetchWithPayment } = await createRuntimePaymentContext({ runtime });

  // Make paid request automatically
  const response = await fetchWithPayment(
    "https://mev-scanner.yourdomain.com/entrypoints/scan_transaction/invoke",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: {
          token_in: "USDC",
          token_out: "ETH",
          amount_in: "5000",
          dex: "uniswap-v3",
        },
      }),
    }
  );

  const result = await response.json();
  return result.output;
}

// Example 3: Integration with a trading bot
class TradingBot {
  private mevScannerUrl: string;
  private paymentWallet: any;

  constructor(scannerUrl: string, wallet: any) {
    this.mevScannerUrl = scannerUrl;
    this.paymentWallet = wallet;
  }

  async executeTrade(trade: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    dex: string;
  }) {
    // Step 1: Scan for MEV risk before executing
    const mevRisk = await this.scanMEVRisk(trade);

    console.log(`MEV Risk Score: ${mevRisk.risk_score}/100`);
    console.log(`Attack Type: ${mevRisk.attack_type}`);
    console.log(`Estimated Loss: $${mevRisk.estimated_loss_usd}`);

    // Step 2: Decide whether to proceed
    if (mevRisk.risk_score > 70) {
      console.warn("⚠️ HIGH MEV RISK DETECTED!");
      console.log("Protection suggestions:");
      mevRisk.protection_suggestions.forEach(s => console.log(`  - ${s}`));

      // Option A: Cancel trade
      // return { cancelled: true, reason: "MEV risk too high" };

      // Option B: Apply protection strategies
      return await this.executeProtectedTrade(trade, mevRisk);
    } else if (mevRisk.risk_score > 40) {
      console.log("⚠️ Moderate MEV risk - applying protections");
      return await this.executeProtectedTrade(trade, mevRisk);
    } else {
      console.log("✅ Low MEV risk - proceeding normally");
      return await this.executeNormalTrade(trade);
    }
  }

  private async scanMEVRisk(trade: any) {
    const response = await fetch(`${this.mevScannerUrl}/entrypoints/scan_transaction/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Transaction": await this.getPaymentProof(),
      },
      body: JSON.stringify({
        input: {
          token_in: trade.tokenIn,
          token_out: trade.tokenOut,
          amount_in: trade.amountIn,
          dex: trade.dex,
        },
      }),
    });

    const result = await response.json();
    return result.output;
  }

  private async executeProtectedTrade(trade: any, mevRisk: any) {
    // Apply protection strategies
    const protectedTrade = {
      ...trade,
      // Use Flashbots or private RPC
      rpcUrl: "https://rpc.flashbots.net",
      // Increase slippage based on recommendation
      slippage: mevRisk.optimal_slippage || 2.0,
      // Use recommended gas price
      gasPrice: mevRisk.recommended_gas_price,
    };

    console.log("Executing protected trade with:", protectedTrade);
    // ... execute trade logic
  }

  private async executeNormalTrade(trade: any) {
    console.log("Executing normal trade:", trade);
    // ... execute trade logic
  }

  private async getPaymentProof(): Promise<string> {
    // Implement payment logic with your wallet
    return "payment_proof_here";
  }
}

// Example 4: Wallet integration example
async function walletIntegrationExample() {
  const SCANNER_URL = "https://mev-scanner.yourdomain.com";

  // User initiates swap in your wallet UI
  const swapParams = {
    tokenIn: "USDC",
    tokenOut: "ETH",
    amountIn: "1000",
    dex: "uniswap-v2",
  };

  // Show "Checking for MEV risks..." loading state
  const mevAnalysis = await checkMEVRisk(SCANNER_URL, swapParams);

  // Display results in UI
  if (mevAnalysis.risk_score > 60) {
    // Show warning modal
    return {
      proceed: false,
      warning: {
        title: "⚠️ High MEV Risk Detected",
        message: `This swap has a ${mevAnalysis.risk_score}% MEV risk. You could lose up to $${mevAnalysis.estimated_loss_usd}.`,
        suggestions: mevAnalysis.protection_suggestions,
        actions: [
          { label: "Cancel", value: "cancel" },
          { label: "Use Flashbots", value: "flashbots" },
          { label: "Proceed Anyway", value: "proceed", danger: true },
        ],
      },
    };
  } else {
    // Show success indicator
    return {
      proceed: true,
      info: {
        icon: "✅",
        message: `Low MEV risk (${mevAnalysis.risk_score}%)`,
        gasSuggestion: mevAnalysis.recommended_gas_price,
      },
    };
  }
}

async function checkMEVRisk(url: string, params: any) {
  // Implementation with payment handling
  const response = await fetch(`${url}/entrypoints/scan_transaction/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Transaction": await getPaymentProofFromUserWallet(),
    },
    body: JSON.stringify({ input: params }),
  });

  const result = await response.json();
  return result.output;
}

// Example 5: Batch scanning for multiple trades
async function batchScanTrades(trades: Array<any>) {
  const SCANNER_URL = "https://mev-scanner.yourdomain.com";
  const results = [];

  for (const trade of trades) {
    const analysis = await fetch(`${SCANNER_URL}/entrypoints/scan_transaction/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Transaction": await getPaymentProof(),
      },
      body: JSON.stringify({
        input: {
          token_in: trade.tokenIn,
          token_out: trade.tokenOut,
          amount_in: trade.amountIn,
          dex: trade.dex,
        },
      }),
    });

    const result = await analysis.json();
    results.push({
      trade,
      risk: result.output,
    });

    // Wait a bit between requests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Sort by risk score (highest risk first)
  return results.sort((a, b) => b.risk.risk_score - a.risk.risk_score);
}

// Helper function to display results nicely
function displayResults(output: any) {
  console.log("\n📊 MEV SCAN RESULTS");
  console.log("=".repeat(50));
  console.log(`Risk Score: ${output.risk_score}/100`);
  console.log(`Attack Type: ${output.attack_type}`);
  console.log(`Estimated Loss: $${output.estimated_loss_usd}`);
  console.log(`Competing Transactions: ${output.competing_txs}`);
  console.log(`Gas Percentile: ${output.gas_price_percentile}%`);
  
  if (output.detected_patterns.length > 0) {
    console.log("\n🔍 Detected Patterns:");
    output.detected_patterns.forEach((pattern: string) => {
      console.log(`  • ${pattern}`);
    });
  }

  console.log("\n💡 Protection Suggestions:");
  output.protection_suggestions.forEach((suggestion: string) => {
    console.log(`  ${suggestion}`);
  });

  if (output.recommended_gas_price) {
    console.log(`\n⛽ Recommended Gas: ${output.recommended_gas_price}`);
  }
  
  if (output.optimal_slippage) {
    console.log(`📊 Optimal Slippage: ${output.optimal_slippage}%`);
  }
  
  console.log("=".repeat(50) + "\n");
}

// Mock payment function (implement with your actual payment logic)
async function makePayment(paymentRequest: any): Promise<string> {
  console.log("Making payment:", paymentRequest);
  
  // In a real implementation, you would:
  // 1. Connect to user's wallet
  // 2. Create and sign a transaction
  // 3. Submit to Base network
  // 4. Return transaction hash as proof
  
  return "0x" + Math.random().toString(16).slice(2);
}

async function getPaymentProofFromUserWallet(): Promise<string> {
  // Implement wallet integration
  return "payment_proof";
}

async function getPaymentProof(): Promise<string> {
  // Implement payment proof generation
  return "payment_proof";
}

// Export examples
export {
  basicScan,
  scanWithAgentKit,
  TradingBot,
  walletIntegrationExample,
  batchScanTrades,
  displayResults,
};

// Run example if executed directly
if (import.meta.main) {
  console.log("🚀 MEV Protection Scanner - Client Examples\n");
  
  // Uncomment to run examples:
  // await basicScan();
  // await walletIntegrationExample();
  
  console.log("✅ Examples loaded. Import functions to use them.");
}
