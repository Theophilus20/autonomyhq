// AutonomyHQ — Casper Testnet deployer (replaces casper-client, which does
// not compile on Windows). Node + casper-js-sdk only.
//
// Usage:
//   node deploy.mjs keygen              -> creates keys/secret_key.pem, prints public key to fund
//   node deploy.mjs deploy <wasm-path>  -> installs the contract on casper-test, prints deploy hash
//   node deploy.mjs status <deploy-hash>-> checks execution result
//   env: NODE_URL (default https://node.testnet.cspr.live/rpc)

import fs from "fs";
import path from "path";
import sdk from "casper-js-sdk";
const {
  PrivateKey, KeyAlgorithm,
  Deploy, DeployHeader, ExecutableDeployItem, ModuleBytes,
  Args, CLValue, CLTypeKey, Key, Duration, Timestamp,
  RpcClient, HttpHandler,
} = sdk;

const NODE_URL = process.env.NODE_URL || "https://node.testnet.cspr.live/rpc";
const CHAIN = "casper-test";
const KEYS_DIR = path.resolve("keys");
const PEM = path.join(KEYS_DIR, "secret_key.pem");
const PAYMENT = process.env.PAYMENT_MOTES || "300000000000"; // 300 CSPR

const cmd = process.argv[2];

async function loadKey() {
  if (!fs.existsSync(PEM)) {
    console.error(`No key at ${PEM} — run:  node deploy.mjs keygen`);
    process.exit(1);
  }
  return PrivateKey.fromPem(fs.readFileSync(PEM, "utf8"), KeyAlgorithm.ED25519);
}

if (cmd === "keygen") {
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  if (fs.existsSync(PEM)) {
    console.log("Key already exists:", PEM);
  } else {
    const pk = await PrivateKey.generate(KeyAlgorithm.ED25519);
    fs.writeFileSync(PEM, pk.toPem());
    console.log("Created:", PEM);
  }
  const pk = await loadKey();
  const pub = pk.publicKey.toHex();
  fs.writeFileSync(path.join(KEYS_DIR, "public_key_hex.txt"), pub);
  console.log("\n==============================================");
  console.log(" PUBLIC KEY:", pub);
  console.log(" ACCOUNT HASH:", pk.publicKey.accountHash().toPrefixedString());
  console.log("==============================================");
  console.log("\nFUND IT: open https://testnet.cspr.live/tools/faucet");
  console.log("paste the PUBLIC KEY above, request tokens, wait ~1 min.");
  console.log("Check balance: https://testnet.cspr.live/account/" + pub);
  process.exit(0);
}

if (cmd === "deploy") {
  const wasmPath = process.argv[3];
  if (!wasmPath || !fs.existsSync(wasmPath)) {
    console.error("Usage: node deploy.mjs deploy <path-to-AthanorTreasury.wasm>");
    process.exit(1);
  }
  const pk = await loadKey();
  const wasm = new Uint8Array(fs.readFileSync(wasmPath));
  console.log(`wasm: ${wasmPath} (${(wasm.length / 1024).toFixed(1)} KB)`);
  console.log(`account: ${pk.publicKey.toHex()}`);

  // Odra install args: odra_cfg_* control the package install; init args follow.
  // agents = [deployer]; required_sigs = 1 (add more agents later via register_agent).
  const deployerKey = Key.newKey(pk.publicKey.accountHash().toPrefixedString());
  const args = Args.fromMap({
    odra_cfg_package_hash_key_name: CLValue.newCLString("autonomyhq_treasury_package_hash"),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(true),
    odra_cfg_is_upgradable: CLValue.newCLValueBool(true),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    agents: CLValue.newCLList(CLTypeKey, [CLValue.newCLKey(deployerKey)]),
    required_sigs: CLValue.newCLUint8(1),
  });

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasm, args);
  const payment = ExecutableDeployItem.standardPayment(PAYMENT);

  const header = DeployHeader.default();
  header.account = pk.publicKey;
  header.chainName = CHAIN;
  header.ttl = new Duration(1800000);
  header.timestamp = new Timestamp(new Date());

  const deploy = Deploy.makeDeploy(header, payment, session);
  deploy.sign(pk);
  const hash = deploy.hash.toHex();
  console.log("deploy hash:", hash);

  if (process.env.DRY_RUN === "1") {
    console.log("(dry run — not sent)");
    process.exit(0);
  }
  const client = new RpcClient(new HttpHandler(NODE_URL));
  const res = await client.putDeploy(deploy);
  console.log("node accepted:", res?.deployHash || hash);
  console.log("\n==============================================");
  console.log(" TRACK IT:");
  console.log(" https://testnet.cspr.live/deploy/" + hash);
  console.log("==============================================");
  console.log("Check status in ~1-2 min:  node deploy.mjs status " + hash);
  process.exit(0);
}

if (cmd === "status") {
  const hash = process.argv[3];
  if (!hash) { console.error("Usage: node deploy.mjs status <deploy-hash>"); process.exit(1); }
  const client = new RpcClient(new HttpHandler(NODE_URL));
  const info = await client.getDeploy(hash);
  const exec = info?.executionResults ?? info?.execution_results ?? info;
  console.log(JSON.stringify(exec, null, 2).slice(0, 2000));
  process.exit(0);
}

console.log("Usage: node deploy.mjs keygen | deploy <wasm> | status <hash>");
