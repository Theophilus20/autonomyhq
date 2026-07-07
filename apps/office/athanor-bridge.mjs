// Athanor ↔ Pixel Agents bridge.
//
// Connects the Athanor swarm orchestrator (WebSocket, port 8080) to a running
// Pixel Agents office server (hook endpoint, port 3100), translating on-chain
// swarm events into the office's agent-activity hook events so the three
// Athanor agents appear as characters in the furnished pixel office and act
// out every deliberation.
//
// Mapping:
//   swarm PROPOSAL_OPENED   -> SessionStart for each agent (spawn if needed)
//                              + Notification "walking to boardroom"
//   swarm AGENT_VOTE        -> PreToolUse(tool=evaluate/verify/sign) then
//                              PostToolUse, + Notification with the reasoning
//   swarm QUORUM_RESULT      -> treasury PreToolUse(sign_on_casper) on approve,
//                              or Notification "rejected" ; then Stop
//   swarm PROPOSAL_FINALIZED -> Notification "signatures verified"
//
// Run:  node athanor-bridge.mjs
//   env: SWARM_WS (default ws://127.0.0.1:8080/ws/stream)
//        OFFICE_HOOK (default http://127.0.0.1:3100/api/hooks/claude)

import WebSocket from "ws";
import fs from "fs";
import os from "os";
import path from "path";

const SWARM_WS = process.env.SWARM_WS || "ws://127.0.0.1:8080/ws/stream";

// Discover the office server + auth token from ~/.pixel-agents/server.json
// (written by the standalone Pixel Agents server on startup).
function discoverOffice() {
  const disc = path.join(os.homedir(), ".pixel-agents", "server.json");
  let port = 3100, token = "";
  try {
    const cfg = JSON.parse(fs.readFileSync(disc, "utf8"));
    if (cfg.port) port = cfg.port;
    if (cfg.token) token = cfg.token;
  } catch (e) {
    console.warn("[bridge] no server.json yet; using defaults (hook auth may fail)");
  }
  return { port, token };
}

let OFFICE = discoverOffice();
const OFFICE_HOOK = process.env.OFFICE_HOOK || `http://127.0.0.1:${OFFICE.port}/api/hooks/claude`;
const AUTH = process.env.OFFICE_TOKEN || OFFICE.token;

// stable session ids -> each becomes one character in the office
const SESS = {
  "risk-agent-01": "athanor-risk",
  "lc-agent-01": "athanor-compliance",
  "treasury-agent-01": "athanor-treasury",
};
const NICE = {
  "risk-agent-01": "Risk",
  "lc-agent-01": "Compliance",
  "treasury-agent-01": "Treasury",
};
const spawned = new Set();

async function hook(event) {
  try {
    const headers = { "Content-Type": "application/json" };
    if (AUTH) headers["Authorization"] = `Bearer ${AUTH}`;
    const r = await fetch(OFFICE_HOOK, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    });
    if (r.status === 401) console.error("[bridge] 401 unauthorized — token mismatch");
  } catch (e) {
    console.error("[bridge] hook post failed:", e.message);
  }
}

async function ensureSpawned(agentId) {
  if (spawned.has(agentId)) return;
  spawned.add(agentId);
  await hook({
    hook_event_name: "SessionStart",
    session_id: SESS[agentId],
    source: "startup",
    cwd: `/athanor/${NICE[agentId].toLowerCase()}`,
  });
  console.log(`[bridge] spawned ${NICE[agentId]} in the office`);
}

async function toolCycle(agentId, toolName, ms = 1400) {
  const sid = SESS[agentId];
  const toolId = `athanor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await hook({ hook_event_name: "PreToolUse", session_id: sid, tool_name: toolName, tool_id: toolId });
  await new Promise((r) => setTimeout(r, ms));
  await hook({ hook_event_name: "PostToolUse", session_id: sid, tool_name: toolName, tool_id: toolId });
}

async function say(agentId, text) {
  await hook({
    hook_event_name: "Notification",
    session_id: SESS[agentId],
    message: text,
    notification_type: "info",
  });
}

async function stop(agentId) {
  await hook({ hook_event_name: "Stop", session_id: SESS[agentId] });
}

// Agents "work at their computers" between meetings: a rolling tool cycle
// keeps each character seated at its desk, typing. Meetings interrupt work:
// everyone stands up (idle/walk) while the swarm deliberates, then returns.
const workTimers = {};
let inMeeting = false;
function startWork(id) {
  stopWork(id);
  const tick = async () => { if (!inMeeting) { try { await toolCycle(id, "work_at_desk", 6000); } catch (e) {} } };
  tick();
  workTimers[id] = setInterval(tick, 8000);
}
function stopWork(id) { if (workTimers[id]) { clearInterval(workTimers[id]); delete workTimers[id]; } }

const TOOL_FOR = {
  risk: "evaluate_market_risk",
  "l&c": "verify_compliance",
  treasury: "compute_allocation",
};

async function handle(evt) {
  switch (evt.type) {
    case "MEETING_STARTED": {
      // meeting: everyone STANDS UP from their computer and gathers
      inMeeting = true;
      for (const id of Object.keys(SESS)) {
        await ensureSpawned(id);
        stopWork(id);
        await stop(id); // stand up -> walk around (gathering)
        await say(id, evt.reason || "Meeting time");
      }
      break;
    }
    case "MEETING_ENDED": {
      // back to work: everyone returns to their computer
      inMeeting = false;
      for (const id of Object.keys(SESS)) startWork(id);
      break;
    }
    case "HELLO":
      console.log("[bridge] connected to swarm; office ready");
      for (const id of Object.keys(SESS)) { await ensureSpawned(id); startWork(id); }
      break;

    case "PROPOSAL_OPENED": {
      for (const id of Object.keys(SESS)) {
        await ensureSpawned(id);
        await say(id, `Proposal ${evt.action} — heading to the boardroom`);
      }
      break;
    }

    case "AGENT_THINKING": {
      // fires the moment the agent's REAL LLM call starts — body syncs to brain
      const tid = evt.agentId;
      if (tid) { await ensureSpawned(tid); await say(tid, "🧠 thinking…"); }
      break;
    }
    case "AGENT_VOTE": {
      const id = evt.agentId;
      if (!SESS[id]) break;
      await ensureSpawned(id);
      // standing vote during the meeting — speech bubble only
      await say(id, `${evt.vote}: ${evt.reasoning || ""}`.slice(0, 140));
      break;
    }

    case "QUORUM_RESULT": {
      if (evt.quorumMet) {
        const t = "treasury-agent-01";
        await say(t, `Quorum ${evt.approvals}/${evt.required} — signing on Casper`);
        await toolCycle(t, "sign_and_broadcast_casper", 2400);
        await say(t, "Broadcast accepted ✓ on Casper Testnet");
      } else {
        await say("treasury-agent-01", `Quorum ${evt.approvals}/${evt.required} — rejected, no execution`);
      }
      // end turn -> characters return to idle/desks
      setTimeout(() => { for (const id of Object.keys(SESS)) stop(id); }, 1500);
      break;
    }

    case "PROPOSAL_FINALIZED": {
      if (evt.verified) await say("treasury-agent-01", "Signatures verified ✓");
      break;
    }
  }
}

// Enable "watch all sessions" on the office so our external (unknown session_id)
// agents are allowed to spawn. Without this the office silently ignores them.
// Make external agents visible — belt and braces:
// 1) Patch ~/.pixel-agents/config.json so the setting survives restarts.
// 2) Send setWatchAllSessions live over the office WS (correct path: /ws).
function enableWatchAll() {
  try {
    const cfgPath = path.join(os.homedir(), ".pixel-agents", "config.json");
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch (e) {}
    cfg.standalone = Object.assign({}, cfg.standalone, { watchAllSessions: true });
    cfg.vscode = Object.assign({}, cfg.vscode);
    if (!Array.isArray(cfg.externalAssetDirectories)) cfg.externalAssetDirectories = [];
    fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
    console.log("[bridge] config.json patched: watchAllSessions=true (persistent)");
  } catch (e) { console.error("[bridge] config patch failed:", e.message); }
  try {
    const ows = new WebSocket(`ws://127.0.0.1:${OFFICE.port}/ws`);
    ows.on("open", () => {
      ows.send(JSON.stringify({ type: "setWatchAllSessions", enabled: true }));
      console.log("[bridge] office /ws: watchAllSessions enabled (live)");
      setTimeout(() => ows.close(), 400);
    });
    ows.on("error", () => {});
  } catch (e) {}
}

function connect() {
  enableWatchAll();
  // re-announce agents after enabling, in case earlier SessionStarts were ignored
  spawned.clear();
  const ws = new WebSocket(SWARM_WS);
  ws.on("open", () => console.log(`[bridge] listening to swarm at ${SWARM_WS}`));
  ws.on("message", (buf) => {
    try { handle(JSON.parse(buf.toString())); } catch (e) {}
  });
  ws.on("close", () => { console.log("[bridge] swarm closed; retrying in 2s"); setTimeout(connect, 2000); });
  ws.on("error", (e) => console.error("[bridge] swarm error:", e.message));
}

console.log("AutonomyHQ bridge starting");
console.log(`  swarm:  ${SWARM_WS}`);
console.log(`  office: ${OFFICE_HOOK}`);
connect();
