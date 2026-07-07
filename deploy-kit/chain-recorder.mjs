// AutonomyHQ — on-chain recorder (:4030)
// Turns approved swarm proposals into REAL Casper Testnet transactions by
// calling execute_rebalance on the deployed AutonomyHQ treasury contract.
// POST /chain/record {proposalId, approvals}  -> {deployHash, link}
// GET  /chain/recorded                        -> map of proposalId -> deployHash
import http from "http";
import fs from "fs";
import path from "path";
import sdk from "casper-js-sdk";
const {
  PrivateKey, KeyAlgorithm, Deploy, DeployHeader, ExecutableDeployItem,
  StoredVersionedContractByName, Args, CLValue, Key, Duration, Timestamp,
  RpcClient, HttpHandler,
} = sdk;

const NODE_URL = process.env.NODE_URL || "https://node.testnet.casper.network/rpc";
const CHAIN = "casper-test";
const PEM = path.resolve("keys", "secret_key.pem");
const PAYMENT = process.env.RECORD_PAYMENT_MOTES || "20000000000"; // 20 CSPR per call (headroom against out-of-gas)
const PORT = process.env.RECORDER_PORT || 4030;
const CONTRACT_KEY_NAME = "autonomyhq_treasury_package_hash";
const MIN_INTERVAL_MS = 60_000; // safety: at most one auto-record per minute

const RECORDED_FILE = path.resolve("recorded.json");
let recorded = {}; // proposalId -> deployHash (persisted)
try { recorded = JSON.parse(fs.readFileSync(RECORDED_FILE, "utf8")); } catch (e) {}
function saveRecorded() {
  try { fs.writeFileSync(RECORDED_FILE, JSON.stringify(recorded, null, 1)); } catch (e) {}
}
const queue = [];     // pending {proposalId, approvals} — agents queue, recorder drains
let lastSent = 0, inFlight = false;

function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" });
  res.end(JSON.stringify(obj));
}

async function record(proposalId, approvals) {
  const pk = await PrivateKey.fromPem(fs.readFileSync(PEM, "utf8"), KeyAlgorithm.ED25519);
  const self = Key.newKey(pk.publicKey.accountHash().toPrefixedString());
  const args = Args.fromMap({
    proposal_id: CLValue.newCLString(String(proposalId)),
    token: CLValue.newCLKey(self),        // demo asset key
    destination: CLValue.newCLKey(self),  // demo destination
    amount: CLValue.newCLUInt256("0"),    // signaling call — moves no funds
    approvals: CLValue.newCLUint8(Math.min(255, approvals || 3)),
  });
  const session = new ExecutableDeployItem();
  session.storedVersionedContractByName = new StoredVersionedContractByName(
    CONTRACT_KEY_NAME, "execute_rebalance", args, null
  );
  const payment = ExecutableDeployItem.standardPayment(PAYMENT);
  const header = DeployHeader.default();
  header.account = pk.publicKey;
  header.chainName = CHAIN;
  header.ttl = new Duration(1800000);
  header.timestamp = new Timestamp(new Date(Date.now() - 45_000)); // tolerate PC clock skew
  const deploy = Deploy.makeDeploy(header, payment, session);
  deploy.sign(pk);
  const client = new RpcClient(new HttpHandler(NODE_URL));
  await putWithRetry(client, deploy);
  return deploy.hash.toHex();
}

async function putWithRetry(client, deploy, tries = 2) {
  for (let i = 1; ; i++) {
    try { return await client.putDeploy(deploy); }
    catch (e) {
      const msg = e?.sourceErr?.data || e?.sourceErr?.message || e.message;
      console.error(`[recorder] put attempt ${i} failed: ${msg}`);
      if (i >= tries) throw new Error(msg);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "POST" && req.url.startsWith("/chain/x402")) {
    (async () => {
      try {
        const hash = await x402Transfer();
        console.log(`[recorder] x402 settlement -> https://testnet.cspr.live/deploy/${hash}`);
        json(res, 200, { deployHash: hash });
      } catch (e) { json(res, 500, { error: e.message }); }
    })();
    return;
  }
  if (req.method === "GET" && req.url.startsWith("/chain/recorded")) return json(res, 200, { recorded });
  if (req.method === "POST" && req.url.startsWith("/chain/record")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const { proposalId, approvals, force } = JSON.parse(body || "{}");
        if (!proposalId) return json(res, 400, { error: "proposalId required" });
        if (recorded[proposalId]) return json(res, 200, { deployHash: recorded[proposalId], cached: true });
        if (inFlight || (!force && Date.now() - lastSent < MIN_INTERVAL_MS)) {
          // agents stay in control: queue it, the drain loop will send it
          if (!queue.find((q) => q.proposalId === proposalId)) queue.push({ proposalId, approvals });
          return json(res, 202, { queued: true, position: queue.length });
        }
        inFlight = true;
        const hash = await record(proposalId, approvals);
        recorded[proposalId] = hash;
        saveRecorded();
        lastSent = Date.now();
        console.log(`[recorder] proposal ${String(proposalId).slice(0, 8)}… -> https://testnet.cspr.live/deploy/${hash}`);
        json(res, 200, { deployHash: hash, link: `https://testnet.cspr.live/deploy/${hash}` });
      } catch (e) {
        console.error("[recorder]", e.message);
        json(res, 500, { error: e.message });
      } finally { inFlight = false; }
    });
    return;
  }
  json(res, 404, { error: "not found" });
// REAL x402 settlement: a genuine CSPR transfer on Testnet per purchase.
// (Casper's minimum native transfer is 2.5 CSPR — the settlement carrier.)
async function x402Transfer() {
  const pk = await PrivateKey.fromPem(fs.readFileSync(PEM, "utf8"), KeyAlgorithm.ED25519);
  const pub = pk.publicKey.toHex();
  const deploy = sdk.makeCsprTransferDeploy({
    senderPublicKeyHex: pub,
    recipientPublicKeyHex: pub,
    transferAmount: "2500000000",
    chainName: CHAIN,
    memo: String(Date.now() % 1000000),
    timestamp: new Date(Date.now() - 45_000).toISOString(), // clock-skew tolerance
  });
  deploy.sign(pk);
  const client = new RpcClient(new HttpHandler(NODE_URL));
  await putWithRetry(client, deploy);
  return deploy.hash.toHex();
}

// drain the proposal queue autonomously
setInterval(async () => {
  if (inFlight || !queue.length || Date.now() - lastSent < MIN_INTERVAL_MS) return;
  const { proposalId, approvals } = queue.shift();
  if (recorded[proposalId]) return;
  try {
    inFlight = true;
    const hash = await record(proposalId, approvals);
    recorded[proposalId] = hash;
    saveRecorded();
    lastSent = Date.now();
    console.log(`[recorder/auto] proposal ${String(proposalId).slice(0, 8)}… -> https://testnet.cspr.live/deploy/${hash}`);
  } catch (e) {
    console.error("[recorder/auto]", e.message);
    queue.push({ proposalId, approvals }); // retry later
  } finally { inFlight = false; }
}, 10_000);

}).listen(PORT, () => console.log(`[recorder] on :${PORT} -> contract '${CONTRACT_KEY_NAME}' via ${NODE_URL}`));
