"use strict";

/**
 * Direction — enumeração e lógica de direção cardinal + diagonal.
 *
 * Princípio SRP: única responsabilidade de descrever o domínio de direções.
 * Princípio OCP: novas direções não exigem alterar lógica de isOpposite/isValid.
 */
class Direction {
  /**
   * Vetores de movimento por nome de direção.
   * @type {Readonly<Record<string, Readonly<{x: number, y: number}>>>}
   */
  static VECTORS = Object.freeze({
    UP:         Object.freeze({ x:  0, y: -1 }),
    DOWN:       Object.freeze({ x:  0, y:  1 }),
    LEFT:       Object.freeze({ x: -1, y:  0 }),
    RIGHT:      Object.freeze({ x:  1, y:  0 }),
    UP_LEFT:    Object.freeze({ x: -1, y: -1 }),
    UP_RIGHT:   Object.freeze({ x:  1, y: -1 }),
    DOWN_LEFT:  Object.freeze({ x: -1, y:  1 }),
    DOWN_RIGHT: Object.freeze({ x:  1, y:  1 }),
  });

  /**
   * Retorna o vetor de uma direção ou null se inválida.
   * @param {string} direction
   * @returns {{ x: number, y: number } | null}
   */
  static vectorOf(direction) {
    return Direction.VECTORS[direction] ?? null;
  }

  /**
   * Verifica se a string corresponde a uma direção conhecida.
   * @param {string} direction
   * @returns {boolean}
   */
  static isValid(direction) {
    return Object.prototype.hasOwnProperty.call(Direction.VECTORS, direction);
  }

  /**
   * Retorna true se `next` é oposta a `current` (produto escalar < 0).
   * @param {string} current
   * @param {string} next
   * @returns {boolean}
   */
  static isOpposite(current, next) {
    const v1 = Direction.VECTORS[current];
    const v2 = Direction.VECTORS[next];
    if (!v1 || !v2) return false;
    return v1.x * v2.x + v1.y * v2.y < 0;
  }

  /**
   * Mapeia teclas de teclado para direções cardinais.
   * Aceita ArrowKeys e WASD.
   * @param {string} key - valor de `KeyboardEvent.key`
   * @returns {string | null}
   */
  static fromKey(key) {
    const normalized = key.toLowerCase();
    if (normalized === "arrowup"    || normalized === "w") return "UP";
    if (normalized === "arrowdown"  || normalized === "s") return "DOWN";
    if (normalized === "arrowleft"  || normalized === "a") return "LEFT";
    if (normalized === "arrowright" || normalized === "d") return "RIGHT";
    return null;
  }

  /**
   * Retorna a direção oposta à informada (apenas cardinais).
   * @param {string} direction
   * @returns {string | null}
   */
  static opposite(direction) {
    const map = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
    return map[direction] ?? null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = Direction;
}
