"use strict";

/**
 * ProfileRepository — acesso exclusivo ao localStorage para o perfil Souls.
 *
 * Princípio SRP: única responsabilidade de serializar/deserializar o perfil.
 * Princípio DIP: ProfileService depende desta abstração, nunca do localStorage
 *   diretamente.
 */

const GameConstants = (typeof require !== "undefined")
  ? require("../data/constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

class ProfileRepository {
  /**
   * @param {Storage} [storage] - injetado para facilitar testes (default: localStorage)
   */
  constructor(storage = null) {
    // Em Node.js (testes), não há localStorage; aceita null graciosamente.
    this._storage = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
    this._key = GameConstants?.STORAGE_KEY ?? "snake-souls-profile-v1";
  }

  /**
   * Carrega o JSON bruto do storage ou null se ausente.
   * @returns {string | null}
   */
  loadRaw() {
    if (!this._storage) return null;
    try {
      return this._storage.getItem(this._key) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Persiste o JSON serializado do perfil.
   * @param {string} serialized
   */
  saveRaw(serialized) {
    if (!this._storage) return;
    try {
      this._storage.setItem(this._key, serialized);
    } catch {
      // quota exceeded ou storage indisponível — ignorar silenciosamente
    }
  }

  /**
   * Remove o perfil do storage (reset total).
   */
  remove() {
    if (!this._storage) return;
    try {
      this._storage.removeItem(this._key);
    } catch {
      // ignorar
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProfileRepository;
}
