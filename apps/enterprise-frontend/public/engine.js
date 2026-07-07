// Athanor Isometric Engine — core module.
// Pure vanilla, no deps. Handles iso projection, sprite atlas playback,
// entities with tween movement + walk animation, depth sorting, and the
// office world. Driven by swarm WebSocket events from the orchestrator.

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2, HH = TILE_H / 2;

// grid <-> screen projection (Bellanger/Pikuma formula)
export function isoToScreen(gx, gy, originX, originY) {
  return {
    x: originX + (gx - gy) * HW,
    y: originY + (gx + gy) * HH,
  };
}

// ---- sprite atlas ----
export class Sprite {
  constructor(image, atlas) {
    this.image = image;
    this.atlas = atlas;
    this.cell = atlas.cell;
  }
  // draw a given animation frame centered at screen x,y (feet anchor)
  draw(ctx, anim, frame, sx, sy, scale, flip) {
    const a = this.atlas.anims[anim];
    if (!a) return;
    const col = a.col != null ? a.col : (frame % a.frames);
    const row = a.row;
    const s = this.cell;
    const dw = s * scale, dh = s * scale;
    ctx.save();
    // anchor: feet at (sx, sy), sprite is 32 tall, feet ~row 29
    const drawX = Math.round(sx - dw / 2);
    const drawY = Math.round(sy - dh + 3 * scale);
    if (flip) {
      ctx.translate(drawX + dw, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, col * s, row * s, s, s, 0, 0, dw, dh);
    } else {
      ctx.drawImage(this.image, col * s, row * s, s, s, drawX, drawY, dw, dh);
    }
    ctx.restore();
  }
}

export function loadSprite(pngUrl, jsonUrl) {
  return Promise.all([
    new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = pngUrl;
    }),
    fetch(jsonUrl).then((r) => r.json()),
  ]).then(([img, atlas]) => new Sprite(img, atlas));
}

// ---- entity: an agent with position, path, animation state ----
export class Agent {
  constructor(id, sprite, gx, gy, color) {
    this.id = id;
    this.sprite = sprite;
    this.gx = gx; this.gy = gy;        // current (float) grid pos
    this.color = color;
    this.path = [];                    // queued grid waypoints
    this.speed = 3.2;                  // tiles/sec
    this.anim = "idle";
    this.frame = 0;
    this.frameTime = 0;
    this.facing = "down";
    this.flip = false;
    this.state = "idle";               // idle|walking|sitting|thinking|signing
    this.bubble = null;                // {text, ttl}
    this.homeGx = gx; this.homeGy = gy;
    this.vote = null;                  // APPROVE|REJECT|null
  }

  moveTo(waypoints) {
    this.path = waypoints.slice();
    this.state = "walking";
  }

  say(text, ttl = 4.5) {
    this.bubble = { text, ttl };
  }

  update(dt) {
    // advance bubble
    if (this.bubble) {
      this.bubble.ttl -= dt;
      if (this.bubble.ttl <= 0) this.bubble = null;
    }

    // movement along path
    if (this.path.length) {
      const [tx, ty] = this.path[0];
      const dx = tx - this.gx, dy = ty - this.gy;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt;
      if (dist <= step) {
        this.gx = tx; this.gy = ty;
        this.path.shift();
        if (!this.path.length) {
          this.state = this.pendingState || "idle";
          this.pendingState = null;
        }
      } else {
        this.gx += (dx / dist) * step;
        this.gy += (dy / dist) * step;
        // facing from dominant axis
        if (Math.abs(dx) > Math.abs(dy)) {
          this.facing = "side";
          this.flip = dx < 0;
        } else {
          this.facing = dy > 0 ? "down" : "up";
          this.flip = false;
        }
      }
    }

    // choose animation
    let anim = "idle";
    if (this.state === "walking") {
      anim = this.facing === "up" ? "walk_up"
           : this.facing === "side" ? "walk_side" : "walk_down";
    } else if (this.state === "sitting") anim = "sit";
    else if (this.state === "thinking") anim = "think";
    else anim = "idle";
    if (anim !== this.anim) { this.anim = anim; this.frame = 0; this.frameTime = 0; }

    // advance frame
    const a = this.sprite.atlas.anims[this.anim];
    if (a && a.frames > 1) {
      this.frameTime += dt;
      const spf = 1 / (a.fps || 6);
      while (this.frameTime >= spf) { this.frameTime -= spf; this.frame = (this.frame + 1) % a.frames; }
    }
  }

  draw(ctx, originX, originY, scale) {
    const p = isoToScreen(this.gx, this.gy, originX, originY);
    this.sprite.draw(ctx, this.anim, this.frame, p.x, p.y + TILE_H, scale, this.flip);
  }

  depth() { return this.gx + this.gy; }
}
