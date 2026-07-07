// Proof harness for the x402 round-trip.
//
// Boots the gateway in-process, then acts as the agent client:
//   1. GET the resource with no payment -> expect 402 + PAYMENT-REQUIRED
//   2. Sign the payment authorization (ed25519)
//   3. Retry with PAYMENT-SIGNATURE -> expect 200 + data + PAYMENT-RESPONSE
//
// If it prints ALL X402 CHECKS PASSED, the micropayment layer genuinely works.

import nacl from "tweetnacl";
import { buildSignedPayment, headers } from "./x402.js";

const PORT = process.env.GATEWAY_PORT || 4021;
const BASE = `http://127.0.0.1:${PORT}`;
const RESOURCE = `${BASE}/v1/rwa/valuation/property-99021`;

function assert(cond, msg) {
  if (!cond) {
    console.error(`\x1b[91mFAIL:\x1b[0m ${msg}`);
    process.exit(1);
  }
  console.log(`  \x1b[92mok\x1b[0m  ${msg}`);
}

async function main() {
  // Agent identity (ed25519, Casper-style).
  const keypair = nacl.sign.keyPair();

  console.log("=== x402 ROUND-TRIP ===");

  // Step 1: unpaid request
  const r1 = await fetch(RESOURCE);
  assert(r1.status === 402, "unpaid request returns 402 Payment Required");
  const reqHeader = r1.headers.get(headers.PAYMENT_REQUIRED);
  assert(!!reqHeader, "402 carries a PAYMENT-REQUIRED header");
  const requirements = headers.decode(reqHeader);
  const requirement = requirements.accepts[0];
  assert(requirement.scheme === "exact", "scheme is 'exact'");
  assert(requirement.network === "casper:casper-test", "network is Casper testnet (CAIP-2)");
  assert(!!requirement.nonce, "requirement includes a replay nonce");

  // Step 2: sign the payment authorization locally (no network / no gas yet)
  const payment = buildSignedPayment(requirement, keypair);
  assert(!!payment.payload.signature, "client produced an ed25519 payment signature");

  // Step 3: retry with PAYMENT-SIGNATURE
  const r2 = await fetch(RESOURCE, {
    headers: { [headers.PAYMENT_SIGNATURE]: headers.encode(payment) },
  });
  assert(r2.status === 200, "paid request returns 200 OK");
  const respHeader = r2.headers.get(headers.PAYMENT_RESPONSE);
  assert(!!respHeader, "200 carries a PAYMENT-RESPONSE header");
  const settlement = headers.decode(respHeader);
  assert(settlement.success === true, "settlement reported success");
  assert(!!settlement.txHash, "settlement carries a tx hash");

  const data = await r2.json();
  assert(typeof data.valuationUSD === "number", "resource data delivered after payment");

  // Step 4: verify the ledger recorded the payment
  const led = await (await fetch(`${BASE}/x402/ledger`)).json();
  assert(led.ledger.length >= 1, "gateway ledger recorded the settled payment");

  console.log("\n  settled tx:", settlement.txHash);
  console.log("  payer:", settlement.payer.slice(0, 22) + "...");
  console.log("  valuation returned: $" + data.valuationUSD.toLocaleString());
  console.log("\n\x1b[92mALL X402 CHECKS PASSED\x1b[0m");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
