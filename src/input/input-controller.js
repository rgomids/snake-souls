"use strict";

/**
 * InputController — orquestra KeyboardHandler e TouchHandler.
 *
 * Princípio SRP: única responsabilidade de compor os handlers de input e
 *   fornecer uma interface unificada de attach/detach.
 * Princípio DIP: recebe instâncias dos handlers e do emitter por construtor,
 *   nunca os instancia internamente.
 * Princípio ISP: expõe apenas attach/detach/pressedDirections; cada handler
 *   tem sua interface específica.
 */

class InputController {
  /**
   * @param {import('../core/event-emitter.js')} emitter
   * @param {{
   *   keyboard: import('./keyboard-handler.js'),
   *   touch: import('./touch-handler.js')
   * }} handlers
   */
  constructor(emitter, handlers = {}) {
    this._emitter = emitter;
    this._keyboard = handlers.keyboard ?? null;
    this._touch    = handlers.touch    ?? null;
    this._attached = false;
  }

  /** Ativa todos os handlers de input. */
  attach() {
    if (this._attached) return;
    this._keyboard?.attach();
    this._touch?.attach();
    this._attached = true;
  }

  /** Desativa todos os handlers de input. */
  detach() {
    if (!this._attached) return;
    this._keyboard?.detach();
    this._touch?.detach();
    this._attached = false;
  }

  /**
   * Conjunto de direções atualmente pressionadas via teclado.
   * @returns {ReadonlySet<string>}
   */
  get pressedDirections() {
    return this._keyboard?.pressedDirections ?? new Set();
  }

  /**
   * Registra um listener para um evento de input.
   * @param {string} event
   * @param {Function} listener
   * @returns {() => void}
   */
  on(event, listener) {
    return this._emitter.on(event, listener);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = InputController;
}
