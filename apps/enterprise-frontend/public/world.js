// Athanor World — builds the office, runs the render loop, and drives the
// agent state machine from live swarm events.

import { TILE_W, TILE_H, isoToScreen, loadSprite, Agent } from "./engine.js";

const HW = TILE_W / 2, HH = TILE_H / 2;

// ---------- world layout (grid units) ----------
const GRID = 20;
const ROOMS = {
  risk:  { x0: 1,  y0: 1,  x1: 6,  y1: 6,  floor: "#16233c", accent: "#8FB4FF", name: "RISK OFFICE" },
  comp:  { x0: 13, y0: 1,  x1: 18, y1: 6,  floor: "#123320", accent: "#3BE08A", name: "COMPLIANCE OFFICE" },
  treas: { x0: 1,  y0: 13, x1: 6,  y1: 18, floor: "#33240c", accent: "#FF6A1A", name: "TREASURY OFFICE" },
  node:  { x0: 13, y0: 13, x1: 18, y1: 18, floor: "#1a1d26", accent: "#FF8A47", name: "CASPER SIGNING NODE" },
  board: { x0: 7,  y0: 7,  x1: 12, y1: 12, floor: "#241a2e", accent: "#FF8A47", name: "BOARDROOM" },
};

// boardroom seats (grid pos + which side agent faces)
const SEATS = {
  "risk-agent-01":     { gx: 8,  gy: 8 },
  "lc-agent-01":       { gx: 11, gy: 8 },
  "treasury-agent-01": { gx: 9.5, gy: 11 },
};
const SIGN_SPOT = { gx: 15, gy: 15 };
const DOORS = { risk: [6, 6], comp: [13, 6], treas: [6, 13], node: [13, 13] };

function shade(hex, f) {
  let n = parseInt(hex.slice(1), 16);
  let r = Math.min(255, ((n >> 16) & 255) * f) | 0;
  let g = Math.min(255, ((n >> 8) & 255) * f) | 0;
  let b = Math.min(255, (n & 255) * f) | 0;
  return `rgb(${r},${g},${b})`;
}

function inRoom(r, gx, gy) { return gx >= r.x0 && gx <= r.x1 && gy >= r.y0 && gy <= r.y1; }
function roomAt(gx, gy) { for (const k in ROOMS) if (inRoom(ROOMS[k], gx, gy)) return k; return null; }

export class World {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.scale = 2;
    this.originX = canvas.width / 2;
    this.originY = 70;
    this.agents = [];
    this.props = this._buildProps();
    this.last = performance.now();
    this.log = [];
    this.onLog = null;
    this.quorum = { approvals: 0, required: 3 };
  }

  async init() {
    const base = "/sprites/";
    const [risk, comp, treas] = await Promise.all([
      loadSprite(base + "sprite_risk.png", base + "sprite_risk.json"),
      loadSprite(base + "sprite_compliance.png", base + "sprite_compliance.json"),
      loadSprite(base + "sprite_treasury.png", base + "sprite_treasury.json"),
    ]);
    const R = ROOMS;
    this.agents = [
      new Agent("risk-agent-01", risk, (R.risk.x0 + R.risk.x1) / 2, (R.risk.y0 + R.risk.y1) / 2, "#8FB4FF"),
      new Agent("lc-agent-01", comp, (R.comp.x0 + R.comp.x1) / 2, (R.comp.y0 + R.comp.y1) / 2, "#3BE08A"),
      new Agent("treasury-agent-01", treas, (R.treas.x0 + R.treas.x1) / 2, (R.treas.y0 + R.treas.y1) / 2, "#FF6A1A"),
    ];
    this.byId = {};
    this.agents.forEach((a) => (this.byId[a.id] = a));
    requestAnimationFrame(() => this._loop());
  }

  _buildProps() {
    const props = [];
    for (const k in ROOMS) {
      const r = ROOMS[k];
      for (let gx = r.x0; gx <= r.x1; gx++) {
        for (let gy = r.y0; gy <= r.y1; gy++) {
          const edge = gx === r.x0 || gx === r.x1 || gy === r.y0 || gy === r.y1;
          if (edge) {
            const isDoor = DOORS[k] && DOORS[k][0] === gx && DOORS[k][1] === gy;
            if (!isDoor) props.push({ gx, gy, kind: "wall", color: shade(r.floor, 1.7), h: 26 });
          }
        }
      }
    }
    props.push({ gx: 3, gy: 3, kind: "desk", color: "#8FB4FF", h: 12 });
    props.push({ gx: 15, gy: 3, kind: "desk", color: "#3BE08A", h: 12 });
    props.push({ gx: 3, gy: 15, kind: "safe", color: "#FF6A1A", h: 16, glow: "#FFB070" });
    props.push({ gx: 15, gy: 15, kind: "terminal", color: "#FF8A47", h: 20, glow: "#FFCF9F" });
    props.push({ gx: 9, gy: 9, kind: "table", color: "#5A3A1E", h: 9 });
    props.push({ gx: 10, gy: 9, kind: "table", color: "#5A3A1E", h: 9 });
    props.push({ gx: 9, gy: 10, kind: "table", color: "#5A3A1E", h: 9 });
    props.push({ gx: 10, gy: 10, kind: "table", color: "#5A3A1E", h: 9 });
    return props;
  }

  _drawFloor() {
    const ctx = this.ctx;
    for (let s = 0; s <= GRID * 2; s++) {
      for (let gx = 0; gx <= GRID; gx++) {
        const gy = s - gx;
        if (gy < 0 || gy > GRID) continue;
        const rk = roomAt(gx, gy);
        let col = "#0e1015";
        if (rk) col = (gx + gy) % 2 ? ROOMS[rk].floor : shade(ROOMS[rk].floor, 1.15);
        const p = isoToScreen(gx, gy, this.originX, this.originY);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + HW * this.scale, p.y + HH * this.scale);
        ctx.lineTo(p.x, p.y + TILE_H * this.scale);
        ctx.lineTo(p.x - HW * this.scale, p.y + HH * this.scale);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
        if (rk) { ctx.strokeStyle = shade(ROOMS[rk].floor, 1.4); ctx.lineWidth = 1; ctx.stroke(); }
      }
    }
  }

  _drawCube(p, h, color, glow) {
    const ctx = this.ctx, sc = this.scale;
    const hw = HW * sc, hh = HH * sc, th = TILE_H * sc, hpx = h * sc;
    const top = color, left = shade(color, 0.62), right = shade(color, 0.42);
    ctx.beginPath(); ctx.moveTo(p.x, p.y - hpx); ctx.lineTo(p.x + hw, p.y + hh - hpx);
    ctx.lineTo(p.x, p.y + th - hpx); ctx.lineTo(p.x - hw, p.y + hh - hpx); ctx.closePath();
    ctx.fillStyle = top; ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x - hw, p.y + hh - hpx); ctx.lineTo(p.x, p.y + th - hpx);
    ctx.lineTo(p.x, p.y + th); ctx.lineTo(p.x - hw, p.y + hh); ctx.closePath();
    ctx.fillStyle = left; ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x, p.y + th - hpx); ctx.lineTo(p.x + hw, p.y + hh - hpx);
    ctx.lineTo(p.x + hw, p.y + hh); ctx.lineTo(p.x, p.y + th); ctx.closePath();
    ctx.fillStyle = right; ctx.fill();
    if (glow) {
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 300);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - hpx); ctx.lineTo(p.x + hw, p.y + hh - hpx);
      ctx.lineTo(p.x, p.y + th - hpx); ctx.lineTo(p.x - hw, p.y + hh - hpx); ctx.closePath();
      ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  _drawBubble(agent) {
    if (!agent.bubble) return;
    const ctx = this.ctx;
    const p = isoToScreen(agent.gx, agent.gy, this.originX, this.originY);
    const bx = p.x, by = p.y - 44 * this.scale;
    const text = agent.bubble.text;
    ctx.font = "11px 'JetBrains Mono', monospace";
    const w = Math.min(220, ctx.measureText(text).width + 16);
    const lines = this._wrap(text, 30);
    const h = 8 + lines.length * 14;
    ctx.fillStyle = "rgba(12,14,20,0.95)";
    ctx.strokeStyle = agent.color;
    ctx.lineWidth = 1.5;
    this._roundRect(bx - w / 2, by - h, w, h, 6);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.lineTo(bx + 5, by); ctx.lineTo(bx, by + 7); ctx.closePath();
    ctx.fillStyle = "rgba(12,14,20,0.95)"; ctx.fill();
    ctx.fillStyle = "#E6E4DE"; ctx.textAlign = "center";
    lines.forEach((ln, i) => ctx.fillText(ln, bx, by - h + 14 + i * 14));
    ctx.textAlign = "left";
  }

  _roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  _wrap(text, max) {
    const words = text.split(" "); const lines = []; let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; }
      else cur += " " + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.slice(0, 4);
  }

  _loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.fillStyle = "#0A0B0F";
    ctx.fillRect(0, 0, this.cv.width, this.cv.height);

    this._drawFloor();

    this.agents.forEach((a) => a.update(dt));

    // depth-sorted render of props + agents
    const drawables = [];
    for (const pr of this.props) {
      drawables.push({ depth: pr.gx + pr.gy, type: "prop", ref: pr });
    }
    for (const a of this.agents) drawables.push({ depth: a.depth(), type: "agent", ref: a });
    drawables.sort((A, B) => A.depth - B.depth);

    for (const d of drawables) {
      if (d.type === "prop") {
        const p = isoToScreen(d.ref.gx, d.ref.gy, this.originX, this.originY);
        this._drawCube(p, d.ref.h, d.ref.color, d.ref.glow);
      } else {
        d.ref.draw(ctx, this.originX, this.originY, this.scale);
      }
    }
    // bubbles on top
    for (const a of this.agents) this._drawBubble(a);

    // room labels
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (const k in ROOMS) {
      const r = ROOMS[k];
      const p = isoToScreen((r.x0 + r.x1) / 2, r.y0, this.originX, this.originY);
      ctx.fillStyle = r.accent;
      ctx.fillText(r.name, p.x, p.y - 4);
    }
    ctx.textAlign = "left";

    requestAnimationFrame(() => this._loop());
  }

  // ---------- path helper: route agent from its room through door to a seat ----------
  _routeToBoard(agent, seat) {
    const rk = roomAt(Math.round(agent.gx), Math.round(agent.gy));
    const door = DOORS[rk] || [agent.gx, agent.gy];
    agent.pendingState = "sitting";
    agent.moveTo([[door[0], door[1]], [9.5, 9.5], [seat.gx, seat.gy]]);
  }
  _routeHome(agent) {
    const door = DOORS[roomAt(agent.homeGx, agent.homeGy)] || [agent.homeGx, agent.homeGy];
    agent.pendingState = "idle";
    agent.moveTo([[9.5, 9.5], [door[0], door[1]], [agent.homeGx, agent.homeGy]]);
  }

  pushLog(kind, text, color) {
    const entry = { ts: new Date().toLocaleTimeString("en-GB"), kind, text, color };
    this.log.push(entry);
    if (this.log.length > 200) this.log.shift();
    if (this.onLog) this.onLog(entry);
  }

  // ---------- event handler from WebSocket ----------
  handleEvent(e) {
    switch (e.type) {
      case "PROPOSAL_OPENED": {
        this.quorum = { approvals: 0, required: 3 };
        this.pushLog("system", `Proposal ${e.action} opened · ${e.payload?.targetAsset || ""}`, "#B9B7B1");
        for (const a of this.agents) {
          a.vote = null;
          if (SEATS[a.id]) this._routeToBoard(a, SEATS[a.id]);
        }
        break;
      }
      case "AGENT_VOTE": {
        const a = this.byId[e.agentId];
        if (a) {
          a.vote = e.vote;
          a.state = a.path.length ? a.state : "thinking";
          a.say(e.reasoning || e.vote, 5);
          setTimeout(() => { if (a.state === "thinking") a.state = "sitting"; }, 1800);
        }
        if (e.vote === "APPROVE") this.quorum.approvals++;
        this.pushLog(e.role, `${e.agentId} ${e.vote} — ${e.reasoning || ""}`,
          e.role === "risk" ? "#8FB4FF" : e.role === "l&c" ? "#3BE08A" : "#FF6A1A");
        break;
      }
      case "QUORUM_RESULT": {
        this.quorum = { approvals: e.approvals, required: e.required };
        if (e.quorumMet) {
          this.pushLog("ok", `Quorum ${e.approvals}/${e.required} — APPROVED · signing on Casper`, "#3BE08A");
          const t = this.byId["treasury-agent-01"];
          if (t) {
            t.pendingState = "signing";
            t.moveTo([[9.5, 12], [13, 13], [SIGN_SPOT.gx, SIGN_SPOT.gy]]);
            setTimeout(() => t.say("Broadcasting signed tx to Casper Testnet…", 4), 2600);
            setTimeout(() => { this.pushLog("ok", "Casper › deploy accepted ✓", "#3BE08A"); }, 5200);
            setTimeout(() => { for (const a of this.agents) this._routeHome(a); }, 7000);
          }
        } else {
          this.pushLog("warn", `Quorum ${e.approvals}/${e.required} — REJECTED · no execution`, "#FF5C5C");
          setTimeout(() => { for (const a of this.agents) this._routeHome(a); }, 2500);
        }
        break;
      }
      case "PROPOSAL_FINALIZED": {
        if (e.verified) this.pushLog("ok", "Signatures verified ✓", "#3BE08A");
        break;
      }
    }
  }
}
