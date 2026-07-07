# Attribution

The Athanor pixel office is built on **Pixel Agents** by Pablo De Lucca,
used under the MIT License.

- Original project: https://github.com/pablodelucca/pixel-agents
- Character sprites credited by the original project to: JIK-A-4, Metro City
- License: MIT (see LICENSE.pixel-agents)

## What Athanor adds

- `athanor-bridge.mjs` — connects the Athanor swarm orchestrator (WebSocket)
  to the Pixel Agents office via its hook endpoint, so the three on-chain
  Athanor agents (Risk, Compliance, Treasury) appear as characters that act
  out each deliberation and on-chain signing.
- Integration with the Athanor Casper Testnet treasury contract, x402
  micropayments, and the swarm consensus engine.

All original Pixel Agents code remains under its MIT license. Modifications
and the bridge are provided under the same terms.
