"use strict";

/**
 * HazardSystem — gerência de hazards (perigos de área) dos bosses no modo Souls.
 *
 * Princípio SRP: única responsabilidade de criar, avançar e verificar hazards.
 * Princípio OCP: novos padrões de hazard adicionados como novos métodos de geração,
 *   sem alterar o ciclo de normalização/TTL.
 */
class HazardSystem {
  static TTL_MS = 500;

  /**
   * Avança os TTLs dos hazards, removendo os expirados.
   * @param {Array<{ x: number, y: number, ttlMs: number }>} hazards
   * @param {number} deltaMs
   * @returns {Array<{ x: number, y: number, ttlMs: number }>}
   */
  static normalize(hazards, deltaMs) {
    return hazards
      .map((h) => ({ ...h, ttlMs: (h.ttlMs ?? HazardSystem.TTL_MS) - deltaMs }))
      .filter((h) => h.ttlMs > 0)
      .map((h) => ({ x: h.x, y: h.y, ttlMs: h.ttlMs }));
  }

  /**
   * Adiciona um pulso de hazards ao redor das células do inimigo.
   * @param {object | null} enemy
   * @param {Array<{ x: number, y: number, ttlMs: number }>} hazards
   * @returns {Array<{ x: number, y: number, ttlMs: number }>}
   */
  static addPulse(enemy, hazards) {
    if (!enemy) return hazards;

    const enemyCells = HazardSystem._getEnemyCells(enemy);
    const candidates = [];

    for (const cell of enemyCells) {
      candidates.push({ x: cell.x - 1, y: cell.y });
      candidates.push({ x: cell.x + 1, y: cell.y });
      candidates.push({ x: cell.x,     y: cell.y - 1 });
      candidates.push({ x: cell.x,     y: cell.y + 1 });
    }

    const next = [...hazards];
    for (const candidate of candidates) {
      const already = next.some((h) => h.x === candidate.x && h.y === candidate.y);
      if (!already) {
        next.push({ x: candidate.x, y: candidate.y, ttlMs: HazardSystem.TTL_MS });
      }
    }

    return next;
  }

  /**
   * Verifica se uma posição está em um hazard ativo.
   * @param {{ x: number, y: number }} position
   * @param {Array<{ x: number, y: number }>} hazards
   * @returns {boolean}
   */
  static isHit(position, hazards) {
    return hazards.some((h) => h.x === position.x && h.y === position.y);
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  static _getEnemyCells(enemy) {
    const width  = Math.max(1, enemy.width  ?? enemy.size ?? 1);
    const height = Math.max(1, enemy.height ?? enemy.size ?? 1);
    const cells = [];
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        cells.push({ x: enemy.x + dx, y: enemy.y + dy });
      }
    }
    return cells;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = HazardSystem;
}
