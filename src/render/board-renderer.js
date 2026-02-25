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
    this._camPos = null;
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
    this._canvas.style.setProperty("--grid-width",  String(width));
    this._canvas.style.setProperty("--grid-height", String(height));
    this._canvas.width  = width;
    this._canvas.height = height;
    this._ctx = this._canvas.getContext("2d");
    if (this._ctx) this._ctx.imageSmoothingEnabled = false;
    this._layerCache = null;
    this._camPos     = null;  // reset smooth-follow on board resize / mode change
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

    const layerCanvas = document.createElement("canvas");
    layerCanvas.width  = this._width;
    layerCanvas.height = this._height;
    const lctx = layerCanvas.getContext("2d");
    if (lctx) lctx.imageSmoothingEnabled = false;

    lctx.fillStyle = bg;
    lctx.fillRect(0, 0, this._width, this._height);
    lctx.strokeStyle = border;
    lctx.lineWidth = 0.05;

    for (let x = 1; x < this._width; x += 1) {
      lctx.beginPath(); lctx.moveTo(x, 0); lctx.lineTo(x, this._height); lctx.stroke();
    }
    for (let y = 1; y < this._height; y += 1) {
      lctx.beginPath(); lctx.moveTo(0, y); lctx.lineTo(this._width, y); lctx.stroke();
    }

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
      this._ctx.fillRect(0, 0, this._width, this._height);
    }

    // paint: uses _project() which writes to _rp — zero allocations per call.
    const paint = (pos, colorKey, opacity = 1, overrideColor = null) => {
      if (!this._project(isSouls, pos, origin)) return;
      this._ctx.globalAlpha = opacity;
      this._ctx.fillStyle   = overrideColor ?? this._getColor(colorKey);
      this._ctx.fillRect(this._rp.x, this._rp.y, 1, 1);
      this._ctx.globalAlpha = 1;
    };

    // lerpPos: uses _lerpTo() which writes to _lp — zero allocations per call.
    const lerpPos = (cur, prev, maxD = 10) =>
      interp ? this._lerpTo(prev, cur, interp.alpha, maxD) : cur;

    // Barriers
    for (const b of (modeState.barriers ?? [])) paint(b, "--barrier");

    // Souls-specific static elements
    if (modeState.mode === "souls") {
      for (const h of (modeState.souls.hazards ?? [])) paint(h, "--hazard");

      const tel = modeState.souls.enemyTeleportPreview;
      if (tel) {
        const tw = tel.width ?? tel.size ?? 1, th = tel.height ?? tel.size ?? 1;
        for (let dy = 0; dy < th; dy++) for (let dx = 0; dx < tw; dx++) {
          this._ep.x = tel.x + dx; this._ep.y = tel.y + dy;
          paint(this._ep, "--telegraph");
        }
      }

      if (modeState.souls.sigil)           paint(modeState.souls.sigil, "--sigil");
      if (modeState.souls.echo?.position)  paint(modeState.souls.echo.position, "--echo");
    }

    // Food / power-up
    if (modeState.base.food) paint(modeState.base.food, "--food");
    if (modeState.powerUp)   paint(modeState.powerUp, "--power");

    // Enemy — uses _ep scratch for multi-cell tiles, _lp for lerped anchor.
    if (modeState.enemy) {
      const ew = modeState.enemy.width ?? modeState.enemy.size ?? 1;
      const eh = modeState.enemy.height ?? modeState.enemy.size ?? 1;
      const anchor = lerpPos(modeState.enemy, prevState?.enemy ?? null, 24);
      for (let dy = 0; dy < eh; dy++) for (let dx = 0; dx < ew; dx++) {
        this._ep.x = anchor.x + dx; this._ep.y = anchor.y + dy;
        paint(this._ep, "--enemy");
      }
    }

    // Minions (Souls)
    if (isSouls) {
      for (const minion of (modeState.souls.minions ?? [])) {
        const anchor = lerpPos(minion, this._prevMinionMap.get(minion.id) ?? null, 20);
        paint(anchor, "--minion");
      }
    }

    // Snake
    const variantId = modeState.mode === "souls" ? modeState.souls?.selectedSnakeId : null;
    const vc = BoardRenderer.SNAKE_VARIANT_COLORS[variantId];
    const getSnakeColor = isHead =>
      vc ? vc[isHead ? 0 : 1] : this._getColor(isHead ? "--snake-head" : "--snake");

    const snake = modeState.base.snake ?? [];
    for (let i = 0; i < snake.length; i++) {
      // Use explicit prevBody snapshot (set by _onStep before mutation) so
      // lerp always has a real "before" position, even if stepModeState
      // mutates arrays in-place rather than returning new references.
      const prev = modeState.prevBody?.[i] ?? prevState?.base?.snake?.[i] ?? null;
      const worldPos = lerpPos(snake[i], prev, 16);
      // _lerpTo wrote to _lp (or worldPos === snake[i]); _project writes to _rp.
      if (!this._project(isSouls, worldPos, origin)) continue;

      let opacity = 1;
      if (i > 0) {
        const ratio = snake.length > 1 ? i / (snake.length - 1) : 1;
        opacity = Math.max(0.25, 1 - ratio * 0.75);
      }

      this._ctx.globalAlpha = opacity;
      this._ctx.fillStyle   = getSnakeColor(i === 0);
      this._ctx.fillRect(this._rp.x, this._rp.y, 1, 1);
      this._ctx.globalAlpha = 1;
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
    this._rp.x = Math.round(isSouls ? pos.x - origin.originX : pos.x);
    this._rp.y = Math.round(isSouls ? pos.y - origin.originY : pos.y);
    return this._rp.x >= 0 && this._rp.x < this._width
        && this._rp.y >= 0 && this._rp.y < this._height;
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

    // Advance smooth-follow camera toward target using exponential decay.
    if (!this._camPos) {
      this._camPos = { x: targetX, y: targetY };
    } else {
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

    // Sub-tick alpha lerp between previous smooth position and current.
    const prevCam  = interp.fromState?.souls?.camera ?? cam;
    const prevMinX = (prevCam.centerX ?? 0) - Math.floor((prevCam.width  ?? 0) / 2);
    const prevMinY = (prevCam.centerY ?? 0) - Math.floor((prevCam.height ?? 0) / 2);
    this._origin.originX = BoardRenderer._lerpNum(prevMinX, camMinX, interp.alpha);
    this._origin.originY = BoardRenderer._lerpNum(prevMinY, camMinY, interp.alpha);
    return this._origin;
  }

  static _lerpNum(a, b, t) {
    return a + (b - a) * t;
  }

  /** @deprecated — kept only so existing tests that reference it don't break. */
  static _lerp(prev, cur, alpha, maxDelta) {
    if (!prev || !cur) return cur;
    const dx = cur.x - prev.x, dy = cur.y - prev.y;
    if (Math.abs(dx) > maxDelta || Math.abs(dy) > maxDelta) return cur;
    return { x: prev.x + dx * alpha, y: prev.y + dy * alpha };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BoardRenderer;
}
