"use strict";

/**
 * EventEmitter — barramento de eventos pub/sub sem dependências.
 *
 * Princípio DIP: módulos dependem desta abstração para comunicação,
 * nunca uns dos outros diretamente.
 * Princípio OCP: novos eventos podem ser emitidos sem alterar este módulo.
 */
class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Registra um listener para um evento.
   * @param {string} event
   * @param {Function} listener
   * @returns {() => void} função de unsubscribe
   */
  on(event, listener) {
    if (typeof event !== "string" || typeof listener !== "function") {
      throw new TypeError("EventEmitter.on: event deve ser string e listener deve ser function.");
    }

    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }

    this._listeners.get(event).add(listener);

    return () => this.off(event, listener);
  }

  /**
   * Registra um listener que será chamado apenas uma vez.
   * @param {string} event
   * @param {Function} listener
   * @returns {() => void} função de unsubscribe
   */
  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Remove um listener específico.
   * @param {string} event
   * @param {Function} listener
   */
  off(event, listener) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      handlers.delete(listener);
      if (handlers.size === 0) {
        this._listeners.delete(event);
      }
    }
  }

  /**
   * Emite um evento, chamando todos os listeners registrados.
   * @param {string} event
   * @param {...*} args
   */
  emit(event, ...args) {
    const handlers = this._listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`EventEmitter: erro no listener de "${event}":`, err);
      }
    }
  }

  /**
   * Remove todos os listeners de um evento (ou de todos os eventos).
   * @param {string} [event]
   */
  removeAllListeners(event) {
    if (event !== undefined) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Retorna lista de nomes de eventos com listeners ativos.
   * @returns {string[]}
   */
  listenerNames() {
    return Array.from(this._listeners.keys());
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = EventEmitter;
}
