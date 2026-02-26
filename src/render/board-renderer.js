"use strict";

const Interpolation = require("../core/interpolation.js");

/**
 * BoardRenderer — renderiza o board do jogo via Canvas 2D API.
 *
 * SRP: única responsabilidade de pintar o estado de jogo na tela.
 * DIP: recebe o elemento canvas e um helper de cor via construtor — nem um
 *   `document` call interno.
 *
 * Suporta interpolação de posição (para modo Souls com fixed-step).
 */
class BoardRenderer {
  /** Canvas pixels per grid cell — drives resolution of the scaled canvas. */
  static CELL_PX = 20;

  /** Cores por variante de cobra (Souls). */
  static SNAKE_VARIANT_COLORS = Object.freeze({
    basica:  Object.freeze(["#ff4332", "#f2684f"]),
    veloz:   Object.freeze(["#4ebdff", "#2f90ff"]),
    tanque:  Object.freeze(["#ffab72", "#df8150"]),
    vidente: Object.freeze(["#bb8cff", "#8f5eff"]),
  });

  /**
   * @param {object}   deps
   * @param {HTMLCanvasElement} deps.canvas   Elemento canvas
   * @param {Function} deps.getColor          (cssVar: string) → string  (ex: "--cell-bg")
   */
  constructor(deps) {
    if (!deps?.canvas) throw new Error("BoardRenderer: deps.canvas é obrigatório.");
    if (typeof deps?.getColor !== "function") throw new Error("BoardRenderer: deps.getColor é obrigatório.");

    this._canvas     = deps.canvas;
    this._getColor   = deps.getColor;
    this._ctx        = null;
    this._width      = 0;
    this._height     = 0;
    this._layerCache = null;  // { width, height, background, border, canvas }

    // Pre-allocated scratch objects — reused every frame to avoid GC pressure.
    this._rp  = { x: 0, y: 0 };  // projected render position (replaces _snap + _toRender)
    this._lp  = { x: 0, y: 0 };  // lerped world position     (replaces _lerp allocations)
    this._ep  = { x: 0, y: 0 };  // multi-cell entity scratch  (replaces inline { x:a+dx, y:a+dy })
    this._origin     = { originX: 0, originY: 0 };  // camera origin scratch
    this._prevMinionMap = new Map();  // reused instead of new Map() each frame

    // Smooth camera follow state (Souls mode only).
    // Null until first Souls render frame — reset on game start / mode change.
    this._camPos     = null;
    this._prevCamPos = null;  // snapshot of _camPos before smooth-follow advance — used for sub-tick lerp
  }

  // ── Setup ───────────────────────────────────────────────────────────────────

  /**
   * Garante que o canvas tenha as dimensões corretas e ctx válido.
   * @param {number} width
   * @param {number} height
   */
  ensureSize(width, height) {
    if (this._width === width && this._height === height && this._ctx) return;
    this._width  = width;
    this._height = height;
    const PX = BoardRenderer.CELL_PX;
    this._canvas.style.setProperty("--grid-width",  String(width));
    this._canvas.style.setProperty("--grid-height", String(height));
    this._canvas.width  = width  * PX;
    this._canvas.height = height * PX;
    this._ctx = this._canvas.getContext("2d");
    this._layerCache = null;
    this._camPos     = null;  // reset smooth-follow on board resize / mode change
    this._prevCamPos = null;
  }

  // ── Static grid layer (cached) ──────────────────────────────────────────────

  _ensureStaticLayer() {
    const bg     = this._getColor("--cell-bg");
    const border = this._getColor("--cell-border");
    const c = this._layerCache;
    if (c && c.width === this._width && c.height === this._height
        && c.background === bg && c.border === border) {
      return c.canvas;
    }

    // OffscreenCanvas avoids DOM touches; falls back to a regular canvas in
    // environments that don't support it (e.g. Node test runners).
    const PX = BoardRenderer.CELL_PX;
    const cw = this._width  * PX;
    const ch = this._height * PX;
    const layerCanvas = (typeof OffscreenCanvas !== "undefined")
      ? new OffscreenCanvas(cw, ch)
      : Object.assign(document.createElement("canvas"), { width: cw, height: ch });
    const lctx = layerCanvas.getContext("2d");

    lctx.fillStyle = bg;
    lctx.fillRect(0, 0, cw, ch);
    lctx.strokeStyle = border;
    lctx.lineWidth = 0.5;
    lctx.globalAlpha = 0.18;

    // Single beginPath + stroke: one draw call instead of (width + height) calls.
    lctx.beginPath();
    for (let x = 1; x < this._width; x++) {
      lctx.moveTo(x * PX, 0); lctx.lineTo(x * PX, ch);
    }
    for (let y = 1; y < this._height; y++) {
      lctx.moveTo(0, y * PX); lctx.lineTo(cw, y * PX);
    }
    lctx.stroke();
    lctx.globalAlpha = 1;

    this._layerCache = { width: this._width, height: this._height, background: bg, border, canvas: layerCanvas };
    return layerCanvas;
  }

  // ── Core ────────────────────────────────────────────────────────────────────

  /**
   * Renderiza o estado de jogo no canvas.
   *
   * @param {object} modeState   Estado atual do jogo
   * @param {object} [opts]
   * @param {object} [opts.interpolation]  { fromState, alpha } — interpolação para Souls
   */
  render(modeState, opts = {}) {
    if (!modeState || !this._ctx) return;

    const deltaMs = opts.deltaMs ?? 16;

    // Flat-style cell drawing constants — all in real canvas pixels.
    const PX          = BoardRenderer.CELL_PX;
    const CELL_P      = Math.round(PX * 0.08);       // ~2px padding per side
    const CELL_S      = PX - CELL_P * 2;             // ~16px drawn size
    const CELL_R      = Math.round(PX * 0.22);       // ~4px corner radius
    const CELL_R_HEAD = Math.round(PX * 0.36);       // ~7px corner radius for head

    // Reusable fill-cell helper — writes a rounded rect at canvas pixel coords (cx, cy).
    const fillCell = (cx, cy, radius = CELL_R) => {
      this._ctx.beginPath();
      if (this._ctx.roundRect) {
        this._ctx.roundRect(cx + CELL_P, cy + CELL_P, CELL_S, CELL_S, radius);
      } else {
        this._ctx.rect(cx + CELL_P, cy + CELL_P, CELL_S, CELL_S);
      }
      this._ctx.fill();
    };

    const hasInterp = opts.interpolation?.fromState != null;
    const interp = hasInterp
      ? { fromState: opts.interpolation.fromState, alpha: Math.max(0, Math.min(1, opts.interpolation.alpha ?? 0)) }
      : null;

    const prevState = interp?.fromState ?? null;

    // Reuse pre-allocated map — clear + fill instead of new Map() each frame.
    this._prevMinionMap.clear();
    for (const m of (prevState?.souls?.minions ?? [])) {
      if (m?.id) this._prevMinionMap.set(m.id, m);
    }

    const isSouls = modeState.mode === "souls";
    const origin  = this._getSoulsOrigin(modeState, interp, deltaMs);

    // Background
    const staticLayer = this._ensureStaticLayer();
    if (staticLayer) {
      this._ctx.drawImage(staticLayer, 0, 0);
    } else {
      this._ctx.fillStyle = this._getColor("--cell-bg");
      this._ctx.fillRect(0, 0, this._width * PX, this._height * PX);
    }

    const HALF = PX * 0.5;  // center offset within a cell (pixels)
    const GLOW = Math.round(PX * 0.35);  // shadow blur radius (~7px)

    // ── paint helpers ────────────────────────────────────────────────────────

    // paint: square rounded cell — used for grid-like elements (barriers, hazards…)
    const paint = (pos, colorKey, opacity = 1, overrideColor = null) => {
      if (!this._project(isSouls, pos, origin)) return;
      this._ctx.globalAlpha = opacity;
      this._ctx.fillStyle   = overrideColor ?? this._getColor(colorKey);
      fillCell(this._rp.x, this._rp.y);
      this._ctx.globalAlpha = 1;
    };

    // paintCircle: circular icon — used for collectible/character entities.
    const paintCircle = (pos, colorKey, overrideColor = null, withGlow = false) => {
      if (!this._project(isSouls, pos, origin)) return;
      const color = overrideColor ?? this._getColor(colorKey);
      if (withGlow) { this._ctx.shadowBlur = GLOW; this._ctx.shadowColor = color; }
      this._ctx.fillStyle = color;
      this._ctx.beginPath();
      this._ctx.arc(this._rp.x + HALF, this._rp.y + HALF, PX * 0.38, 0, Math.PI * 2);
      this._ctx.fill();
      if (withGlow) { this._ctx.shadowBlur = 0; this._ctx.shadowColor = "transparent"; }
    };

    // lerpPos: uses _lerpTo() which writes to _lp — zero allocations per call.
    const lerpPos = (cur, prev, maxD = 10) =>
      interp ? this._lerpTo(prev, cur, interp.alpha, maxD) : cur;

    // ── Grid-layer entities (static / world) ─────────────────────────────────

    // Barriers — flat rounded cells (they ARE part of the grid)
    for (const b of (modeState.barriers ?? [])) {
      if (isSouls && !this._isInViewport(b, origin)) continue;
      paint(b, "--barrier");
    }

    // Souls-specific static elements
    if (modeState.mode === "souls") {
      for (const h of (modeState.souls.hazards ?? [])) {
        if (!this._isInViewport(h, origin)) continue;
        paint(h, "--hazard");
      }

      const tel = modeState.souls.enemyTeleportPreview;
      if (tel) {
        const tw = tel.width ?? tel.size ?? 1, th = tel.height ?? tel.size ?? 1;
        for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) {
          this._ep.x = tel.x + dx; this._ep.y = tel.y + dy;
          paint(this._ep, "--telegraph");
        }
      }

      // Sigil & echo — circular collectibles
      if (modeState.souls.sigil)           paintCircle(modeState.souls.sigil,          "--sigil", null, true);
      if (modeState.souls.echo?.position)  paintCircle(modeState.souls.echo.position,  "--echo");
    }

    // Food / power-up — circular collectibles with glow
    if (modeState.base.food) paintCircle(modeState.base.food, "--food", null, true);
    if (modeState.powerUp)   paintCircle(modeState.powerUp,   "--power", null, true);

    // ── Character entities ────────────────────────────────────────────────────

    // Enemy — single unified shape (bounding-box roundRect) so multi-cell bosses
    // look like one solid element instead of a mosaic of tiles.
    if (modeState.enemy) {
      const ew     = modeState.enemy.width  ?? modeState.enemy.size ?? 1;
      const eh     = modeState.enemy.height ?? modeState.enemy.size ?? 1;
      const anchor = lerpPos(modeState.enemy, prevState?.enemy ?? null, 24);
      const gx     = isSouls ? anchor.x - origin.originX : anchor.x;
      const gy     = isSouls ? anchor.y - origin.originY : anchor.y;
      if (gx + ew > 0 && gx < this._width && gy + eh > 0 && gy < this._height) {
        const color = this._getColor("--enemy");
        const er    = Math.round(PX * 0.28);
        this._ctx.shadowBlur  = GLOW;
        this._ctx.shadowColor = color;
        this._ctx.fillStyle   = color;
        this._ctx.beginPath();
        if (this._ctx.roundRect) {
          this._ctx.roundRect(gx * PX + CELL_P, gy * PX + CELL_P, ew * PX - CELL_P * 2, eh * PX - CELL_P * 2, er);
        } else {
          this._ctx.rect(gx * PX + CELL_P, gy * PX + CELL_P, ew * PX - CELL_P * 2, eh * PX - CELL_P * 2);
        }
        this._ctx.fill();
        this._ctx.shadowBlur  = 0;
        this._ctx.shadowColor = "transparent";
      }
    }

    // Minions (Souls) — circular characters
    if (isSouls) {
      for (const minion of (modeState.souls.minions ?? [])) {
        if (!this._isInViewport(minion, origin)) continue;
        const anchor = lerpPos(minion, this._prevMinionMap.get(minion.id) ?? null, 20);
        paintCircle(anchor, "--minion");
      }
    }

    // Snake — continuous ribbon path (tail → head) so the whole body reads as
    // one fluid element, not individual cell tiles.
    const variantId = modeState.mode === "souls" ? modeState.souls?.selectedSnakeId : null;
    const vc = BoardRenderer.SNAKE_VARIANT_COLORS[variantId];
    const headColor = vc ? vc[0] : this._getColor("--snake-head");
    const bodyColor = vc ? vc[1] : this._getColor("--snake");

    const snake = modeState.base.snake ?? [];
    if (snake.length > 0) {
      // Body stroke — drawn from tail to head so the head renders on top.
      const SW = Math.round(PX * 0.72);  // stroke width ≈ 14px (slightly inset from cell)
      this._ctx.lineWidth   = SW;
      this._ctx.lineCap     = "round";
      this._ctx.lineJoin    = "round";
      this._ctx.strokeStyle = bodyColor;
      this._ctx.beginPath();
      let pathStarted = false;
      for (let i = snake.length - 1; i >= 0; i--) {
        // Use explicit prevBody snapshot so lerp always has a real "before" position.
        const prev = modeState.prevBody?.[i] ?? prevState?.base?.snake?.[i] ?? null;
        const wp   = lerpPos(snake[i], prev, 16);
        // Convert grid coords → pixel center without writing to _rp scratch
        // (we need the raw grid coords, not a project-clamped pair).
        const gx = isSouls ? wp.x - origin.originX : wp.x;
        const gy = isSouls ? wp.y - origin.originY : wp.y;
        const cx = gx * PX + HALF;
        const cy = gy * PX + HALF;
        if (!pathStarted) { this._ctx.moveTo(cx, cy); pathStarted = true; }
        else              { this._ctx.lineTo(cx, cy); }
      }
      this._ctx.stroke();

      // Head — drawn separately with a distinct shape and glow on top of the body.
      const headPrev = modeState.prevBody?.[0] ?? prevState?.base?.snake?.[0] ?? null;
      const headWp   = lerpPos(snake[0], headPrev, 16);
      if (this._project(isSouls, headWp, origin)) {
        this._ctx.shadowBlur  = GLOW;
        this._ctx.shadowColor = headColor;
        this._ctx.fillStyle   = headColor;
        this._ctx.beginPath();
        if (this._ctx.roundRect) {
          this._ctx.roundRect(this._rp.x + CELL_P, this._rp.y + CELL_P, CELL_S, CELL_S, CELL_R_HEAD);
        } else {
          this._ctx.arc(this._rp.x + HALF, this._rp.y + HALF, HALF - CELL_P, 0, Math.PI * 2);
        }
        this._ctx.fill();
        this._ctx.shadowBlur  = 0;
        this._ctx.shadowColor = "transparent";
      }
    }
  }

  // ── Helpers internos ────────────────────────────────────────────────────────

  /**
   * Projects a world position to a snapped render position, writing the result
   * into the pre-allocated `_rp` scratch object.
   * @param {boolean} isSouls   Whether to apply camera offset.
   * @param {{x,y}}   pos       World-space position.
   * @param {{originX,originY}} origin  Camera top-left in world space.
   * @returns {boolean}  true if the position is within canvas bounds.
   */
  _project(isSouls, pos, origin) {
    if (!pos) return false;
    // Multiply by CELL_PX to convert grid units → canvas pixels.
    // No rounding — preserve fractional positions produced by _lerpTo so that
    // drawing renders sub-cell movement smoothly.
    const PX = BoardRenderer.CELL_PX;
    const gx = isSouls ? pos.x - origin.originX : pos.x;
    const gy = isSouls ? pos.y - origin.originY : pos.y;
    this._rp.x = gx * PX;
    this._rp.y = gy * PX;
    // Allow cells partially inside the canvas so entities sliding in/out of the
    // viewport edge aren't culled prematurely.
    return gx > -1 && gx < this._width
        && gy > -1 && gy < this._height;
  }

  /**
   * Lerps `prev` → `cur` by `alpha`, writing the result into the pre-allocated
   * `_lp` scratch object and returning it. Returns `cur` unchanged if no prev.
   * @param {{x,y}|null} prev
   * @param {{x,y}}      cur
   * @param {number}     alpha
   * @param {number}     maxDelta  If movement exceeds this, snap instead of lerp.
   * @returns {{x,y}}  Either `cur` (unchanged ref) or `_lp` (scratch ref).
   */
  _lerpTo(prev, cur, alpha, maxDelta) {
    if (!cur) return cur;
    if (!prev) { this._lp.x = cur.x; this._lp.y = cur.y; return this._lp; }
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    if (Math.abs(dx) > maxDelta || Math.abs(dy) > maxDelta) {
      this._lp.x = cur.x; this._lp.y = cur.y; return this._lp;
    }
    this._lp.x = prev.x + dx * alpha;
    this._lp.y = prev.y + dy * alpha;
    return this._lp;
  }

  /**
   * Calcula a origem do viewport Souls (considerando interpolação).
   * @param {object} modeState
   * @param {object|null} interp
   * @returns {{ originX: number, originY: number }}
   */
  /**
   * Computes the camera top-left origin, writing into the pre-allocated `_origin`
   * scratch and returning it.
   *
   * For Souls: applies exponential smooth-follow toward the head using deltaMs,
   * then alpha-lerps between the prev smooth position and the new one for
   * sub-tick precision.
   *
   * @param {object} modeState
   * @param {object|null} interp   { fromState, alpha }
   * @param {number} deltaMs       ms since last render frame
   */
  _getSoulsOrigin(modeState, interp, deltaMs = 16) {
    if (modeState.mode !== "souls") {
      this._origin.originX = 0; this._origin.originY = 0; return this._origin;
    }
    const cam = modeState.souls.camera;
    if (!cam) {
      this._origin.originX = 0; this._origin.originY = 0; return this._origin;
    }

    // Target = current camera center (head position this tick).
    const targetX = cam.centerX ?? 0;
    const targetY = cam.centerY ?? 0;

    // Snapshot _camPos BEFORE advancing — used as sub-tick lerp start so both
    // endpoints live in the same smoothed coordinate space (fixes double-smoothing).
    if (!this._camPos) {
      this._camPos     = { x: targetX, y: targetY };
      this._prevCamPos = { x: targetX, y: targetY };
    } else {
      if (!this._prevCamPos) this._prevCamPos = { x: this._camPos.x, y: this._camPos.y };
      else { this._prevCamPos.x = this._camPos.x; this._prevCamPos.y = this._camPos.y; }
      const next = Interpolation.cameraFollow(this._camPos, { x: targetX, y: targetY }, deltaMs, 60);
      this._camPos.x = next.x;
      this._camPos.y = next.y;
    }

    // Derive top-left origin from smooth camera center.
    const halfW = Math.floor((cam.width  ?? 0) / 2);
    const halfH = Math.floor((cam.height ?? 0) / 2);
    const camMinX = this._camPos.x - halfW;
    const camMinY = this._camPos.y - halfH;

    if (!interp) {
      this._origin.originX = camMinX;
      this._origin.originY = camMinY;
      return this._origin;
    }

    // Sub-tick alpha lerp between the pre-advance snapshot and the new smooth
    // position — both in smoothed space, so no coordinate mismatch.
    const prevMinX = this._prevCamPos.x - halfW;
    const prevMinY = this._prevCamPos.y - halfH;
    this._origin.originX = BoardRenderer._lerpNum(prevMinX, camMinX, interp.alpha);
    this._origin.originY = BoardRenderer._lerpNum(prevMinY, camMinY, interp.alpha);
    return this._origin;
  }

  /**
   * Returns true if `pos` is within or one cell outside the visible viewport.
   * Called before lerpPos/paint in hot loops to skip offscreen entities early.
   * @param {{x:number,y:number}|null} pos
   * @param {{originX:number,originY:number}} origin
   * @returns {boolean}
   */
  _isInViewport(pos, origin) {
    if (!pos) return false;
    const rx = pos.x - origin.originX;
    const ry = pos.y - origin.originY;
    return rx >= -1 && rx <= this._width  + 1
        && ry >= -1 && ry <= this._height + 1;
  }

  static _lerpNum(a, b, t) {
    return a + (b - a) * t;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BoardRenderer;
}
