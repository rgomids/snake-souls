"use strict";

/**
 * PowerCatalog — catálogo imutável de poderes do modo Souls.
 *
 * Princípio SRP: única responsabilidade de descrever poderes disponíveis.
 * Princípio OCP: novos poderes adicionados sem alterar lógica de consulta.
 */
class PowerCatalog {
  /**
   * @type {ReadonlyArray<Readonly<PowerDefinition>>}
   *
   * @typedef {Object} PowerDefinition
   * @property {string} id
   * @property {string} name
   * @property {string} description
   * @property {number} maxStacks
   */
  static ALL = Object.freeze([
    Object.freeze({
      id: "folego",
      name: "Fôlego",
      description: "Aumenta velocidade em 5% por stack.",
      maxStacks: 3,
    }),
    Object.freeze({
      id: "muralha",
      name: "Muralha",
      description: "Ganha +1 armadura por fase.",
      maxStacks: 2,
    }),
    Object.freeze({
      id: "ima",
      name: "Ímã",
      description: "Coleta comida e sigilo com distância de 1 célula.",
      maxStacks: 1,
    }),
    Object.freeze({
      id: "voracidade",
      name: "Voracidade",
      description: "Sigilos rendem progresso extra.",
      maxStacks: 2,
    }),
    Object.freeze({
      id: "passo_fantasma",
      name: "Passo Fantasma",
      description: "Ignora 1 colisão a cada 15s.",
      maxStacks: 1,
    }),
    Object.freeze({
      id: "runa_viva",
      name: "Runa Viva",
      description: "Aumenta ganho de runas em 30% por stack.",
      maxStacks: 2,
    }),
    Object.freeze({
      id: "adrenalina",
      name: "Adrenalina",
      description: "Aumenta reserva e recuperação de estamina.",
      maxStacks: 2,
    }),
  ]);

  /**
   * Retorna a definição de um poder pelo id ou null.
   * @param {string} id
   * @returns {Readonly<PowerDefinition> | null}
   */
  static getById(id) {
    return PowerCatalog.ALL.find((p) => p.id === id) ?? null;
  }

  /**
   * Retorna o máximo de stacks permitido para um poder.
   * @param {string} id
   * @returns {number}
   */
  static getMaxStacks(id) {
    const power = PowerCatalog.getById(id);
    return power ? power.maxStacks : 0;
  }

  /**
   * Retorna todos os IDs de poderes.
   * @returns {string[]}
   */
  static getAllIds() {
    return PowerCatalog.ALL.map((p) => p.id);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = PowerCatalog;
}
