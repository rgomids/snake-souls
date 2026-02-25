"use strict";

/**
 * StageCalculator — fórmulas de progressão de fase do modo Souls.
 *
 * Princípio SRP: única responsabilidade de calcular mapeamento floor→fase.
 * Princípio OCP: por ser apenas fórmulas puras, é aberto para uso em
 *   qualquer contexto sem modificação.
 */

const GameConstants = (typeof require !== "undefined")
  ? require("./constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

const SnakeCatalog = (typeof require !== "undefined")
  ? require("./snake-catalog.js")
  : (typeof globalThis !== "undefined" ? globalThis.SnakeCatalog : null);

const MathUtils = (typeof require !== "undefined")
  ? require("../core/utils.js")
  : (typeof globalThis !== "undefined" ? globalThis.MathUtils : null);

class StageCalculator {
  /**
   * Número do ciclo a partir do floor (ciclos de 12 andares).
   * @param {number} floor
   * @returns {number}
   */
  static getCycle(floor) {
    return Math.floor((floor - 1) / 12) + 1;
  }

  /**
   * Posição dentro do ciclo atual (1–12).
   * @param {number} floor
   * @returns {number}
   */
  static getWithinCycle(floor) {
    return ((floor - 1) % 12) + 1;
  }

  /**
   * Tipo de fase: "normal" | "boss" | "final_boss".
   * @param {number} floor
   * @returns {"normal"|"boss"|"final_boss"}
   */
  static getStageType(floor) {
    const w = StageCalculator.getWithinCycle(floor);
    if (w === 12) return "final_boss";
    if (w === 3 || w === 6 || w === 9) return "boss";
    return "normal";
  }

  /**
   * Ordinal do boss neste andar (1, 2 ou 3) ou null se não for andar de boss.
   * @param {number} floor
   * @returns {1|2|3|null}
   */
  static getBossOrdinal(floor) {
    const w = StageCalculator.getWithinCycle(floor);
    if (w === 3) return 1;
    if (w === 6) return 2;
    if (w === 9) return 3;
    return null;
  }

  /**
   * Escala de dificuldade multiplicativa por ciclo.
   * @param {number} cycle
   * @returns {number}
   */
  static getDifficultyScale(cycle) {
    return Math.pow(1.18, cycle - 1);
  }

  /**
   * Objetivo (quantidade de coletas) para este andar.
   * @param {number} floor
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @param {import('./snake-catalog.js')|null} snakeDefinition
   * @returns {number}
   */
  static getObjectiveTarget(floor, stageType, snakeDefinition = null) {
    const cycle = StageCalculator.getCycle(floor);
    const extra = snakeDefinition?.extraObjectiveTarget ?? 0;

    if (stageType === "normal") {
      return 4 + Math.floor((floor - 1) / 3) + extra;
    }
    if (stageType === "boss") {
      const bossOrdinal = StageCalculator.getBossOrdinal(floor) ?? 1;
      return 6 + cycle * 2 + bossOrdinal + extra;
    }
    return 12 + cycle * 3 + extra;
  }

  /**
   * Tick base em ms para o tipo de fase.
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @returns {number}
   */
  static getBaseTickMs(stageType) {
    const map = GameConstants
      ? GameConstants.TICK_BASE
      : { normal: 140, boss: 128, final_boss: 118 };
    return map[stageType] ?? map.normal;
  }

  /**
   * Range de tamanho de arena para o tipo de fase.
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @returns {{ min: number, max: number }}
   */
  static getArenaRange(stageType) {
    const ranges = GameConstants
      ? GameConstants.ARENA_RANGES
      : { normal: { min: 18, max: 22 }, boss: { min: 22, max: 24 }, final_boss: { min: 24, max: 26 } };
    return ranges[stageType] ?? ranges.normal;
  }

  /**
   * Tamanho aleatório da arena para o andar.
   * @param {number} floor
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @param {object|null} snakeDefinition
   * @param {() => number} rng
   * @returns {{ width: number, height: number }}
   */
  static getArenaSize(floor, stageType, snakeDefinition = null, rng = Math.random) {
    if (floor <= 2) return { width: 20, height: 20 };

    const range = StageCalculator.getArenaRange(stageType);
    const randInt = MathUtils
      ? MathUtils.randomIntInclusive.bind(MathUtils)
      : (min, max, r) => Math.floor(r() * (max - min + 1)) + min;

    let width  = randInt(range.min, range.max, rng);
    let height = randInt(range.min, range.max, rng);

    if (stageType === "normal") {
      const penalty = snakeDefinition?.normalArenaPenalty ?? 0;
      width  = Math.max(range.min, width  - penalty);
      height = Math.max(range.min, height - penalty);
    }

    return { width, height };
  }

  /**
   * Recompensa em runas para o tipo de evento.
   * @param {string} type - chave de RUNE_REWARDS
   * @returns {number}
   */
  static getRuneReward(type) {
    const rewards = GameConstants ? GameConstants.RUNE_REWARDS : {};
    return rewards[type] ?? 0;
  }

  /**
   * Custo de desbloqueio por índice na ordem de unlock.
   * @param {number} index
   * @returns {number | null}
   */
  static getUnlockCostByIndex(index) {
    const costs = GameConstants ? GameConstants.UNLOCK_COSTS : [120, 220, 360];
    return costs[index] ?? null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = StageCalculator;
}
