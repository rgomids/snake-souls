"use strict";

/**
 * ProfileValidator — sanitização e validação do perfil persistido.
 *
 * Princípio SRP: única responsabilidade de garantir integridade dos dados
 *   carregados, sem conhecer persistência ou lógica de negócio.
 */

const SnakeCatalog = (typeof require !== "undefined")
  ? require("../data/snake-catalog.js")
  : (typeof globalThis !== "undefined" ? globalThis.SnakeCatalog : null);

const GameConstants = (typeof require !== "undefined")
  ? require("../data/constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

/** @type {string[]} */
const KNOWN_BOSS_IDS = ["cacador", "carcereiro", "espectro", "abissal"];

const PROFILE_VERSION = 1;

class ProfileValidator {
  /** @returns {number} */
  static get VERSION() { return PROFILE_VERSION; }

  /**
   * Cria um perfil no estado padrão (zerado).
   * @returns {object}
   */
  static createDefault() {
    const defaultId = GameConstants?.DEFAULT_SNAKE_ID ?? "basica";
    return {
      version: PROFILE_VERSION,
      walletRunes: 0,
      unlockedSnakeIds: [defaultId],
      selectedSnakeId: defaultId,
      finalBossClears: 0,
      eligibleUnlocks: 0,
      pendingEcho: null,
      bossKills: ProfileValidator._emptyBossKills(),
    };
  }

  /**
   * Garante que um objeto de perfil arbitrário é seguro para uso.
   * Todos os campos são normalizados para valores válidos.
   * @param {unknown} input
   * @returns {object}
   */
  static sanitize(input) {
    const raw = input && typeof input === "object" ? input : {};
    const defaults = ProfileValidator.createDefault();
    const defaultId = GameConstants?.DEFAULT_SNAKE_ID ?? "basica";

    const unlockedSnakeIds = ProfileValidator._normalizeUnlocked(
      Array.isArray(raw.unlockedSnakeIds) ? raw.unlockedSnakeIds : []
    );

    const selectedSnakeId =
      typeof raw.selectedSnakeId === "string" &&
      unlockedSnakeIds.includes(raw.selectedSnakeId)
        ? raw.selectedSnakeId
        : defaultId;

    return {
      version: PROFILE_VERSION,
      walletRunes:     Math.max(0, Math.floor(ProfileValidator._safeNum(raw.walletRunes))),
      unlockedSnakeIds,
      selectedSnakeId,
      finalBossClears: Math.max(0, Math.floor(ProfileValidator._safeNum(raw.finalBossClears))),
      eligibleUnlocks: Math.max(0, Math.floor(ProfileValidator._safeNum(raw.eligibleUnlocks))),
      pendingEcho:     ProfileValidator._normalizePendingEcho(raw.pendingEcho),
      bossKills:       ProfileValidator._normalizeBossKills(raw.bossKills),
    };
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  static _safeNum(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  static _emptyBossKills() {
    return Object.fromEntries(KNOWN_BOSS_IDS.map((id) => [id, 0]));
  }

  static _normalizeUnlocked(ids) {
    const knownIds = SnakeCatalog
      ? new Set(SnakeCatalog.getAllIds())
      : new Set(["basica", "veloz", "tanque", "vidente"]);
    const defaultId = GameConstants?.DEFAULT_SNAKE_ID ?? "basica";

    const result = [];
    for (const id of ids) {
      if (typeof id !== "string") continue;
      if (!knownIds.has(id)) continue;
      if (result.includes(id)) continue;
      result.push(id);
    }

    if (!result.includes(defaultId)) {
      result.unshift(defaultId);
    }

    return result;
  }

  static _normalizePendingEcho(raw) {
    if (!raw || typeof raw !== "object") return null;
    const runes = Math.max(0, Math.floor(ProfileValidator._safeNum(raw.runes)));
    return runes > 0 ? { runes } : null;
  }

  static _normalizeBossKills(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const next = ProfileValidator._emptyBossKills();
    for (const id of KNOWN_BOSS_IDS) {
      next[id] = Math.max(0, Math.floor(ProfileValidator._safeNum(source[id])));
    }
    return next;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProfileValidator;
}
