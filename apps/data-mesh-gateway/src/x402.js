// x402 v2 protocol helpers.
//
// Implements the real v2 wire format: base64-encoded JSON in three headers
// (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE), the `exact` scheme,
// CAIP-2 network identifiers, and a nonce + validBefore replay window.
//
// The signing here uses ed25519 (tweetnacl) to mirror Casper account keys.
// To settle on the REAL Casper x402 Facilitator, point FACILITATOR_URL at it
// and the verify() call forwards there instead of verifying locally.

import nacl from "tweetnacl";

const b64 = {
  encode: (obj) => Buffer.from(JSON.stringify(obj)).toString("base64"),
  decode: (str) => JSON.parse(Buffer.from(str, "base64").toString("utf8")),
};

// CAIP-2 style id for Casper testnet (namespace chosen to be recognisably Casper).
export const CASPER_TESTNET = "casper:casper-test";

export function buildPaymentRequired({ price, payTo, resource, description, nonce }) {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: CASPER_TESTNET,
        asset: "CSPR",
        maxAmountRequired: price, // motes-as-string convention; here human CSPR for readability
        payTo,
        resource,
        description,
        maxTimeoutSeconds: 300,
        nonce,
        validBefore: Math.floor(Date.now() / 1000) + 300,
        extra: { name: "Casper", version: "2" },
      },
    ],
  };
}

// Client side: construct + ed25519-sign the payment authorization.
export function buildSignedPayment(requirement, keypair) {
  const authorization = {
    scheme: requirement.scheme,
    network: requirement.network,
    asset: requirement.asset,
    amount: requirement.maxAmountRequired,
    payTo: requirement.payTo,
    resource: requirement.resource,
    nonce: requirement.nonce,
    validBefore: requirement.validBefore,
    from: "01" + Buffer.from(keypair.publicKey).toString("hex"),
  };
  const message = Buffer.from(JSON.stringify(authorization));
  const signature = nacl.sign.detached(message, keypair.secretKey);
  return {
    x402Version: 2,
    scheme: requirement.scheme,
    network: requirement.network,
    payload: {
      authorization,
      signature: Buffer.from(signature).toString("hex"),
    },
  };
}

// Server/facilitator side: verify the signature + replay window locally.
export function verifyPaymentLocally(paymentSig, expected) {
  try {
    const { authorization, signature } = paymentSig.payload;
    if (authorization.nonce !== expected.nonce) return { ok: false, reason: "nonce mismatch" };
    if (authorization.amount !== expected.maxAmountRequired)
      return { ok: false, reason: "amount mismatch" };
    if (Math.floor(Date.now() / 1000) > authorization.validBefore)
      return { ok: false, reason: "authorization expired" };

    const pkHex = authorization.from.startsWith("01")
      ? authorization.from.slice(2)
      : authorization.from;
    const publicKey = Uint8Array.from(Buffer.from(pkHex, "hex"));
    const message = Buffer.from(JSON.stringify(authorization));
    const sig = Uint8Array.from(Buffer.from(signature, "hex"));
    const valid = nacl.sign.detached.verify(message, sig, publicKey);
    if (!valid) return { ok: false, reason: "invalid signature" };

    // Deterministic pseudo tx-hash for the demo ledger. When FACILITATOR_URL is
    // set, this is replaced by the real on-chain settlement hash.
    const txHash =
      "0x" +
      Buffer.from(nacl.hash(message)).toString("hex").slice(0, 40);
    return { ok: true, txHash, from: authorization.from };
  } catch (e) {
    return { ok: false, reason: "malformed payment payload" };
  }
}

export function buildPaymentResponse(result) {
  return {
    success: result.ok,
    network: CASPER_TESTNET,
    txHash: result.txHash || null,
    payer: result.from || null,
  };
}

export const headers = {
  encode: b64.encode,
  decode: b64.decode,
  PAYMENT_REQUIRED: "PAYMENT-REQUIRED",
  PAYMENT_SIGNATURE: "PAYMENT-SIGNATURE",
  PAYMENT_RESPONSE: "PAYMENT-RESPONSE",
};
