// Athanor ↔ Pixel Agents bridge (v3).
//
// Connects the Athanor swarm orchestrator (WebSocket, port 8080) to a running
// Pixel Agents office server (hook endpoint, port 3100), translating swarm
// events into the office's agent-activity hook events.
//
// HOW PIXEL AGENTS MOVES CHARACTERS (this drives the whole mapping):
//   - PreToolUse (a tool running)  -> character pathfinds to its DESK and sits
//     down working. Tools ALWAYS mean "go sit at your seat".
//   - Stop (turn ended)            -> character STANDS UP and wanders the
//     office (idle wander AI). This is the ONLY hook that gets them off
//     their chairs — there is no "go to room X" command in the hook API.
//
// Therefore:
//   desk time  = looping PreToolUse cycles (sit and work)
//   meeting    = Stop + bubbles (stand up, roam = "convening"), re-Stopped
//                periodically so they keep mingling instead of drifting back
//   signing    = treasury briefly returns to its desk (sign tool), then Stop
//   paused     = Stop everything, no timers, frozen bubbles
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
    if (cfg.authToken) token = cfg.authToken;
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
const activeTool = {};

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

// Close out whatever tool an agent has mid-flight (otherwise the character
// stays in "active/at desk" state and bubbles linger).
async function closeTool(agentId, fallbackName = "work_at_desk") {
  const t = activeTool[agentId];
  await hook({
    hook_event_name: "PostToolUse",
    session_id: SESS[agentId],
    tool_name: t?.toolName || fallbackName,
    tool_id: t?.toolId || `close-${Date.now()}`,
  });
  delete activeTool[agentId];
}

async function toolCycle(agentId, toolName, ms = 100) {
  const sid = SESS[agentId];
  const toolId = `athanor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  activeTool[agentId] = { toolId, toolName };

  await hook({
    hook_event_name: "PreToolUse",
    session_id: sid,
    tool_name: toolName,
    tool_id: toolId
  });

  await new Promise(r => setTimeout(r, ms));
  // No PostToolUse — bubble stays until closeTool()/next cycle.
}

async function say(agentId, text) {
  await hook({
    hook_event_name: "Notification",
    session_id: SESS[agentId],
    message: text,
    notification_type: "info",
  });
}

// Stop = "turn ended" = the character STANDS UP and wanders. This is our
// only movement primitive for getting agents away from their desks.
async function standUp(agentId) {
  await closeTool(agentId);
  await hook({ hook_event_name: "Stop", session_id: SESS[agentId] });
}


const workTimers = {};
let meetingTimer = null;
let inMeeting = false;
let swarmPaused = false;
let lastQuorumMet = false;

function startWork(id) {
  stopWork(id);
  if (swarmPaused) return; // never restart desk work while operator stopped us

  const tick = async () => {
    if (inMeeting || swarmPaused) return;

    let tool = "work_at_desk";
    if (id === "risk-agent-01") tool = "evaluate_market_risk";
    else if (id === "lc-agent-01") tool = "verify_compliance";
    else if (id === "treasury-agent-01") tool = "compute_allocation";

    try { await toolCycle(id, tool, 100); }
    catch {}
  };

  tick();
  workTimers[id] = setInterval(tick, 8000);
}
function stopWork(id) {
  if (!workTimers[id]) return;
  clearInterval(workTimers[id]);
  delete workTimers[id];
}

// During a meeting, characters are idle-wandering. The wander AI returns them
// to their seats after a limited number of moves, so we re-Stop everyone every
// few seconds to keep them up and mingling for the whole meeting.
function startMeetingKeepalive() {
  stopMeetingKeepalive();
  meetingTimer = setInterval(async () => {
    if (!inMeeting || swarmPaused) return;
    for (const id of Object.keys(SESS)) {
      try { await hook({ hook_event_name: "Stop", session_id: SESS[id] }); } catch {}
    }
  }, 6000);
}
function stopMeetingKeepalive() {
  if (meetingTimer) { clearInterval(meetingTimer); meetingTimer = null; }
}

async function handle(evt) {
  switch (evt.type) {
    case "SWARM_PAUSED": {
      swarmPaused = true;
      inMeeting = false;
      stopMeetingKeepalive();

      for (const id of Object.keys(SESS)) {
        stopWork(id);
        try {
          await say(id, "⏸ paused by operator");
          await standUp(id); // freeze in idle; no timers will restart work
        } catch {}
      }
      console.log("[bridge] swarm paused — office frozen");
      break;
    }

    case "SWARM_RESUMED": {
      swarmPaused = false;
      for (const id of Object.keys(SESS)) {
        try { await say(id, "▶ back to work"); } catch {}
        startWork(id);
      }
      console.log("[bridge] swarm resumed — office back to work");
      break;
    }

    case "MEETING_STARTED": {
      if (swarmPaused) break;
      inMeeting = true;

      await Promise.all(Object.keys(SESS).map(async id => {
        await ensureSpawned(id);
        stopWork(id);
        // Stand up and roam: in Pixel Agents, Stop is what gets a character
        // OFF its chair (tools would send it right back to its desk).
        await standUp(id);
        await say(id, evt.reason || "🛋 convening in the living room");
      }));
      startMeetingKeepalive();

      break;
    }

    case "MEETING_ENDED": {
      inMeeting = false;
      stopMeetingKeepalive();

      await Promise.all(
        Object.keys(SESS).map(async id => {
          await say(id, "meeting adjourned — back to my desk");
          startWork(id); // desk tool cycle = pathfind back to seat (no-op if paused)
        })
      );

      // Execution happens AFTER the walk back: treasury sits down at its desk
      // and only then carries out the approved decision on the system.
      if (lastQuorumMet) {
        lastQuorumMet = false;
        setTimeout(async () => {
          if (swarmPaused) return;
          const id = "treasury-agent-01";
          try {
            await say(id, "⛓ executing approved rebalance — signing on Casper");
            await toolCycle(id, "sign_and_broadcast_casper", 2600);
            await closeTool(id, "sign_and_broadcast_casper");
            await say(id, "Broadcast accepted ✓ on Casper Testnet");
          } catch {}
        }, 6000); // give the walk-back animation time to complete
      }

      break;
    }

    case "HELLO": {
      console.log("[bridge] connected to swarm; office ready");
      for (const id of Object.keys(SESS)) {
        await ensureSpawned(id);
        startWork(id);
      }
      break;
    }

    case "PROPOSAL_OPENED": {
      if (swarmPaused) break;
      await Promise.all(
        Object.keys(SESS).map(async id => {
          await ensureSpawned(id);
          await say(id, `Proposal ${evt.action} on the table`);
        })
      );
      break;
    }

    case "AGENT_THINKING": {
      const id = evt.agentId;
      if (!SESS[id] || swarmPaused) break;
      await ensureSpawned(id);
      // Bubble only — NO tool use here, or the character would leave the
      // meeting and walk back to its desk to "work".
      await say(id, "🧠 thinking…");
      break;
    }

    case "AGENT_VOTE": {
      const id = evt.agentId;
      if (!SESS[id]) break;
      await ensureSpawned(id);
      await say(id, `${evt.vote}: ${evt.reasoning || ""}`);
      break;
    }

    case "QUORUM_RESULT": {
      lastQuorumMet = !!evt.quorumMet;
      if (evt.quorumMet) {
        await say("treasury-agent-01",
          `Quorum ${evt.approvals}/${evt.required} — approved, I'll sign at my desk after the meeting`);
      } else {
        await say("treasury-agent-01", `Quorum ${evt.approvals}/${evt.required} — rejected, no execution`);
      }
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
// Belt and braces:
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

console.log("AutonomyHQ bridge starting (v3 — Stop-based meetings)");
console.log(`  swarm:  ${SWARM_WS}`);
console.log(`  office: ${OFFICE_HOOK}`);
connect();
