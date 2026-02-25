"use strict";

/**
 * MathUtils — utilitários matemáticos e de posição sem dependências.
 *
 * Princípio SRP: responsabilidade única de prover funções utilitárias puras.
 * Todos os métodos são estáticos (sem estado de instância).
 */
class MathUtils {
  /**
   * Limita `value` ao intervalo [min, max].
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  static clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Número inteiro aleatório no intervalo [min, max] inclusivo.
   * @param {number} min
   * @param {number} max
   * @param {() => number} rng - função RNG que retorna [0,1)
   * @returns {number}
   */
  static randomIntInclusive(min, max, rng = Math.random) {
    if (max <= min) return min;
    const value = Math.floor(rng() * (max - min + 1)) + min;
    return MathUtils.clamp(value, min, max);
  }

  /**
   * Distância Manhattan entre dois pontos {x, y}.
   * @param {{ x: number, y: number }} a
   * @param {{ x: number, y: number }} b
   * @returns {number}
   */
  static manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Chave string canônica de uma posição: "x,y".
   * @param {{ x: number, y: number }} position
   * @returns {string}
   */
  static keyForPosition(position) {
    return `${position.x},${position.y}`;
  }

  /**
   * Divisão inteira com floor (suporte a negativos).
   * @param {number} value
   * @param {number} divisor
   * @returns {number}
   */
  static floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  }

  /**
   * Verifica se dois objetos {x,y} apontam para a mesma célula.
   * @param {{ x: number, y: number }} a
   * @param {{ x: number, y: number }} b
   * @returns {boolean}
   */
  static positionsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = MathUtils;
}
