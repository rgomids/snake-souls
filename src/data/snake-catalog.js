"use strict";

/**
 * SnakeCatalog — catálogo imutável de cobras jogáveis.
 *
 * Princípio SRP: única responsabilidade de descrever as cobras disponíveis.
 * Princípio OCP: adicionar nova cobra = adicionar entrada ao array, sem editar
 *   lógica de consulta.
 */
class SnakeCatalog {
  /**
   * @type {ReadonlyArray<Readonly<SnakeDefinition>>}
   *
   * @typedef {Object} SnakeDefinition
   * @property {string}  id
   * @property {string}  name
   * @property {string}  description
   * @property {string}  color
   * @property {boolean} unlockedByDefault
   * @property {number}  tickMultiplier         - <1 = mais rápida, >1 = mais lenta
   * @property {number}  runeGainMultiplier
   * @property {number}  directionLockTicks
   * @property {number}  extraArmorPerStage
   * @property {number}  extraObjectiveTarget
   * @property {number}  normalArenaPenalty
   * @property {number}  sigilSpawnFactor
   */
  static ALL = Object.freeze([
    Object.freeze({
      id: "basica",
      name: "Básica",
      description: "Equilíbrio entre velocidade e controle. Ponto de partida ideal.",
      color: "#1f7a46",
      unlockedByDefault: true,
      tickMultiplier: 1,
      runeGainMultiplier: 1,
      directionLockTicks: 0,
      extraArmorPerStage: 0,
      extraObjectiveTarget: 0,
      normalArenaPenalty: 0,
      sigilSpawnFactor: 1,
    }),
    Object.freeze({
      id: "veloz",
      name: "Veloz",
      description: "8% de bônus de runas. Cuidado: trava de direção por 1 tick.",
      color: "#2b77d8",
      unlockedByDefault: false,
      tickMultiplier: 0.9,
      runeGainMultiplier: 1.08,
      directionLockTicks: 1,
      extraArmorPerStage: 0,
      extraObjectiveTarget: 0,
      normalArenaPenalty: 0,
      sigilSpawnFactor: 1,
    }),
    Object.freeze({
      id: "tanque",
      name: "Tanque",
      description: "+1 armadura e +1 objetivo por fase. Ritmo mais lento.",
      color: "#b34b3f",
      unlockedByDefault: false,
      tickMultiplier: 1.1,
      runeGainMultiplier: 1,
      directionLockTicks: 0,
      extraArmorPerStage: 1,
      extraObjectiveTarget: 1,
      normalArenaPenalty: 0,
      sigilSpawnFactor: 1,
    }),
    Object.freeze({
      id: "vidente",
      name: "Vidente",
      description: "Sigilos aparecem 20% menos. Arena menor. Penalidade de risco.",
      color: "#7446b8",
      unlockedByDefault: false,
      tickMultiplier: 1.03,
      runeGainMultiplier: 1,
      directionLockTicks: 0,
      extraArmorPerStage: 0,
      extraObjectiveTarget: 0,
      normalArenaPenalty: 1,
      sigilSpawnFactor: 0.8,
    }),
  ]);

  /**
   * Retorna a definição de uma cobra pelo id, ou null se não existir.
   * @param {string} id
   * @returns {Readonly<SnakeDefinition> | null}
   */
  static getById(id) {
    return SnakeCatalog.ALL.find((s) => s.id === id) ?? null;
  }

  /**
   * Retorna a definição de uma cobra pelo id ou a cobra padrão ("basica").
   * @param {string} id
   * @returns {Readonly<SnakeDefinition>}
   */
  static getByIdOrDefault(id) {
    return SnakeCatalog.ALL.find((s) => s.id === id) ?? SnakeCatalog.ALL[0];
  }

  /**
   * Retorna todos os IDs de cobras.
   * @returns {string[]}
   */
  static getAllIds() {
    return SnakeCatalog.ALL.map((s) => s.id);
  }

  /**
   * Verifica se um ID de cobra existe no catálogo.
   * @param {string} id
   * @returns {boolean}
   */
  static exists(id) {
    return SnakeCatalog.ALL.some((s) => s.id === id);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SnakeCatalog;
}
