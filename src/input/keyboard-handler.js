"use strict";

/**
 * KeyboardHandler — captura eventos de teclado e emite via EventEmitter.
 *
 * Princípio SRP: única responsabilidade de traduzir eventos DOM de teclado
 *   para eventos do domínio do jogo.
 * Princípio DIP: depende de EventEmitter injetado, nunca de document diretamente
 *   em testes.
 *
 * Eventos emitidos:
 *   "direction"  — { direction: string }
 *   "pause"      — {}
 *   "devToggle"  — {}
 *   "konamiDone" — {}
 */

const Direction = (typeof require !== "undefined")
  ? require("../core/direction.js")
  : (typeof globalThis !== "undefined" ? globalThis.Direction : null);

const KonamiTracker = (typeof require !== "undefined")
  ? require("./konami-tracker.js")
  : (typeof globalThis !== "undefined" ? globalThis.KonamiTracker : null);

class KeyboardHandler {
  /**
   * @param {import('../core/event-emitter.js')} emitter
   * @param {{ target?: EventTarget }} [options]
   */
  constructor(emitter, options = {}) {
    this._emitter = emitter;
    this._target = options.target ?? (typeof document !== "undefined" ? document : null);
    this._konami = KonamiTracker ? new KonamiTracker() : null;
    this._pressedDirections = new Set();
    this._bound = null;
    this._boundUp = null;
  }

  /** Registra os ouvintes no DOM. */
  attach() {
    if (!this._target) return;
    this._bound = this._onKeyDown.bind(this);
    this._boundUp = this._onKeyUp.bind(this);
    this._target.addEventListener("keydown", this._bound);
    this._target.addEventListener("keyup", this._boundUp);
  }

  /** Remove os ouvintes do DOM. */
  detach() {
    if (!this._target || !this._bound) return;
    this._target.removeEventListener("keydown", this._bound);
    this._target.removeEventListener("keyup", this._boundUp);
    this._bound = null;
    this._boundUp = null;
  }

  /** @private */
  _onKeyDown(event) {
    const key = event.key;

    // Konami tracker
    if (this._konami && this._konami.consumeKey(key)) {
      this._emitter.emit("konamiDone");
    }

    // Pausa
    if (key === "Escape" || key === "p" || key === "P") {
      this._emitter.emit("pause");
      return;
    }

    // Dev panel toggle
    if (key === "`" || key === "~") {
      this._emitter.emit("devToggle");
      return;
    }

    // Direção
    const dir = Direction ? Direction.fromKey(key) : null;
    if (dir) {
      event.preventDefault?.();
      this._pressedDirections.add(dir);
      this._emitter.emit("direction", { direction: dir });
    }
  }

  /** @private */
  _onKeyUp(event) {
    const dir = Direction ? Direction.fromKey(event.key) : null;
    if (dir) {
      this._pressedDirections.delete(dir);
    }
  }

  /**
   * Retorna o conjunto de direções atualmente pressionadas.
   * @returns {ReadonlySet<string>}
   */
  get pressedDirections() {
    return this._pressedDirections;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = KeyboardHandler;
}
