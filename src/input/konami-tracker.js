"use strict";

/**
 * KonamiTracker — rastreador de sequências de teclas (Konami Code e similares).
 *
 * Princípio SRP: única responsabilidade de avançar uma máquina de estado
 *   de sequência de teclas.
 * Extrai e encapsula a lógica de easter-eggs.js.
 */
class KonamiTracker {
  /** @type {ReadonlyArray<string>} */
  static DEFAULT_SEQUENCE = Object.freeze([
    "UP", "UP", "DOWN", "DOWN", "LEFT", "RIGHT", "LEFT", "RIGHT", "B", "A",
  ]);

  /**
   * @param {ReadonlyArray<string>} [sequence] - sequência customizada
   */
  constructor(sequence = null) {
    this._sequence = Array.isArray(sequence)
      ? Object.freeze(sequence.slice())
      : KonamiTracker.DEFAULT_SEQUENCE;
    this._progress = 0;
  }

  /**
   * Normaliza uma entrada de teclado para o token do vocabulário da sequência.
   * @param {string} input
   * @returns {string | null}
   */
  static normalizeKey(input) {
    if (typeof input !== "string" || input.length === 0) return null;

    const key   = input.length === 1 ? input.toUpperCase() : input;
    const upper = key.toUpperCase();

    if (upper === "UP" || upper === "DOWN" || upper === "LEFT" || upper === "RIGHT") {
      return upper;
    }
    if (key === "ArrowUp")    return "UP";
    if (key === "ArrowDown")  return "DOWN";
    if (key === "ArrowLeft")  return "LEFT";
    if (key === "ArrowRight") return "RIGHT";
    if (key === "B") return "B";
    if (key === "A") return "A";

    return null;
  }

  /**
   * Processa uma tecla: retorna true se a sequência foi completada.
   * @param {string} input - valor de KeyboardEvent.key
   * @returns {boolean}
   */
  consumeKey(input) {
    const token = KonamiTracker.normalizeKey(input);
    if (!token) return false;

    const expected = this._sequence[this._progress];
    if (token === expected) {
      this._progress += 1;
      if (this._progress >= this._sequence.length) {
        this._progress = 0;
        return true;
      }
      return false;
    }

    // Reinicia ou avança se o token bate com o início da sequência
    this._progress = token === this._sequence[0] ? 1 : 0;
    return false;
  }

  /**
   * Reseta o progresso da sequência.
   */
  reset() {
    this._progress = 0;
  }

  /** @returns {number} */
  get progress() { return this._progress; }

  /** @returns {number} */
  get sequenceLength() { return this._sequence.length; }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = KonamiTracker;
}
