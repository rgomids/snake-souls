"use strict";

/**
 * TouchHandler — captura gestos de swipe e botões de toque, emite direção.
 *
 * Princípio SRP: única responsabilidade de traduzir eventos de toque em
 *   direções do domínio do jogo.
 * Princípio DIP: depende de EventEmitter injetado.
 *
 * Eventos emitidos:
 *   "direction" — { direction: string }
 */
class TouchHandler {
  static SWIPE_MIN_DISTANCE = 20; // px

  /**
   * @param {import('../core/event-emitter.js')} emitter
   * @param {{ swipeTarget?: Element, buttonSelector?: string }} [options]
   */
  constructor(emitter, options = {}) {
    this._emitter = emitter;
    this._swipeTarget = options.swipeTarget ?? null;
    this._buttonSelector = options.buttonSelector ?? "[data-direction]";

    this._touchStartX = 0;
    this._touchStartY = 0;
    this._activeTouches = new Map();

    this._swipeBound = null;
    this._swipeEndBound = null;
    this._buttonBound = null;
  }

  /** Registra os ouvintes de toque. */
  attach() {
    if (this._swipeTarget) {
      this._swipeBound   = this._onTouchStart.bind(this);
      this._swipeEndBound = this._onTouchEnd.bind(this);
      this._swipeTarget.addEventListener("touchstart", this._swipeBound,  { passive: true });
      this._swipeTarget.addEventListener("touchend",   this._swipeEndBound, { passive: true });
    }

    if (typeof document !== "undefined") {
      this._buttonBound = this._onButtonTouch.bind(this);
      document.addEventListener("touchstart", this._buttonBound, { passive: true });
    }
  }

  /** Remove os ouvintes de toque. */
  detach() {
    if (this._swipeTarget && this._swipeBound) {
      this._swipeTarget.removeEventListener("touchstart", this._swipeBound);
      this._swipeTarget.removeEventListener("touchend",   this._swipeEndBound);
    }
    if (typeof document !== "undefined" && this._buttonBound) {
      document.removeEventListener("touchstart", this._buttonBound);
    }
  }

  /** @private */
  _onTouchStart(event) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
  }

  /** @private */
  _onTouchEnd(event) {
    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - this._touchStartX;
    const dy = touch.clientY - this._touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < TouchHandler.SWIPE_MIN_DISTANCE) return;

    const dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "RIGHT" : "LEFT")
      : (dy > 0 ? "DOWN"  : "UP");

    this._emitter.emit("direction", { direction: dir });
  }

  /** @private */
  _onButtonTouch(event) {
    const target = event.target?.closest?.(this._buttonSelector);
    if (!target) return;
    const dir = target.dataset?.direction?.toUpperCase();
    if (dir && ["UP", "DOWN", "LEFT", "RIGHT"].includes(dir)) {
      this._emitter.emit("direction", { direction: dir });
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = TouchHandler;
}
