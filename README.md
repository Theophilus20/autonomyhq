# AutonomyHQ 🏛

**An autonomous AI treasury on the Casper Network** — three LLM-powered agents
(Risk, Compliance, Treasury) run a real treasury: they convene on their own
schedule in a live pixel-art office, deliberate with genuine `gpt-4o-mini`
reasoning, sign every decision with ed25519, purchase market data through x402
micropayments, and execute approved decisions as **real transactions on Casper
Testnet**.

Built for the **Casper Agentic Buildathon 2026**.

## 🔗 Live on Casper Testnet

| | |
|---|---|
| **Treasury contract (package)** | [`hash-5f5bf585…ccda58`](https://testnet.cspr.live/contract-package/5f5bf585fe56fc504797a8f819aa7b2914d5ba95208a5c60a363ce57f1ccda58) |
| **Operator account** | [`01b58dbd…196a`](https://testnet.cspr.live/account/01b58dbd782cf6f33e240d78eec1831cf369aef257e64fc2c7e64a4c6001d8196a) — every agent transaction is visible here |
| **Contract** | Odra 2.4 (Rust → wasm), multi-sig agent registry + quorum-gated `execute_rebalance`, deployed with a custom Node.js deployer (`deploy-kit/`) |

## How it works

```
┌─────────────┐   WebSocket    ┌──────────────┐   hooks    ┌─────────────┐
│    Swarm    │───────────────▶│    Bridge    │───────────▶│ Pixel Office │
│ Orchestrator│  live events   └──────────────┘  animate   │  (visual)   │
│  (FastAPI)  │                                            └─────────────┘
│  3 agents ✕ │   approved     ┌──────────────┐  deploys   ┌─────────────┐
│ gpt-4o-mini │───────────────▶│   Recorder   │───────────▶│   CASPER    │
└─────────────┘   proposals    │  (Node+SDK)  │  real tx   │   TESTNET   │
       ▲                       └──────────────┘            └─────────────┘
       │ x402: 402 → ed25519-signed payment → 200 (+ real CSPR transfer)
┌─────────────┐
│ Data Mesh   │
│ Gateway     │
└─────────────┘
```

1. **Agents decide when to meet.** A drifting market context triggers
   autonomous deliberations every few minutes (or press NEW PROPOSAL).
2. **Real reasoning.** Each agent evaluates the proposal through its own
   role-prompted OpenRouter call; a rejection by one agent blocks quorum —
   the agents are not rubber stamps.
3. **Real signatures.** Every vote is ed25519-signed and independently
   verified before a proposal finalizes.
4. **Real transactions.** Approved proposals are queued and recorded
   on-chain: a transaction calls `execute_rebalance` on the deployed
   contract. x402 data purchases settle with real Testnet transfers.
5. **Mission Control** (localhost:3200) shows all of it live: the office,
   the reasoning stream, quorum, feedback, and clickable on-chain links.

## Quickstart (Windows)

```bat
:: prerequisites: Node 20+, Python 3.12+, an OpenRouter API key
setx OPENROUTER_API_KEY "sk-or-v1-..."

cd apps\swarm-orchestrator && pip install -r requirements.txt && cd ..\..
cd apps\office && npm install && cd ..\..
cd apps\data-mesh-gateway && npm install && cd ..\..
cd deploy-kit && npm install && node deploy.mjs keygen && cd ..
:: fund the printed public key at https://testnet.cspr.live/tools/faucet
:: then deploy your own instance (or use ours above):
::   node deploy.mjs deploy ..\contracts\wasm\AthanorTreasury.wasm

start.bat   :: launches all 6 services and opens Mission Control
```

## Honest scope

- Agent reasoning is real LLM output (marked 🧠); if the API is unreachable
  it falls back to deterministic rules and says so in the reasoning line.
- x402 settlements ride a 2.5 CSPR carrier transfer (Casper's minimum);
  the 0.025 CSPR data price is protocol-level.
- Portfolio dollar figures on the dashboard are illustrative placeholders.
- The on-chain module keeps its original codename `AthanorTreasury`
  (contracts are immutable; the product was renamed AutonomyHQ mid-build).

## Attribution

The pixel office is a fork of [Pixel Agents](https://github.com/pablodelucca/pixel-agents)
by Pablo De Lucca (MIT — see `apps/office/LICENSE.pixel-agents` and
`apps/office/ATTRIBUTION.md`). Character/tile art credits: JIK-A-4 / Metro City.

## License

MIT
