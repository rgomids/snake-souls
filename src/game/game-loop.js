"use strict";

/**
 * GameLoop — gerencia o ciclo de jogo com suporte a dois modos:
 *
 *  - **tick** (setInterval): para modos Traditional e Levels, onde cada
 *    chamada de step avança exatamente um tick de lógica.
 *  - **raf** (requestAnimationFrame + fixed-step accumulator): para Souls,
 *    garantindo fidelidade física independente do FPS do display.
 *
 * SRP: única responsabilidade de agendar chamadas de step e render.
 * DIP: recebe stepFn, renderFn e calculateFixedStepsFn via construtor.
 * OCP: modelo extendível via `setMode("tick"|"raf")` sem alteração desta classe.
 */
class GameLoop {
  /**
   * @param {object}   deps
   * @param {Function} deps.stepFn             (fixedStepMs: number) → void
   * @param {Function} deps.renderFn           (interpolation: { alpha }) → void
   * @param {Function} deps.calculateFixedSteps  ({accumulatorMs, deltaMs, fixedStepMs, maxStepsPerFrame, dropOverflow}) → { steps, accumulatorAfterMs }
   * @param {Function} deps.shouldRunRaf       () → boolean        — retorna false para pausar o RAF
   * @param {number}  [deps.fixedStepMs=1000/90]
   * @param {number}  [deps.maxStepsPerFrame=4]
   * @param {number}  [deps.maxFrameDeltaMs=120]
   */
  constructor(deps) {
    if (typeof deps?.stepFn !== "function")   throw new Error("GameLoop: deps.stepFn é obrigatório.");
    if (typeof deps?.renderFn !== "function") throw new Error("GameLoop: deps.renderFn é obrigatório.");

    this._step          = deps.stepFn;
    this._render        = deps.renderFn;
    this._calcFixed     = deps.calculateFixedSteps ?? GameLoop._defaultCalcFixed;
    this._shouldRunRaf  = deps.shouldRunRaf ?? (() => false);

    this._fixedStepMs   = deps.fixedStepMs     ?? (1000 / 90);
    this._maxSteps      = deps.maxStepsPerFrame ?? 4;
    this._maxDeltaMs    = deps.maxFrameDeltaMs  ?? 120;

    // State
    this._mode          = null;    // "tick" | "raf" | null
    this._tickId        = null;
    this._rafId         = null;
    this._lastTs        = null;
    this._accumMs       = 0;
    this._interpolAlpha = 0;
    this._currentTickMs = null;
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Inicia loop RAF com acumulador de tick (Traditional / Levels).
   * A lógica avança apenas quando o acumulador atinge tickMs,
   * mas o render ocorre todo frame — sincronizando com VSYNC.
   * @param {number} tickMs
   */
  startTick(tickMs) {
    this.stop();
    this._currentTickMs = tickMs;
    this._mode = "tick";
    this._resetRafTiming();
    this._rafId = window.requestAnimationFrame(ts => this._tickRafLoop(ts));
  }

  /**
   * Inicia loop RAF com fixed-step accumulator (Souls).
   */
  startRaf() {
    if (this._mode === "raf" && this._rafId !== null) return;  // já rodando
    this.stop();
    this._mode = "raf";
    this._resetRafTiming();
    this._rafId = window.requestAnimationFrame(ts => this._rafLoop(ts));
  }

  /**
   * Para todos os loops.
   */
  stop() {
    if (this._tickId !== null) {
      window.clearInterval(this._tickId);
      this._tickId = null;
    }
    if (this._rafId !== null) {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._currentTickMs = null;
    this._resetRafTiming();
    this._mode = null;
  }

  /**
   * Atualiza o tickMs do loop de tick em tempo real.
   * Como o loop já é RAF-based, basta atualizar o valor —
   * o próximo frame pegará o novo intervalo sem reiniciar o loop.
   * @param {number} tickMs
   */
  setTickMs(tickMs) {
    if (this._mode === "tick") {
      this._currentTickMs = tickMs;
    }
  }

  /** Reinicia o timing do RAF (usar ao retomar após pausa). */
  resetRafTiming() { this._resetRafTiming(); }

  /** @returns {number} Interpolation alpha (0-1) para RAF. */
  get interpolationAlpha() { return this._interpolAlpha; }

  /** @returns {"tick"|"raf"|null} */
  get mode() { return this._mode; }

  /** @returns {boolean} */
  get isRunning() { return this._tickId !== null || this._rafId !== null; }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Loop RAF para Traditional / Levels.
   * Avança a lógica a cada `_currentTickMs` acumulados e renderiza todo frame.
   */
  _tickRafLoop(timestamp) {
    if (this._mode !== "tick") return;  // parado enquanto estava na fila

    if (this._lastTs === null) this._lastTs = timestamp;
    const delta = Math.min(this._maxDeltaMs, Math.max(0, timestamp - this._lastTs));
    this._lastTs = timestamp;

    this._accumMs += delta;
    while (this._accumMs >= this._currentTickMs) {
      this._accumMs -= this._currentTickMs;
      this._step(this._currentTickMs);
    }

    const alpha = this._currentTickMs > 0 ? this._accumMs / this._currentTickMs : 0;
    this._render({ alpha, deltaMs: delta });
    if (this._mode === "tick") {
      this._rafId = window.requestAnimationFrame(ts => this._tickRafLoop(ts));
    }
  }

  _rafLoop(timestamp) {
    if (this._lastTs === null) this._lastTs = timestamp;

    const frameDelta = Math.min(this._maxDeltaMs, Math.max(0, timestamp - this._lastTs));
    this._lastTs = timestamp;

    const schedule = this._calcFixed({
      accumulatorMs:       this._accumMs,
      deltaMs:             frameDelta,
      fixedStepMs:         this._fixedStepMs,
      maxStepsPerFrame:    this._maxSteps,
      dropOverflow:        true,
    });

    this._accumMs       = schedule.accumulatorAfterMs;
    this._interpolAlpha = Math.max(0, Math.min(1, this._accumMs / this._fixedStepMs));

    for (let i = 0; i < schedule.steps; i += 1) {
      this._step(this._fixedStepMs);
    }

    this._render({ alpha: this._interpolAlpha, deltaMs: frameDelta });

    if (this._shouldRunRaf()) {
      this._rafId = window.requestAnimationFrame(ts => this._rafLoop(ts));
    } else {
      this._rafId = null;
    }
  }

  _stopTick() {
    if (this._tickId !== null) {
      window.clearInterval(this._tickId);
      this._tickId = null;
    }
  }

  _stopRaf() {
    if (this._rafId !== null) {
      window.cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._resetRafTiming();
  }

  _resetRafTiming() {
    this._lastTs        = null;
    this._accumMs       = 0;
    this._interpolAlpha = 0;
  }

  // ── Default calculateFixedSteps fallback ─────────────────────────────────────

  static _defaultCalcFixed({ accumulatorMs, deltaMs, fixedStepMs, maxStepsPerFrame }) {
    let acc   = accumulatorMs + deltaMs;
    let steps = 0;
    while (acc >= fixedStepMs && steps < maxStepsPerFrame) {
      acc   -= fixedStepMs;
      steps += 1;
    }
    return { steps, accumulatorAfterMs: acc };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = GameLoop;
}
