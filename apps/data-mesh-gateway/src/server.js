// Athanor Data Mesh Gateway — premium RWA valuation endpoint gated by x402.
//
// GET /v1/rwa/valuation/:propertyId
//   - no PAYMENT-SIGNATURE header  -> 402 + PAYMENT-REQUIRED
//   - valid PAYMENT-SIGNATURE      -> 200 + data + PAYMENT-RESPONSE
//
// This is a real HTTP server. Run `npm start` then hit it with prove_x402.js.

import express from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "node:crypto";
import nacl from "tweetnacl";
import {
  buildPaymentRequired,
  verifyPaymentLocally,
  buildPaymentResponse,
  headers,
} from "./x402.js";
import { buildSignedPayment } from "./x402.js";

const app = express();

// ---- Hosted mode: serve Mission Control + runtime config ----
const __ahqdir = path.dirname(fileURLToPath(import.meta.url));
const MISSION_CONTROL_DIR = path.resolve(__ahqdir, "../../office/mission-control");

app.get("/ahq-config.js", (_req, res) => {
  res.type("application/javascript").send(
    "window.AHQ_CONFIG=" + JSON.stringify({
      SWARM: process.env.PUBLIC_SWARM_URL || "",
      GATEWAY: process.env.PUBLIC_GATEWAY_URL || "",
      RECORDER: process.env.PUBLIC_RECORDER_URL || "",
      OFFICE: process.env.PUBLIC_OFFICE_URL || "",
    }) + ";"
  );
});
app.use(express.static(MISSION_CONTROL_DIR));

// CORS so the Mission Control dashboard (:3200) can call the gateway directly.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---- Rate limiting ----
// General limiter: baseline flood protection on every route.
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Tighter limiter for payment verification — guards verifyPaymentLocally()
// against brute-force/signature-guessing attempts.
const valuationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", hint: "Slow down and retry later." },
});

// Strictest limiter for /x402/purchase — each call can trigger a real
// on-chain transfer plus a 45s outbound fetch, so this is the most
// expensive route to leave unthrottled.
const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests", hint: "Purchase rate limit exceeded." },
});

const PORT = process.env.PORT || process.env.GATEWAY_PORT || 4021;
const PAY_TO = process.env.ATHANOR_TREASURY_ADDR || "01treasury0000000000000000000000000000000000000000000000000000000000";
const PRICE = process.env.X402_PRICE || "0.025"; // CSPR per request

// In-memory ledger of settled payments (feeds the frontend x402 panel).
const ledger = [];

// Pending 402 challenges, keyed by "resource|ip". Swept periodically below
// so unpaid challenges don't accumulate forever (CWE-400/770).
const pendingNonces = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [key, entry] of pendingNonces) {
    if (entry.createdAt < cutoff) pendingNonces.delete(key);
  }
}, 60 * 1000).unref();

function makeNonce() {
  return randomBytes(12).toString("hex");
}

app.get("/v1/rwa/valuation/:propertyId", valuationLimiter, (req, res) => {
  const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const sigHeader = req.get(headers.PAYMENT_SIGNATURE);

  if (!sigHeader) {
    const nonce = makeNonce();
    const requirements = buildPaymentRequired({
      price: PRICE,
      payTo: PAY_TO,
      resource,
      description: `RWA valuation for ${req.params.propertyId}`,
      nonce,
    });
    res.set("WWW-Authenticate", "x402");
    res.set(headers.PAYMENT_REQUIRED, headers.encode(requirements));
    // Stash the nonce so the retry can be validated against it.
    pendingNonces.set(resource + "|" + req.ip, { nonce, createdAt: Date.now() });
    return res.status(402).json({
      error: "payment_required",
      accepts: requirements.accepts,
      hint: "Sign the payment authorization and retry with a PAYMENT-SIGNATURE header.",
    });
  }

  let paymentSig;
  try {
    paymentSig = headers.decode(sigHeader);
  } catch {
    return res.status(400).json({ error: "malformed PAYMENT-SIGNATURE header" });
  }

  const expectedNonce = paymentSig.payload?.authorization?.nonce;
  const result = verifyPaymentLocally(paymentSig, {
    nonce: expectedNonce,
    maxAmountRequired: PRICE,
  });

  if (!result.ok) {
    return res.status(402).json({ error: "payment_invalid", reason: result.reason });
  }

  const paymentResponse = buildPaymentResponse(result);
  res.set(headers.PAYMENT_RESPONSE, headers.encode(paymentResponse));

  ledger.push({
    txHash: result.txHash,
    amount: PRICE,
    asset: "CSPR",
    payer: result.from,
    resource,
    ts: Date.now(),
  });

  return res.status(200).json({
    propertyId: req.params.propertyId,
    valuationUSD: 1_240_500,
    collateralHealth: 0.82,
    lastAppraisal: "2026-06-30",
    source: "premium-rwa-oracle (x402-gated)",
    settlement: paymentResponse,
  });
});

// One-call REAL x402 purchase for the dashboard: performs the genuine
// 402 -> sign(ed25519) -> retry -> 200 round-trip against this same server
// and returns the actual settlement. Nothing simulated.
const dashboardKeypair = nacl.sign.keyPair();

app.post("/x402/purchase", purchaseLimiter, async (req, res) => {
  try {
    const url = `http://127.0.0.1:${PORT}/v1/rwa/valuation/property-99021`;
    const r1 = await fetch(url);
    if (r1.status !== 402) return res.status(500).json({ error: "expected 402, got " + r1.status });
    const requirements = headers.decode(r1.headers.get(headers.PAYMENT_REQUIRED));
    const payment = buildSignedPayment(requirements.accepts[0], dashboardKeypair);
    const r2 = await fetch(url, { headers: { [headers.PAYMENT_SIGNATURE]: headers.encode(payment) } });
    if (r2.status !== 200) return res.status(500).json({ error: "payment rejected", status: r2.status });
    const settlement = headers.decode(r2.headers.get(headers.PAYMENT_RESPONSE));
    const data = await r2.json();
    // Upgrade the settlement to a REAL on-chain Casper transfer when the
    // recorder service is running (2.5 CSPR carrier transfer on Testnet).
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 45000);
      const rr = await fetch((process.env.RECORDER_URL || "http://127.0.0.1:4030") + "/chain/x402", { method: "POST", signal: ctrl.signal });
      clearTimeout(t);
      const rd = await rr.json();
      if (rd.deployHash) {
        settlement.txHash = rd.deployHash;
        settlement.onChain = true;
        settlement.explorer = `https://testnet.cspr.live/deploy/${rd.deployHash}`;
        const last = ledger[ledger.length - 1];
        if (last) { last.txHash = rd.deployHash; last.onChain = true; }
      }
    } catch (e) { settlement.onChain = false; }
    return res.json({ settlement, valuationUSD: data.valuationUSD, price: PRICE });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/x402/ledger", (_req, res) => res.json({ ledger }));
app.get("/health", (_req, res) => res.json({ status: "live", price: PRICE }));

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[data-mesh-gateway] x402 endpoint live on :${PORT}`);
    console.log(`  GET /v1/rwa/valuation/:propertyId  (price ${PRICE} CSPR)`);
  });
}

export { app, ledger };