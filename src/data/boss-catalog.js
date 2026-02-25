"use strict";

/**
 * BossCatalog — catálogo imutável de bosses e suas inteligências.
 *
 * Princípio SRP: única responsabilidade de descrever bosses e metadados.
 * Princípio OCP: novos bosses adicionados como novas entradas, sem editar
 *   lógica de lookups.
 */
class BossCatalog {
  /**
   * Definições mecânicas dos bosses indexadas por ordinal ou "final".
   * @type {Readonly<Record<string|number, Readonly<BossDefinition>>>}
   *
   * @typedef {Object} BossDefinition
   * @property {string}  id
   * @property {string}  name
   * @property {number}  moveEveryTicks
   * @property {number}  hazardEveryTicks
   * @property {number}  teleportEveryTicks
   * @property {string}  style
   * @property {number}  width
   * @property {number}  height
   * @property {number}  speedPenaltyTicks
   */
  static DEFINITIONS = Object.freeze({
    1: Object.freeze({
      id: "cacador",
      name: "Caçador",
      moveEveryTicks: 1,
      hazardEveryTicks: 0,
      teleportEveryTicks: 0,
      style: "aggressive",
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 0,
    }),
    2: Object.freeze({
      id: "carcereiro",
      name: "Carcereiro",
      moveEveryTicks: 1,
      hazardEveryTicks: 6,
      teleportEveryTicks: 0,
      style: "patrol",
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 0,
    }),
    3: Object.freeze({
      id: "espectro",
      name: "Espectro",
      moveEveryTicks: 1,
      hazardEveryTicks: 0,
      teleportEveryTicks: 8,
      style: "phase",
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    }),
    final: Object.freeze({
      id: "abissal",
      name: "Abissal",
      moveEveryTicks: 1,
      hazardEveryTicks: 5,
      teleportEveryTicks: 9,
      style: "mixed",
      width: 3,
      height: 2,
      speedPenaltyTicks: 0,
    }),
  });

  /**
   * Intel narrativo dos bosses (mecânica + recompensa).
   * @type {Readonly<Record<string, Readonly<BossIntel>>>}
   *
   * @typedef {Object} BossIntel
   * @property {string} id
   * @property {string} name
   * @property {string} mechanic
   * @property {string} size
   * @property {string} reward
   */
  static INTEL = Object.freeze({
    cacador: Object.freeze({
      id: "cacador",
      name: "Caçador",
      mechanic: "Persegue agressivamente, faz investida curta e entra em cansaço antes de recarregar.",
      size: "2x2",
      reward: "Boss comum: +40 runas e escolha de poder.",
    }),
    carcereiro: Object.freeze({
      id: "carcereiro",
      name: "Carcereiro",
      mechanic: "Persegue continuamente e pressiona rota com pulsos de hazard.",
      size: "2x2",
      reward: "Boss comum: +40 runas e escolha de poder.",
    }),
    espectro: Object.freeze({
      id: "espectro",
      name: "Espectro",
      mechanic: "Fase móvel com teleporte periódico para pressionar rota.",
      size: "2x2",
      reward: "Boss comum: +40 runas e escolha de poder.",
    }),
    abissal: Object.freeze({
      id: "abissal",
      name: "Abissal",
      mechanic: "Perseguição implacável com pressão combinada de hazards e teleporte.",
      size: "3x2",
      reward: "Boss final: +120 runas, escolha de poder e progresso de desbloqueio.",
    }),
  });

  /**
   * Retorna a definição do boss por ordinal (1, 2, 3) ou "final".
   * @param {number|"final"} ordinal
   * @returns {Readonly<BossDefinition> | null}
   */
  static getByOrdinal(ordinal) {
    return BossCatalog.DEFINITIONS[ordinal] ?? null;
  }

  /**
   * Retorna o intel de um boss pelo id.
   * @param {string} bossId
   * @returns {Readonly<BossIntel> | null}
   */
  static getIntel(bossId) {
    return BossCatalog.INTEL[bossId] ?? null;
  }

  /**
   * Retorna todos os IDs de bosses conhecidos.
   * @returns {string[]}
   */
  static getAllIds() {
    return Object.values(BossCatalog.DEFINITIONS).map((b) => b.id);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = BossCatalog;
}
