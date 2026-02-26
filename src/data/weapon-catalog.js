"use strict";

/**
 * WeaponCatalog — catálogo imutável de armas do modo Shooter.
 *
 * SRP: fonte única de verdade para definições de armas.
 * OCP: novas armas adicionadas em weapons.json sem alterar esta classe.
 */
const WEAPONS_RAW = require("./weapons.json");

class WeaponCatalog {
  /** @type {ReadonlyArray<Readonly<WeaponDefinition>>}
   * @typedef {{ id: string, name: string, symbol: string, color: string,
   *   disabledColor: string, range: number, cooldownMs: number, damage: number,
   *   projectileSymbol: string, projectileColor: string,
   *   projectileSpeed: number, projectileTtlMs: number }} WeaponDefinition
   */
  static ALL = Object.freeze(WEAPONS_RAW.map(w => Object.freeze({ ...w })));

  /**
   * Retorna a definição de uma arma pelo id ou null.
   * @param {string} id
   * @returns {Readonly<WeaponDefinition> | null}
   */
  static getById(id) {
    return WeaponCatalog.ALL.find(w => w.id === id) ?? null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = WeaponCatalog;
}
