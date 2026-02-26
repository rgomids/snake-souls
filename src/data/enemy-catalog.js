"use strict";

/**
 * EnemyCatalog — catálogo imutável de inimigos do modo Shooter.
 *
 * SRP: fonte única de verdade para definições de inimigos.
 * OCP: novos inimigos adicionados em enemies.json sem alterar esta classe.
 */
const ENEMIES_RAW = require("./enemies.json");

class EnemyCatalog {
  /** @type {ReadonlyArray<Readonly<EnemyDefinition>>}
   * @typedef {{ id: string, name: string, symbol: string, shape: string,
   *   color: string, hp: number, speed: number, scoreValue: number,
   *   collisionDamage: number, spawnSound?: string }} EnemyDefinition
   */
  static ALL = Object.freeze(ENEMIES_RAW.map(e => Object.freeze({ ...e })));

  /**
   * Retorna a definição de um inimigo pelo id ou null.
   * @param {string} id
   * @returns {Readonly<EnemyDefinition> | null}
   */
  static getById(id) {
    return EnemyCatalog.ALL.find(e => e.id === id) ?? null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = EnemyCatalog;
}
