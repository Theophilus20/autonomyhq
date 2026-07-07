// Athanor MCP Router.
//
// Routes agent intents to the correct Model Context Protocol server:
//   - liquidity / swap intents  -> CSPR.trade MCP server
//   - state / contract queries   -> Casper MCP server
//
// This is a thin, dependency-light router. The actual MCP client transport is
// pluggable: when the real @casper-network/mcp-server and @csprtrade/mcp-server
// packages are installed, set USE_REAL_MCP=1 and they are spawned over stdio.
// Otherwise a local stub answers so the pipeline runs end-to-end offline.

import { spawn } from "node:child_process";

const USE_REAL_MCP = process.env.USE_REAL_MCP === "1";

function stubTool(server, tool, args) {
  // Deterministic stub responses mirroring the shape real MCP tools return.
  if (tool === "execute_swap_search") {
    return {
      server,
      tool,
      result: {
        pair: args.prompt?.includes("GOLD") ? "GOLD-RWA/CSPR" : "CSPR/USDC",
        bestRoute: ["CSPR", "USDC", args.targetAsset || "GOLD-RWA"],
        estPriceImpact: 0.0031,
        venue: "cspr.trade",
      },
    };
  }
  return {
    server,
    tool,
    result: {
      path: args.path || "contracts/ath_treasury",
      state: { operational: true, requiredSignatures: 3, rebalanceCount: 7 },
      source: "casper-testnet",
    },
  };
}

async function realMcpCall(command, cliArgs, tool, toolArgs) {
  // Minimal stdio JSON-RPC call to a spawned MCP server process.
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", [command, ...cliArgs], { stdio: ["pipe", "pipe", "inherit"] });
    const req =
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: tool, arguments: toolArgs },
      }) + "\n";
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      try {
        const line = out.split("\n").find((l) => l.includes('"result"'));
        resolve(JSON.parse(line));
      } catch (e) {
        reject(e);
      }
    });
    proc.stdin.write(req);
    proc.stdin.end();
    setTimeout(() => {
      proc.kill();
      reject(new Error("mcp timeout"));
    }, 15000);
  });
}

export async function processAgentIntent(agentPrompt, targetContext = "") {
  const wantsTrade =
    targetContext.includes("liquidity") ||
    targetContext.includes("swap") ||
    agentPrompt.toLowerCase().includes("swap");

  if (wantsTrade) {
    if (USE_REAL_MCP) {
      return realMcpCall("@csprtrade/mcp-server", [], "execute_swap_search", {
        prompt: agentPrompt,
      });
    }
    return stubTool("cspr.trade", "execute_swap_search", { prompt: agentPrompt });
  }

  if (USE_REAL_MCP) {
    return realMcpCall("@casper-network/mcp-server", ["--testnet"], "query_state", {
      path: "contracts/ath_treasury",
    });
  }
  return stubTool("casper", "query_state", { path: "contracts/ath_treasury" });
}

// CLI smoke test: node src/mcp_router.js
if (import.meta.url === `file://${process.argv[1]}`) {
  const run = async () => {
    console.log("swap intent ->", JSON.stringify(await processAgentIntent("swap GOLD-RWA", "liquidity"), null, 2));
    console.log("state intent ->", JSON.stringify(await processAgentIntent("check treasury", "state"), null, 2));
  };
  run();
}
