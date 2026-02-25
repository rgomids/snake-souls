"use strict";

/**
 * EconomySystem — gerência da economia de runas do modo Souls.
 *
 * Princípio SRP: única responsabilidade de calcular ganhos, transferências
 *   e consultas relacionadas à economia de runas.
 * Princípio OCP: novos multiplicadores ou fontes de runas adicionados como
 *   novos modificadores sem alterar o cálculo central.
 */

const GameConstants = (typeof require !== "undefined")
  ? require("../../../data/constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

class EconomySystem {
  // ── Multiplicadores ───────────────────────────────────────────────────────
  static RUNA_VIVA_BONUS_PER_STACK = 0.3;

  /**
   * Calcula o multiplicador total de runas do jogador.
   * @param {{ powers: Record<string, number> }} souls
   * @param {{ runeGainMultiplier?: number }} [snakeDefinition]
   * @returns {number}
   */
  static getMultiplier(souls, snakeDefinition = null) {
    const snakeMult = snakeDefinition?.runeGainMultiplier ?? 1;
    const runaVivaStacks = souls?.powers?.runa_viva ?? 0;
    return snakeMult * (1 + runaVivaStacks * EconomySystem.RUNA_VIVA_BONUS_PER_STACK);
  }

  /**
   * Aplica ganho de runas, mutando `souls.carriedRunes` in-place.
   * Retorna a quantidade efetivamente ganha.
   *
   * @param {{ carriedRunes: number, powers: Record<string, number> }} souls
   * @param {number} baseAmount
   * @param {{ runeGainMultiplier?: number }} [snakeDefinition]
   * @returns {number}
   */
  static applyGain(souls, baseAmount, snakeDefinition = null) {
    if (baseAmount <= 0) return 0;
    const mult = EconomySystem.getMultiplier(souls, snakeDefinition);
    const amount = Math.max(1, Math.round(baseAmount * mult));
    souls.carriedRunes += amount;
    return amount;
  }

  /**
   * Recompensa de runas para um tipo de evento.
   * @param {string} type - "food" | "sigil" | "bossWin" | "finalBossWin" | "allPowersMaxed"
   * @returns {number}
   */
  static getReward(type) {
    const rewards = GameConstants?.RUNE_REWARDS ?? {
      food: 2, sigil: 6, bossWin: 40, finalBossWin: 120, allPowersMaxed: 60,
    };
    return rewards[type] ?? 0;
  }

  /**
   * Retorna custo de reroll de poder.
   * @returns {number}
   */
  static getRerollCost() {
    return GameConstants?.REROLL_COST ?? 30;
  }

  /**
   * Verifica se o jogador pode pagar o reroll.
   * @param {{ carriedRunes: number }} souls
   * @returns {boolean}
   */
  static canAffordReroll(souls) {
    return (souls?.carriedRunes ?? 0) >= EconomySystem.getRerollCost();
  }

  /**
   * Desconta o custo de reroll de runas carregadas. Retorna novo total.
   * @param {{ carriedRunes: number }} souls
   * @returns {number} - novo valor de carriedRunes
   */
  static spendReroll(souls) {
    const cost = EconomySystem.getRerollCost();
    souls.carriedRunes = Math.max(0, (souls.carriedRunes ?? 0) - cost);
    return souls.carriedRunes;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = EconomySystem;
}
