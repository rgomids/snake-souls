"use strict";

const Interpolation   = require("../core/interpolation.js");
const WeaponCatalog   = require("../data/weapon-catalog.js");

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

    this._cellPx  = BoardRenderer.CELL_PX;  // pixels per grid cell — can be overridden per-frame

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
  /**
   * @param {number} width
   * @param {number} height
   * @param {number} [cellPx]  Override pixels-per-cell (default: CELL_PX).
   *                           Pass a DPI-aware value for immersive / fullscreen modes.
   */
  ensureSize(width, height, cellPx = BoardRenderer.CELL_PX) {
    if (this._width === width && this._height === height
        && this._cellPx === cellPx && this._ctx) return;
    this._width  = width;
    this._height = height;
    this._cellPx = cellPx;
    const PX = cellPx;
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
        && c.cellPx === this._cellPx
        && c.background === bg && c.border === border) {
      return c.canvas;
    }

    // OffscreenCanvas avoids DOM touches; falls back to a regular canvas in
    // environments that don't support it (e.g. Node test runners).
    const PX = this._cellPx;
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

    this._layerCache = { width: this._width, height: this._height, cellPx: this._cellPx, background: bg, border, canvas: layerCanvas };
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
    const PX          = this._cellPx;
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

    const isSouls      = modeState.mode === "souls";
    const isShooter    = modeState.mode === "traditional" && Boolean(modeState.shooter);
    const isCameraMode = isSouls || isShooter;
    const origin       = this._getSoulsOrigin(modeState, interp, deltaMs);

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
      if (!this._project(isCameraMode, pos, origin)) return;
      this._ctx.globalAlpha = opacity;
      this._ctx.fillStyle   = overrideColor ?? this._getColor(colorKey);
      fillCell(this._rp.x, this._rp.y);
      this._ctx.globalAlpha = 1;
    };

    // paintCircle: circular icon — used for collectible/character entities.
    const paintCircle = (pos, colorKey, overrideColor = null, withGlow = false) => {
      if (!this._project(isCameraMode, pos, origin)) return;
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
      if (isCameraMode && !this._isInViewport(b, origin)) continue;
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
        const gx     = isCameraMode ? anchor.x - origin.originX : anchor.x;
        const gy     = isCameraMode ? anchor.y - origin.originY : anchor.y;
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
        const gx = isCameraMode ? wp.x - origin.originX : wp.x;
        const gy = isCameraMode ? wp.y - origin.originY : wp.y;
        const cx = gx * PX + HALF;
        const cy = gy * PX + HALF;
        if (!pathStarted) { this._ctx.moveTo(cx, cy); pathStarted = true; }
        else              { this._ctx.lineTo(cx, cy); }
      }
      this._ctx.stroke();

      // Head — drawn separately with a distinct shape and glow on top of the body.
      const headPrev = modeState.prevBody?.[0] ?? prevState?.base?.snake?.[0] ?? null;
      const headWp   = lerpPos(snake[0], headPrev, 16);
      if (this._project(isCameraMode, headWp, origin)) {
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

        // ── Angry snake eyes ─────────────────────────────────────────────────
        {
          const _DIR_VEC = {
            UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0],
            UP_LEFT: [-1, -1], UP_RIGHT: [1, -1], DOWN_LEFT: [-1, 1], DOWN_RIGHT: [1, 1],
          };
          const dir  = modeState.base.direction ?? "RIGHT";
          const dv   = _DIR_VEC[dir] ?? [1, 0];
          const fvL  = Math.sqrt(dv[0] * dv[0] + dv[1] * dv[1]) || 1;
          const fnx  = dv[0] / fvL,  fny = dv[1] / fvL;   // forward unit vector
          const pnx  = fny,           pny = -fnx;           // perpendicular (90° CW)

          // ── Find nearest enemy (grid coords) across all modes ──────────────
          const headGX = snake[0].x, headGY = snake[0].y;
          let nearX = null, nearY = null, minD2 = Infinity;
          const checkE = (ex, ey) => {
            if (ex == null || ey == null) return;
            const d2 = (ex - headGX) ** 2 + (ey - headGY) ** 2;
            if (d2 < minD2) { minD2 = d2; nearX = ex; nearY = ey; }
          };
          if (modeState.enemy)               checkE(modeState.enemy.x, modeState.enemy.y);
          for (const m of (modeState.souls?.minions  ?? [])) checkE(m.x, m.y);
          for (const e of (modeState.shooter?.enemies ?? [])) checkE(e.x, e.y);

          // Look-vector: toward nearest enemy, or forward if none found.
          let lvx, lvy;
          if (nearX !== null) {
            const dx = nearX - headGX, dy = nearY - headGY;
            const ld = Math.sqrt(dx * dx + dy * dy) || 1;
            lvx = dx / ld; lvy = dy / ld;
          } else {
            lvx = fnx; lvy = fny;
          }

          // ── Eye geometry ───────────────────────────────────────────────────
          const hcx  = this._rp.x + HALF, hcy = this._rp.y + HALF;
          const fwd  = PX * 0.17;                    // forward offset from head centre
          const lat  = PX * 0.16;                    // lateral spread between eyes
          const irisR = Math.max(2, PX * 0.145);    // iris radius
          const slitRx = irisR * 0.22;              // slit half-width
          const slitRy = irisR * 0.68;              // slit half-height
          // Slit rotation: perpendicular to look direction so it slices through it.
          const slitAngle = Math.atan2(lvy, lvx) + Math.PI * 0.5;
          // Max pupil offset inside iris (keep it from clipping the edge)
          const maxOff = irisR * 0.32;
          const oxPup  = lvx * maxOff, oyPup = lvy * maxOff;

          // Centre of each eye (offset from head centre along forward + lateral axes)
          const ex1 = hcx + fnx * fwd + pnx * lat,  ey1 = hcy + fny * fwd + pny * lat;
          const ex2 = hcx + fnx * fwd - pnx * lat,  ey2 = hcy + fny * fwd - pny * lat;

          const ctx = this._ctx;

          // ── Draw one eye (iris → slit pupil → glint) ──────────────────────
          const drawEye = (ex, ey) => {
            // Dark limbal ring (socket shadow)
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.beginPath(); ctx.arc(ex, ey, irisR + Math.max(0.8, PX * 0.04), 0, Math.PI * 2); ctx.fill();
            // Amber iris
            ctx.fillStyle = "#ffb700";
            ctx.beginPath(); ctx.arc(ex, ey, irisR, 0, Math.PI * 2); ctx.fill();
            // Vertical slit pupil (ellipse, rotated perpendicular to look direction)
            ctx.fillStyle = "#111";
            ctx.beginPath();
            if (ctx.ellipse) {
              ctx.ellipse(ex + oxPup, ey + oyPup, slitRx, slitRy, slitAngle, 0, Math.PI * 2);
            } else {
              // Fallback: small circle pupil
              ctx.arc(ex + oxPup, ey + oyPup, irisR * 0.38, 0, Math.PI * 2);
            }
            ctx.fill();
            // Tiny specular glint
            ctx.fillStyle = "rgba(255,255,255,0.72)";
            ctx.beginPath();
            ctx.arc(ex - irisR * 0.28 + oxPup * 0.2, ey - irisR * 0.28 + oyPup * 0.2,
                    Math.max(0.6, irisR * 0.22), 0, Math.PI * 2);
            ctx.fill();
          };

          drawEye(ex1, ey1);
          drawEye(ex2, ey2);

          // ── Angry brows — follow the look vector (track the enemy) ───────────
          // Each brow: outer end tilted toward target, inner end raised away →
          // forms a V-frown that always scowls toward the nearest enemy.
          const bLen   = irisR * 1.05;   // half-length of each brow
          const bDist  = irisR * 1.48;   // perpendicular offset from eye centre to brow midpoint
          const bSlant = irisR * 0.52;   // rise/drop delta between inner and outer ends

          // "brow-up": perp to look direction, pointing "away from target" (above the eye).
          // Choose the 90° rotation of (lvx,lvy) that best aligns with the head's own up direction.
          const headUpX = -fny, headUpY =  fnx;   // 90° CCW of forward = "above the head"
          const bpCCW_x = -lvy, bpCCW_y =  lvx;  // CCW perp of look
          const bpCW_x  =  lvy, bpCW_y  = -lvx;  // CW  perp of look
          const usesCCW = (bpCCW_x * headUpX + bpCCW_y * headUpY) >= 0;
          const bUpX = usesCCW ? bpCCW_x : bpCW_x;
          const bUpY = usesCCW ? bpCCW_y : bpCW_y;

          ctx.strokeStyle = "rgba(10,4,0,0.88)";
          ctx.lineWidth   = Math.max(1, PX * 0.1);
          ctx.lineCap     = "round";

          // Eye 1 (+pnx side): inner end = toward centre (-pnx) = raised + tilted away from look.
          //                    outer end = away from centre (+pnx) = lowered + tilted toward look.
          ctx.beginPath();
          ctx.moveTo(ex1 + pnx * bLen + bUpX * (bDist - bSlant) + lvx * bSlant,   // outer (low)
                     ey1 + pny * bLen + bUpY * (bDist - bSlant) + lvy * bSlant);
          ctx.lineTo(ex1 - pnx * bLen + bUpX * (bDist + bSlant) - lvx * bSlant,   // inner (high)
                     ey1 - pny * bLen + bUpY * (bDist + bSlant) - lvy * bSlant);
          ctx.stroke();

          // Eye 2 (-pnx side): mirror — inner end is at +pnx.
          ctx.beginPath();
          ctx.moveTo(ex2 - pnx * bLen + bUpX * (bDist - bSlant) + lvx * bSlant,   // outer (low)
                     ey2 - pny * bLen + bUpY * (bDist - bSlant) + lvy * bSlant);
          ctx.lineTo(ex2 + pnx * bLen + bUpX * (bDist + bSlant) - lvx * bSlant,   // inner (high)
                     ey2 + pny * bLen + bUpY * (bDist + bSlant) - lvy * bSlant);
          ctx.stroke();

          ctx.lineWidth = 1;
        }
      }
    }

    // ── Shooter overlays (segmentos, inimigos, projéteis, onda) ───────────────
    if (isShooter && modeState.shooter) {
      const sh = modeState.shooter;

      // Ângulo de rotação baseado na direção atual da cobra
      // atan2(vy, vx) + π/2 mapeia o vetor de direção para ângulo de canvas
      // onde 0 = apontando para cima (orientação padrão do símbolo).
      const _DIR_ANGLE = Object.freeze({
        UP:         -Math.PI / 2 + Math.PI / 2,   //  0
        UP_RIGHT:   -Math.PI / 4 + Math.PI / 2,   //  π/4
        RIGHT:       0           + Math.PI / 2,   //  π/2
        DOWN_RIGHT:  Math.PI / 4 + Math.PI / 2,   //  3π/4
        DOWN:        Math.PI / 2 + Math.PI / 2,   //  π
        DOWN_LEFT:   3*Math.PI/4 + Math.PI / 2,   //  5π/4
        LEFT:        Math.PI     + Math.PI / 2,   //  3π/2
        UP_LEFT:    -3*Math.PI/4 + Math.PI / 2,   // -π/4
      });
      const snakeAngle = _DIR_ANGLE[modeState.base.direction] ?? 0;

      // Ícones de tipo nos segmentos da cobra (weapon = símbolo rotacionado, life = bolinha verde)
      for (let si = 0; si < snake.length; si++) {
        const seg = snake[si];
        if (seg.type !== "weapon" && seg.type !== "life") continue;
        const prev = modeState.prevBody?.[si] ?? null;
        const wp   = lerpPos(seg, prev, 16);
        if (!this._project(isCameraMode, wp, origin)) continue;
        const rx = this._rp.x, ry = this._rp.y;
        if (seg.type === "weapon") {
          const wDef   = WeaponCatalog.getById(seg.weaponId);
          const symbol = wDef?.symbol        ?? "✦";
          const wColor = wDef?.color         ?? "#ffe066";
          const wDisCl = wDef?.disabledColor ?? "#777777";
          const blink  = seg.disabled && Math.floor(Date.now() / 280) % 2 === 0;
          // Carry animation — step-driven so the weapon only swings when the
          // snake actually moves; completely still when the player stops.
          //
          // stepAmp: half-sine envelope 0→1→0 across the cooldown window.
          //   moveAccumMs counts down from movePeriodMs→0 after each step.
          //   When idle moveAccumMs==0 → phase=1 → sin(π)=0 (neutral).
          const sh_          = modeState.shooter;
          const movePeriodMs = sh_?.movePeriodMs ?? 200;
          const moveAccumMs_ = sh_?.moveAccumMs  ?? 0;
          const stepCount    = sh_?.moveStepCount ?? 0;
          const stepPhase    = 1 - (moveAccumMs_ / movePeriodMs);      // 0→1 during step cooldown
          const stepAmp      = Math.sin(stepPhase * Math.PI);          // 0→1→0 smooth envelope
          // Alternate swing direction each step (left/right carry sway)
          const stepDir      = Math.sin(stepCount * 2.1);              // slowly rotates sign
          const swayRot      = stepAmp * stepDir * 0.22;               // ±~13° blade wobble
          const lateralPx    = stepAmp * stepDir * PX * 0.10;          // lateral carry swing
          const forwardPx    = PX * 0.28;                              // push toward snake front
          const bobPx        = stepAmp * PX * 0.06;                    // subtle depth bob
          this._ctx.globalAlpha  = blink ? 0.15 : (seg.disabled ? 0.45 : 1.0);
          this._ctx.fillStyle    = seg.disabled ? wDisCl : wColor;
          this._ctx.font         = `bold ${Math.round(PX * 0.68)}px sans-serif`;
          this._ctx.textAlign    = "center";
          this._ctx.textBaseline = "middle";
          this._ctx.save();
          // Translate to cell centre, rotate to face snake direction + blade wobble.
          // In the rotated frame: y-axis = forward direction of the snake.
          this._ctx.translate(rx + HALF, ry + HALF);
          this._ctx.rotate(snakeAngle + swayRot);
          // Offset forward (negative y = "up" in rotated frame = snake forward),
          // plus lateral sway and subtle bob.
          this._ctx.translate(lateralPx, -forwardPx + bobPx);  // eslint-disable-line
          // Drop shadow for depth — makes the symbol look embedded rather than floating
          this._ctx.shadowColor   = "rgba(0,0,0,0.55)";
          this._ctx.shadowBlur    = 3;
          this._ctx.shadowOffsetX = 1;
          this._ctx.shadowOffsetY = 1;
          this._ctx.fillText(symbol, 0, 0);
          this._ctx.shadowColor   = "transparent";
          this._ctx.shadowBlur    = 0;
          this._ctx.shadowOffsetX = 0;
          this._ctx.shadowOffsetY = 0;
          this._ctx.restore();
          this._ctx.globalAlpha  = 1;
        } else {
          // life — pequena bolinha verde
          this._ctx.globalAlpha  = 0.9;
          this._ctx.fillStyle    = "#44dd88";
          this._ctx.beginPath();
          this._ctx.arc(rx + HALF, ry + HALF, Math.round(PX * 0.22), 0, Math.PI * 2);
          this._ctx.fill();
          this._ctx.globalAlpha  = 1;
        }
      }

      // Inimigos — formas geométricas distintas por tipo, rotacionadas em direção ao player
      for (const e of (sh.enemies ?? [])) {
        if (!this._project(isCameraMode, e, origin)) continue;
        const rx = this._rp.x, ry = this._rp.y;
        const clr = e.color ?? "#e84040";
        this._ctx.shadowBlur  = Math.round(PX * 0.4);
        this._ctx.shadowColor = clr;
        this._ctx.fillStyle   = clr;
        const shape = e.shape ?? "diamond";
        // Rotaciona o símbolo em direção ao player.
        // facingAngle = atan2(dy, dx) onde dy/dx apontam do inimigo ao player.
        // O símbolo-padrão aponta para cima (−π/2), então a rotação é facingAngle + π/2.
        const angle = (e.facingAngle ?? -Math.PI / 2) + Math.PI / 2;
        const cx = rx + HALF, cy = ry + HALF;  // centro da célula em pixels
        const R  = HALF - CELL_P;              // raio útil dentro do padding
        this._ctx.save();
        this._ctx.translate(cx, cy);
        this._ctx.rotate(angle);
        this._ctx.beginPath();
        if (shape === "triangle") {
          this._ctx.moveTo(0,  -R);
          this._ctx.lineTo(R,   R);
          this._ctx.lineTo(-R,  R);
          this._ctx.closePath();
        } else if (shape === "square") {
          if (this._ctx.roundRect) {
            this._ctx.roundRect(-R, -R, R * 2, R * 2, 2);
          } else {
            this._ctx.rect(-R, -R, R * 2, R * 2);
          }
        } else {
          // diamond (padrão)
          this._ctx.moveTo(0,  -R);
          this._ctx.lineTo(R,   0);
          this._ctx.lineTo(0,   R);
          this._ctx.lineTo(-R,  0);
          this._ctx.closePath();
        }
        this._ctx.fill();
        this._ctx.restore();
        this._ctx.shadowBlur  = 0;
        this._ctx.shadowColor = "transparent";
        // Barra de HP (apenas inimigos com mais de 1 HP)
        if (e.maxHp > 1) {
          const barW   = CELL_S;
          const barH   = 3;
          const filled = Math.max(0, Math.round(barW * (e.hp / e.maxHp)));
          this._ctx.globalAlpha = 0.85;
          this._ctx.fillStyle   = "#222222";
          this._ctx.fillRect(rx + CELL_P, ry + CELL_P - barH - 1, barW, barH);
          this._ctx.fillStyle   = "#ff4444";
          this._ctx.fillRect(rx + CELL_P, ry + CELL_P - barH - 1, filled, barH);
          this._ctx.globalAlpha = 1;
        }
      }

      // Projéteis — pequeno ponto com brilho (armas ranged futuras)
      for (const p of (sh.projectiles ?? [])) {
        if (!this._project(isCameraMode, p, origin)) continue;
        const clr = p.color ?? "#ffe066";
        this._ctx.fillStyle   = clr;
        this._ctx.shadowBlur  = Math.round(PX * 0.35);
        this._ctx.shadowColor = clr;
        this._ctx.beginPath();
        this._ctx.arc(this._rp.x + HALF, this._rp.y + HALF, Math.round(PX * 0.17), 0, Math.PI * 2);
        this._ctx.fill();
        this._ctx.shadowBlur  = 0;
        this._ctx.shadowColor = "transparent";
      }

      // Swings melee — arco de slash que varre de um lado ao outro na direção da cabeça
      for (const sw of (sh.swings ?? [])) {
        const progress = 1 - sw.ttlMs / sw.durationMs;   // 0→1 ao longo do swing
        if (progress <= 0) continue;

        if (!this._project(isCameraMode, sw, origin)) continue;
        const rx = this._rp.x + HALF;
        const ry = this._rp.y + HALF;

        const radius     = sw.range * PX;
        const totalArc   = (sw.arcDeg) * (Math.PI / 180);
        const halfArcRad = totalArc / 2;
        const baseAngle  = Math.atan2(sw.dy, sw.dx);
        const startAngle = baseAngle - halfArcRad;
        const leadAngle  = startAngle + totalArc * progress;  // varredura de início → fim
        const clr        = sw.color ?? "#ffe066";

        // Opacidade: plena até 70% do swing, depois esvanece
        const fade = progress < 0.7 ? 1.0 : (1.0 - (progress - 0.7) / 0.3);

        // Área varrida — setor translúcido como rastro do slash
        this._ctx.globalAlpha = fade * 0.28;
        this._ctx.fillStyle   = clr;
        this._ctx.shadowBlur  = Math.round(PX * 0.6);
        this._ctx.shadowColor = clr;
        this._ctx.beginPath();
        this._ctx.moveTo(rx, ry);
        this._ctx.arc(rx, ry, radius, startAngle, leadAngle);
        this._ctx.closePath();
        this._ctx.fill();

        // Borda da lâmina — arco brilhante na ponta líder do slash
        const bladeSpan  = Math.max(totalArc * 0.22, 0.18);   // 22% do arco total
        const bladeStart = Math.max(startAngle, leadAngle - bladeSpan);
        this._ctx.globalAlpha = fade * 1.0;
        this._ctx.strokeStyle = clr;
        this._ctx.lineWidth   = Math.max(2, Math.round(PX * 0.14));
        this._ctx.shadowBlur  = Math.round(PX * 1.5);
        this._ctx.beginPath();
        this._ctx.arc(rx, ry, radius, bladeStart, leadAngle);
        this._ctx.stroke();

        // Ponto de impacto — pequeno brilho no extremo da lâmina
        const tipX = rx + Math.cos(leadAngle) * radius;
        const tipY = ry + Math.sin(leadAngle) * radius;
        this._ctx.globalAlpha = fade * 0.9;
        this._ctx.fillStyle   = "#ffffff";
        this._ctx.shadowBlur  = Math.round(PX * 2.0);
        this._ctx.beginPath();
        this._ctx.arc(tipX, tipY, Math.round(PX * 0.12), 0, Math.PI * 2);
        this._ctx.fill();

        this._ctx.shadowBlur  = 0;
        this._ctx.shadowColor = "transparent";
        this._ctx.lineWidth   = 1;
        this._ctx.globalAlpha = 1;
      }

      // Overlay de countdown entre ondas
      if (sh.wave.phase === "countdown") {
        const secs  = Math.ceil(sh.wave.countdownMs / 1000);
        const cvx   = this._width  * PX / 2;
        const cvy   = this._height * PX / 2;
        const label = `Onda ${sh.wave.number} em ${secs}s`;
        const fSz   = Math.round(PX * 0.9);
        this._ctx.font          = `bold ${fSz}px sans-serif`;
        this._ctx.textAlign     = "center";
        this._ctx.textBaseline  = "middle";
        const tw = this._ctx.measureText(label).width;
        this._ctx.globalAlpha = 0.7;
        this._ctx.fillStyle   = "rgba(0,0,0,0.6)";
        this._ctx.fillRect(cvx - tw / 2 - 12, cvy - fSz * 0.8, tw + 24, fSz * 1.6);
        this._ctx.globalAlpha = 1;
        this._ctx.fillStyle   = "#ffffff";
        this._ctx.fillText(label, cvx, cvy);
      }
    }
  }

  // ── Helpers internos ────────────────────────────────────────────────────────

  /**
   * Projects a world position to a snapped render position, writing the result
   * into the pre-allocated `_rp` scratch object.
   * @param {boolean} useCameraOffset  Whether to apply camera origin offset.
   * @param {{x,y}}   pos              World-space position.
   * @param {{originX,originY}} origin Camera top-left in world space.
   * @returns {boolean}  true if the position is within canvas bounds.
   */
  _project(useCameraOffset, pos, origin) {
    if (!pos) return false;
    const PX = this._cellPx;
    const gx = useCameraOffset ? pos.x - origin.originX : pos.x;
    const gy = useCameraOffset ? pos.y - origin.originY : pos.y;
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
    const isShooterCam = modeState.mode === "traditional" && Boolean(modeState.shooter?.camera);
    if (modeState.mode !== "souls" && !isShooterCam) {
      this._origin.originX = 0; this._origin.originY = 0; return this._origin;
    }
    const cam = modeState.mode === "souls"
      ? modeState.souls?.camera
      : modeState.shooter.camera;
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
