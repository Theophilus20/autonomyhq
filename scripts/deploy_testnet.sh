#!/usr/bin/env bash
#
# Deploy AthanorTreasury to Casper Testnet.
#
# Prereqs (on YOUR machine — this sandbox can't hold your secret key):
#   1. Rust + wasm target:   rustup target add wasm32-unknown-unknown
#   2. cargo-odra:           cargo install cargo-odra --locked
#   3. casper-client:        cargo install casper-client --locked
#   4. A funded testnet key. Generate + fund:
#        casper-client keygen ./keys
#        # then fund the public key at https://testnet.cspr.live/tools/faucet
#
# Usage:
#   ./scripts/deploy_testnet.sh ./keys/secret_key.pem
#
set -euo pipefail

SECRET_KEY="${1:-./keys/secret_key.pem}"
NODE_ADDRESS="${CASPER_NODE:-https://node.testnet.cspr.live}"
CHAIN_NAME="casper-test"
PAYMENT_AMOUNT="${PAYMENT_AMOUNT:-300000000000}" # 300 CSPR in motes for install

if [[ ! -f "$SECRET_KEY" ]]; then
  echo "ERROR: secret key not found at $SECRET_KEY" >&2
  echo "Generate one with:  casper-client keygen ./keys" >&2
  exit 1
fi

echo "==> [1/3] Building Wasm via cargo-odra"
pushd "$(dirname "$0")/../contracts" >/dev/null
cargo odra build -b casper
WASM_PATH="./wasm/AthanorTreasury.wasm"
if [[ ! -f "$WASM_PATH" ]]; then
  # Fallback to the raw target path if odra output layout differs by version
  WASM_PATH="$(find . -name 'AthanorTreasury.wasm' | head -n1)"
fi
echo "    wasm: $WASM_PATH"
popd >/dev/null

echo "==> [2/3] Preparing init args (agents + quorum)"
# Three agent public keys form the founding swarm. Replace with your agent keys;
# defaults reuse the deployer key three times for a single-signer demo install.
PUBLIC_KEY_HEX="$(casper-client account-address --public-key "${SECRET_KEY%secret_key.pem}public_key.pem" 2>/dev/null || true)"

echo "==> [3/3] Installing contract on $CHAIN_NAME via $NODE_ADDRESS"
DEPLOY_OUTPUT="$(casper-client put-deploy \
  --node-address "$NODE_ADDRESS" \
  --chain-name "$CHAIN_NAME" \
  --secret-key "$SECRET_KEY" \
  --payment-amount "$PAYMENT_AMOUNT" \
  --session-path "$(dirname "$0")/../contracts/$WASM_PATH" \
  --session-arg "required_sigs:u8='3'" )"

echo "$DEPLOY_OUTPUT"
DEPLOY_HASH="$(echo "$DEPLOY_OUTPUT" | grep -o '"deploy_hash":"[^"]*"' | head -n1 | cut -d'"' -f4)"

echo ""
echo "=================================================="
echo " Deploy submitted."
echo " Deploy hash: $DEPLOY_HASH"
echo " Track it:   https://testnet.cspr.live/deploy/$DEPLOY_HASH"
echo "=================================================="
echo ""
echo "Once confirmed, copy the contract hash into:"
echo "  apps/enterprise-frontend/.env.local  (NEXT_PUBLIC_TREASURY_HASH)"
echo "  apps/swarm-orchestrator/.env         (ATHANOR_TREASURY_HASH)"
