"use strict";

/**
 * ModeFactory — cria instâncias de IGameMode pelo identificador de modo.
 *
 * OCP: novos modos são registrados via `ModeFactory.register()` sem modificar
 * este arquivo.
 * DIP: os criadores de modo são injetados — não há `require()` explícito de
 * implementações dentro desta classe.
 */
class ModeFactory {
  constructor() {
    /** @type {Map<string, (options: object) => IGameMode>} */
    this._builders = new Map();
  }

  /**
   * Registra um builder para um modo.
   * @param {string}   modeId
   * @param {Function} builderFn  (options: object) → IGameMode
   */
  register(modeId, builderFn) {
    if (typeof modeId !== "string" || !modeId) {
      throw new TypeError("ModeFactory.register: modeId deve ser uma string não vazia.");
    }
    if (typeof builderFn !== "function") {
      throw new TypeError("ModeFactory.register: builderFn deve ser uma function.");
    }
    this._builders.set(modeId, builderFn);
    return this; // fluent
  }

  /**
   * Cria uma instância de IGameMode para o modo solicitado.
   * @param {string} modeId
   * @param {object} [options]
   * @returns {IGameMode}
   * @throws {Error} se modeId não tiver sido registrado
   */
  create(modeId, options = {}) {
    const builder = this._builders.get(modeId);
    if (!builder) {
      const known = [...this._builders.keys()].join(", ") || "(nenhum)";
      throw new Error(
        `ModeFactory: modo "${modeId}" não reconhecido. Modos registrados: ${known}`
      );
    }
    return builder(options);
  }

  /**
   * Verifica se um modo está registrado.
   * @param {string} modeId
   * @returns {boolean}
   */
  has(modeId) {
    return this._builders.has(modeId);
  }

  /**
   * Retorna os ids de todos modos registrados.
   * @returns {string[]}
   */
  registeredModes() {
    return [...this._builders.keys()];
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ModeFactory;
}
