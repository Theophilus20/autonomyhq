"""
Athanor Swarm Orchestrator — FastAPI + WebSocket server.

Exposes:
  GET  /health                 -> liveness
  POST /swarm/deliberate       -> run a deliberation, return the SwarmProposalEvent
  WS   /ws/stream              -> live stream of swarm events (debate terminal feed)

The WebSocket is what powers the frontend's "Swarm Debate Terminal": every
AGENT_VOTE / QUORUM_RESULT event is pushed as it happens so the UI renders the
agents deliberating in real time.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.swarm_agents import build_default_swarm
from agents.consensus import ConsensusEngine

# ---- shared demo context (would be fed by live market/compliance feeds) ----
DEFAULT_CONTEXT = {
    "target_asset": "GOLD-RWA",
    "allocation_weight_delta": 0.10,
    "volatility": 0.22,
    "orderbook_depth": 120_000,
    "compliance_whitelist": ["GOLD-RWA", "REALESTATE-RWA"],
    "kyc_verified": True,
    "treasury_headroom": 0.40,
    "execution_path": ["risk", "l&c", "treasury", "casper-testnet"],
}


class Hub:
    """Fan-out hub broadcasting swarm events to all connected WebSocket clients."""

    def __init__(self):
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self.clients.discard(ws)

    async def broadcast(self, event: dict):
        try:
            # Control signals are transient, never part of history/replay.
            if event.get("type") not in ("SWARM_PAUSED", "SWARM_RESUMED", "HELLO",
                                          "MEETING_STARTED", "MEETING_ENDED"):
                HISTORY["stream"].insert(0, event)
                del HISTORY["stream"][300:]
                _save_counter["n"] += 1
                if _save_counter["n"] % 10 == 0:
                    _persist_history()
        except Exception:
            pass
        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(json.dumps(event))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


hub = Hub()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kick off a heartbeat deliberation loop so the terminal always has life.
    task = asyncio.create_task(_auto_loop())
    yield
    task.cancel()


app = FastAPI(title="Athanor Swarm Orchestrator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeliberateRequest(BaseModel):
    action: str = "REBALANCE"
    context: dict | None = None


def _run_swarm(action: str, context: dict, loop=None):
    context = dict(context or {})
    context.setdefault("action", action)
    # aliases so the LLM fallback rules see consistent keys
    context.setdefault("volatilitySigma", context.get("volatility", 0.22))
    context.setdefault("poolDepthUSD", context.get("orderbook_depth", 120000))
    context.setdefault("positionDelta", context.get("allocation_weight_delta", 0.10))
    context.setdefault("targetAsset", context.get("target_asset", "GOLD-RWA"))
    context.setdefault("headroom", context.get("treasury_headroom", 0.40))
    engine = ConsensusEngine(build_default_swarm(), required_signatures=3)
    events: list[dict] = []

    def on_event(evt):
        events.append(evt)
        if loop:
            asyncio.run_coroutine_threadsafe(hub.broadcast(evt), loop)

    result = engine.run(action, context, on_event=on_event)
    result["verified"] = ConsensusEngine.verify_event(result)
    # Broadcast the finalized, signed proposal on EVERY run path (WS trigger,
    # auto loop, and POST) so dashboards always receive the real signatures.
    if loop:
        finalized = {"type": "PROPOSAL_FINALIZED", **result}
        asyncio.run_coroutine_threadsafe(hub.broadcast(finalized), loop)
    return result, events


@app.get("/health")
async def health():
    return {"status": "live", "connected_clients": len(hub.clients)}


@app.post("/swarm/stop")
async def swarm_stop():
    RUNNING["autonomous"] = False
    _save_running(False)
    await hub.broadcast({"type": "SWARM_PAUSED"})
    return {"running": False}


@app.post("/swarm/start")
async def swarm_start():
    RUNNING["autonomous"] = True
    _save_running(True)
    await hub.broadcast({"type": "SWARM_RESUMED"})
    return {"running": True}


@app.get("/swarm/history")
async def swarm_history():
    return HISTORY


@app.post("/swarm/feedback/save")
async def feedback_save():
    import json as _json
    saved = []
    try:
        with open(SAVED_FEEDBACK_FILE) as f:
            saved = _json.load(f)
    except Exception:
        pass
    existing = {(s.get("ts"), s.get("role")) for s in saved}
    for fb in HISTORY["feedback"]:
        if (fb.get("ts"), fb.get("role")) not in existing:
            saved.append(fb)
    with open(SAVED_FEEDBACK_FILE, "w") as f:
        _json.dump(saved, f, indent=1)
    return {"saved": len(saved)}


@app.get("/swarm/feedback/saved")
async def feedback_saved():
    import json as _json
    try:
        with open(SAVED_FEEDBACK_FILE) as f:
            return {"saved": _json.load(f)}
    except Exception:
        return {"saved": []}


@app.post("/swarm/feedback/clear")
async def feedback_clear():
    HISTORY["feedback"].clear()
    return {"cleared": True}


@app.get("/swarm/state")
async def swarm_state():
    return {"running": RUNNING["autonomous"]}


@app.post("/swarm/deliberate")
async def deliberate(req: DeliberateRequest):
    context = req.context or DEFAULT_CONTEXT
    return await _meeting(req.action, context, "manual trigger — deliberate now")


@app.websocket("/ws/stream")
async def ws_stream(ws: WebSocket):
    await hub.connect(ws)
    await ws.send_text(json.dumps({"type": "HELLO", "ts": time.time()}))
    try:
        while True:
            # Client may send a trigger to run a fresh deliberation on demand.
            msg = await ws.receive_text()
            try:
                payload = json.loads(msg)
            except json.JSONDecodeError:
                payload = {"action": "REBALANCE"}
            await _meeting(payload.get("action", "REBALANCE"), DEFAULT_CONTEXT,
                           "manual trigger — new proposal")
    except WebSocketDisconnect:
        hub.disconnect(ws)


def _load_running():
    try:
        with open("autonomy_state.json") as f:
            return bool(json.load(f).get("autonomous", True))
    except Exception:
        return True


def _save_running(v: bool):
    try:
        with open("autonomy_state.json", "w") as f:
            json.dump({"autonomous": v}, f)
    except Exception:
        pass


RUNNING = {"autonomous": _load_running()}
HISTORY_FILE = "history.json"


def _load_history() -> dict:
    try:
        with open(HISTORY_FILE) as f:
            d = json.load(f)
        return {"proposals": d.get("proposals", []),
                "feedback": d.get("feedback", []),
                "stream": d.get("stream", [])}
    except Exception:
        return {"proposals": [], "feedback": [], "stream": []}


HISTORY = _load_history()
SAVED_FEEDBACK_FILE = "saved_feedback.json"
_save_counter = {"n": 0}


def _persist_history():
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(HISTORY, f)
    except Exception:
        pass


def _remember(kind: str, item: dict, cap: int = 200):
    HISTORY[kind].insert(0, item)
    del HISTORY[kind][cap:]
    _persist_history()

def _buy_market_data() -> dict | None:
    """The swarm autonomously purchases premium RWA data over x402 before
    deliberating — a real 402 -> signed-payment -> 200 round-trip."""
    import urllib.request
    try:
        gw = os.environ.get("GATEWAY_URL", "http://127.0.0.1:4021")
        req = urllib.request.Request(gw + "/x402/purchase", method="POST")
        with urllib.request.urlopen(req, timeout=50) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None


async def _meeting(action: str, context: dict, reason: str):
    """A full 'sit-down': buy data (x402) -> convene -> deliberate -> feedback."""
    loop = asyncio.get_running_loop()
    await hub.broadcast({"type": "MEETING_STARTED", "reason": reason, "action": action})
    from agents.reasoning import decide_purchase
    decision = await asyncio.to_thread(decide_purchase, context)
    await hub.broadcast({"type": "DATA_DECISION", "buy": decision["buy"],
                         "reason": decision["reason"], "llm": decision.get("llm", False)})
    purchase = await asyncio.to_thread(_buy_market_data) if decision["buy"] else None
    if purchase and purchase.get("settlement"):
        context = dict(context)
        context["purchased_rwa_valuation_usd"] = purchase.get("valuationUSD")
        await hub.broadcast({
            "type": "DATA_PURCHASED",
            "txHash": purchase["settlement"].get("txHash"),
            "onChain": purchase["settlement"].get("onChain", False),
            "valuationUSD": purchase.get("valuationUSD"),
            "price": purchase.get("price"),
        })
    result, events = await asyncio.to_thread(_run_swarm, action, context, loop)
    _remember("proposals", {"type": "PROPOSAL_FINALIZED", **result})
    try:
        from agents.reasoning import feedback as agent_feedback
        reasonings = {e.get("role"): e.get("reasoning", "") for e in events
                      if e.get("type") == "AGENT_VOTE"}
        async def _one(role):
            vote = next((s.get("vote", "APPROVE") for s in result.get("signatures", [])
                         if s.get("role") == role), "APPROVE")
            text = await asyncio.to_thread(agent_feedback, role, action, vote,
                                           reasonings.get(role, ""))
            fb = {"role": role, "text": text, "ts": time.time(),
                  "proposalId": result.get("proposalId"), "vote": vote}
            _remember("feedback", fb)
            await hub.broadcast({"type": "AGENT_FEEDBACK", **fb})
        # run the three retrospectives concurrently instead of one by one
        await asyncio.gather(*[_one(r) for r in ("risk", "l&c", "treasury")])
    except Exception:
        pass
    await hub.broadcast({"type": "MEETING_ENDED", "action": action})
    return result


async def _auto_loop():
    """The agents decide when to sit down together: a jittered cadence with
    drifting market context, pausable via /swarm/stop."""
    import random
    await asyncio.sleep(5)
    lo = int(os.environ.get("AUTONOMY_MIN_SECONDS", "45"))
    hi = int(os.environ.get("AUTONOMY_MAX_SECONDS", "90"))
    while True:
        try:
            if RUNNING["autonomous"]:
                ctx = dict(DEFAULT_CONTEXT)
                ctx["volatility"] = round(min(0.42, max(0.05, random.gauss(0.20, 0.05))), 2)
                ctx["orderbook_depth"] = int(max(20_000, random.gauss(120_000, 40_000)))
                ctx["allocation_weight_delta"] = round(random.uniform(0.05, 0.22), 2)
                reason = (f"volatility drifted to {ctx['volatility']} — "
                          "agents convened in the living room")
                await _meeting("REBALANCE", ctx, reason)
        except Exception:
            pass
        await asyncio.sleep(random.randint(lo, hi))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
