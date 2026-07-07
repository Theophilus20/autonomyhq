"""
Hand-authored pixel robot sprite sheets for the Athanor agents.

Each agent is a 32x32 pixel robot with a distinct silhouette + palette:
  - RISK      (blue)   antenna + visor, watchful
  - COMPLIANCE(green)  badge screen on chest, boxy
  - TREASURY  (amber)  bulkier, glowing core, crown fin

We draw with a tiny pixel-plot DSL so the art is real per-pixel work, not
geometric primitives. Frames per agent:
  row 0: idle   (2 frames) - facing down (front)
  row 1: walk-down (4 frames)
  row 2: walk-up   (4 frames)
  row 3: walk-side (4 frames)  [flip for left/right]
  row 4: sit    (1 frame, front)  + think (1 frame, glowing eyes)

Output: one PNG spritesheet per agent + a JSON atlas describing frame rects.
Cell = 32x32. Sheet = 4 cols x 5 rows = 128x160 per agent.
"""
import json
from PIL import Image

CELL = 32
COLS = 4
ROWS = 5

# ---- palettes (base, light, dark, glow, eye, outline) ----
PAL = {
    "risk": {
        "base": (30, 42, 68), "lite": (58, 90, 143), "dark": (16, 24, 42),
        "glow": (143, 180, 255), "eye": (143, 180, 255), "out": (8, 12, 24),
        "metal": (44, 60, 92),
    },
    "compliance": {
        "base": (18, 51, 31), "lite": (39, 120, 78), "dark": (9, 28, 17),
        "glow": (59, 224, 138), "eye": (59, 224, 138), "out": (5, 16, 10),
        "metal": (28, 74, 48),
    },
    "treasury": {
        "base": (58, 36, 8), "lite": (191, 117, 23), "dark": (34, 20, 4),
        "glow": (255, 176, 80), "eye": (255, 106, 26), "out": (22, 13, 2),
        "metal": (92, 60, 24),
    },
}


class Canvas:
    def __init__(self, w, h):
        self.img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        self.px = self.img.load()
        self.w, self.h = w, h

    def plot(self, x, y, c, ox=0, oy=0):
        x += ox; y += oy
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.px[x, y] = c if len(c) == 4 else (c[0], c[1], c[2], 255)

    def rect(self, x0, y0, x1, y1, c, ox=0, oy=0):
        for yy in range(y0, y1 + 1):
            for xx in range(x0, x1 + 1):
                self.plot(xx, yy, c, ox, oy)

    def outline_rect(self, x0, y0, x1, y1, c, ox=0, oy=0):
        for xx in range(x0, x1 + 1):
            self.plot(xx, y0, c, ox, oy); self.plot(xx, y1, c, ox, oy)
        for yy in range(y0, y1 + 1):
            self.plot(x0, yy, c, ox, oy); self.plot(x1, yy, c, ox, oy)


def draw_robot(cv, p, ox, oy, pose="idle", frame=0, facing="down"):
    """Draw one 32x32 robot frame at cell offset (ox,oy)."""
    base, lite, dark = p["base"], p["lite"], p["dark"]
    glow, eye, out, metal = p["glow"], p["eye"], p["out"], p["metal"]

    # vertical bob for walk/idle
    bob = 0
    if pose == "idle":
        bob = -1 if frame % 2 else 0
    elif pose == "walk":
        bob = [-1, 0, -1, 0][frame % 4]
    legswing = 0
    if pose == "walk":
        legswing = [2, 0, -2, 0][frame % 4]

    yb = oy + bob

    # ---- shadow ellipse on ground ----
    for dx in range(-6, 7):
        for dy in range(-2, 3):
            if (dx*dx)/36 + (dy*dy)/4 <= 1:
                cv.plot(ox + 16 + dx, oy + 29 + dy, (0, 0, 0, 90))

    if pose == "sit":
        yb = oy + 2  # lower body when seated

    # ---- legs (skip if sitting) ----
    if pose != "sit":
        # left leg
        cv.rect(12, 24, 14, 28, dark, ox, yb + (legswing if facing!="up" else -legswing))
        cv.rect(12, 24, 13, 28, metal, ox, yb + (legswing if facing!="up" else -legswing))
        # right leg
        cv.rect(18, 24, 20, 28, dark, ox, yb + (-legswing if facing!="up" else legswing))
        cv.rect(18, 24, 19, 28, metal, ox, yb + (-legswing if facing!="up" else legswing))
        # feet
        cv.rect(11, 28, 15, 29, out, ox, yb)
        cv.rect(17, 28, 21, 29, out, ox, yb)
    else:
        # seated: small base
        cv.rect(12, 27, 20, 29, dark, ox, oy)

    # ---- torso (rounded box) ----
    cv.rect(10, 16, 22, 25, base, ox, yb)
    cv.rect(10, 16, 16, 25, lite, ox, yb)          # left-lit
    cv.rect(20, 16, 22, 25, dark, ox, yb)          # right-shadow
    cv.outline_rect(10, 16, 22, 25, out, ox, yb)
    # chest detail per agent
    cv.rect(14, 19, 18, 22, dark, ox, yb)
    cv.rect(15, 20, 17, 21, glow, ox, yb)

    # ---- arms ----
    armb = [0, -1, 0, 1][frame % 4] if pose == "walk" else 0
    cv.rect(7, 17, 9, 23, metal, ox, yb + armb); cv.outline_rect(7, 17, 9, 23, out, ox, yb + armb)
    cv.rect(23, 17, 25, 23, metal, ox, yb - armb); cv.outline_rect(23, 17, 25, 23, out, ox, yb - armb)

    # ---- head ----
    hy = 5
    cv.rect(9, hy, 23, hy + 11, base, ox, yb)
    cv.rect(9, hy, 15, hy + 11, lite, ox, yb)
    cv.rect(21, hy, 23, hy + 11, dark, ox, yb)
    cv.outline_rect(9, hy, 23, hy + 11, out, ox, yb)
    # visor
    cv.rect(11, hy + 3, 21, hy + 8, (10, 14, 20), ox, yb)
    cv.outline_rect(11, hy + 3, 21, hy + 8, out, ox, yb)

    # eyes (facing-dependent)
    ecol = eye
    if pose == "think":
        ecol = (255, 255, 255)
    if facing == "up":
        pass  # back of head, no eyes
    elif facing == "side":
        cv.rect(17, hy + 5, 19, hy + 7, ecol, ox, yb)
    else:  # down/front
        cv.rect(13, hy + 5, 15, hy + 7, ecol, ox, yb)
        cv.rect(18, hy + 5, 20, hy + 7, ecol, ox, yb)

    # ---- antenna / crest per agent ----
    key = p["_key"]
    if key == "risk":
        cv.rect(15, hy - 3, 16, hy - 1, metal, ox, yb)
        cv.plot(15, hy - 4, glow, ox, yb); cv.plot(16, hy - 4, glow, ox, yb)
    elif key == "compliance":
        cv.rect(14, hy - 2, 18, hy - 1, metal, ox, yb)
        cv.plot(16, hy - 3, glow, ox, yb)
    elif key == "treasury":
        # crown fin
        for i, xx in enumerate((13, 15, 17, 19)):
            cv.rect(xx, hy - 3, xx, hy - 1, glow if i % 2 else lite, ox, yb)


def build_agent(key):
    p = dict(PAL[key]); p["_key"] = key
    sheet = Canvas(COLS * CELL, ROWS * CELL)
    atlas = {"cell": CELL, "cols": COLS, "rows": ROWS, "anims": {}}

    def cell(col, row):
        return col * CELL, row * CELL

    # row0 idle (2 frames)
    for f in range(2):
        ox, oy = cell(f, 0)
        draw_robot(sheet, p, ox, oy, "idle", f, "down")
    atlas["anims"]["idle"] = {"row": 0, "frames": 2, "fps": 2}

    # row1 walk-down (4)
    for f in range(4):
        ox, oy = cell(f, 1)
        draw_robot(sheet, p, ox, oy, "walk", f, "down")
    atlas["anims"]["walk_down"] = {"row": 1, "frames": 4, "fps": 8}

    # row2 walk-up (4)
    for f in range(4):
        ox, oy = cell(f, 2)
        draw_robot(sheet, p, ox, oy, "walk", f, "up")
    atlas["anims"]["walk_up"] = {"row": 2, "frames": 4, "fps": 8}

    # row3 walk-side (4)
    for f in range(4):
        ox, oy = cell(f, 3)
        draw_robot(sheet, p, ox, oy, "walk", f, "side")
    atlas["anims"]["walk_side"] = {"row": 3, "frames": 4, "fps": 8}

    # row4 sit + think
    ox, oy = cell(0, 4); draw_robot(sheet, p, ox, oy, "sit", 0, "down")
    ox, oy = cell(1, 4); draw_robot(sheet, p, ox, oy, "think", 0, "down")
    atlas["anims"]["sit"] = {"row": 4, "col": 0, "frames": 1, "fps": 1}
    atlas["anims"]["think"] = {"row": 4, "col": 1, "frames": 1, "fps": 1}

    # scale up 4x for crisp preview PNG (nearest)
    big = sheet.img.resize((sheet.w * 4, sheet.h * 4), Image.NEAREST)
    sheet.img.save(f"/home/claude/sprite_{key}.png")
    big.save(f"/home/claude/sprite_{key}_4x.png")
    with open(f"/home/claude/sprite_{key}.json", "w") as fh:
        json.dump(atlas, fh, indent=2)
    return sheet


for k in PAL:
    build_agent(k)
    print(f"built sprite_{k}.png (+4x preview, +json atlas)")

# Build a combined contact-sheet preview (idle frame of each, 8x) for quick look
combo = Image.new("RGBA", (3 * CELL * 6, CELL * 6), (10, 10, 11, 255))
for i, k in enumerate(PAL):
    s = Image.open(f"/home/claude/sprite_{k}.png").crop((0, 0, CELL, CELL))
    s = s.resize((CELL * 6, CELL * 6), Image.NEAREST)
    combo.paste(s, (i * CELL * 6, 0), s)
combo.save("/home/claude/sprites_combo.png")
print("built sprites_combo.png")
