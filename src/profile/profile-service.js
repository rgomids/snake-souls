"use strict";

/**
 * ProfileService — lógica de negócio do perfil persistente Souls.
 *
 * Princípio SRP: única responsabilidade de operar mutações no perfil.
 * Princípio DIP: recebe ProfileRepository e ProfileValidator por construtor,
 *   nunca os instancia diretamente.
 * Princípio OCP: novos comportamentos de perfil adicionados como novos métodos,
 *   sem alterar os existentes.
 *
 * Todas as mutações são imutáveis (retornam novo objeto de perfil).
 */

const ProfileValidator = (typeof require !== "undefined")
  ? require("./profile-validator.js")
  : (typeof globalThis !== "undefined" ? globalThis.ProfileValidator : null);

const ProfileRepository = (typeof require !== "undefined")
  ? require("./profile-repository.js")
  : (typeof globalThis !== "undefined" ? globalThis.ProfileRepository : null);

const GameConstants = (typeof require !== "undefined")
  ? require("../data/constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

class ProfileService {
  /**
   * @param {ProfileRepository} repository
   */
  constructor(repository = null) {
    this._repo = repository ?? (ProfileRepository ? new ProfileRepository() : null);
  }

  // ── Persistência ──────────────────────────────────────────────────────────

  /**
   * Carrega perfil do storage, sanitizando o resultado.
   * @returns {object}
   */
  load() {
    const raw = this._repo ? this._repo.loadRaw() : null;
    if (!raw) return ProfileValidator.createDefault();
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return ProfileValidator.sanitize(parsed);
    } catch {
      return ProfileValidator.createDefault();
    }
  }

  /**
   * Persiste um perfil (após sanitização defensiva).
   * @param {object} profile
   */
  save(profile) {
    if (!this._repo) return;
    this._repo.saveRaw(JSON.stringify(ProfileValidator.sanitize(profile)));
  }

  /**
   * Remove o perfil do storage (reset completo).
   */
  reset() {
    if (this._repo) this._repo.remove();
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  /**
   * @param {object} profile
   * @param {string} snakeId
   * @returns {boolean}
   */
  hasSnakeUnlocked(profile, snakeId) {
    return ProfileValidator.sanitize(profile).unlockedSnakeIds.includes(snakeId);
  }

  /**
   * Retorna o próximo snake na ordem de desbloqueio e seu custo, ou null
   * se todos já foram desbloqueados.
   * @param {object} profile
   * @returns {{ snakeId: string, index: number, cost: number } | null}
   */
  getNextUnlock(profile) {
    const safe = ProfileValidator.sanitize(profile);
    const order = GameConstants?.UNLOCK_ORDER ?? ["veloz", "tanque", "vidente"];
    const costs = GameConstants?.UNLOCK_COSTS ?? [120, 220, 360];

    for (let i = 0; i < order.length; i += 1) {
      const snakeId = order[i];
      if (!safe.unlockedSnakeIds.includes(snakeId)) {
        return { snakeId, index: i, cost: costs[i] ?? null };
      }
    }

    return null;
  }

  // ── Mutações ──────────────────────────────────────────────────────────────

  /**
   * Tenta comprar a próxima cobra desbloqueável.
   * @param {object} profile
   * @param {string} snakeId
   * @returns {{ ok: boolean, reason: string|null, profile: object }}
   */
  purchaseSnake(profile, snakeId) {
    const safe = ProfileValidator.sanitize(profile);
    const nextUnlock = this.getNextUnlock(safe);

    if (!nextUnlock) {
      return { ok: false, reason: "all-unlocked", profile: safe };
    }
    if (snakeId !== nextUnlock.snakeId) {
      return { ok: false, reason: "wrong-order", profile: safe };
    }
    const requiredEligibility = nextUnlock.index + 1;
    if (safe.eligibleUnlocks < requiredEligibility) {
      return { ok: false, reason: "not-eligible", profile: safe };
    }
    if (safe.walletRunes < nextUnlock.cost) {
      return { ok: false, reason: "insufficient-runes", profile: safe };
    }

    const updated = ProfileValidator.sanitize({
      ...safe,
      walletRunes: safe.walletRunes - nextUnlock.cost,
      unlockedSnakeIds: [...safe.unlockedSnakeIds, snakeId],
      selectedSnakeId: snakeId,
    });

    return { ok: true, reason: null, profile: updated };
  }

  /**
   * Força o desbloqueio da próxima cobra (sem custo — comando dev).
   * @param {object} profile
   * @returns {{ ok: boolean, reason: string|null, profile: object, snakeId?: string }}
   */
  forceUnlockNext(profile) {
    const safe = ProfileValidator.sanitize(profile);
    const nextUnlock = this.getNextUnlock(safe);

    if (!nextUnlock) return { ok: false, reason: "all-unlocked", profile: safe };

    const requiredUnlocks = nextUnlock.index + 1;
    const updated = ProfileValidator.sanitize({
      ...safe,
      unlockedSnakeIds: [...safe.unlockedSnakeIds, nextUnlock.snakeId],
      selectedSnakeId: nextUnlock.snakeId,
      eligibleUnlocks: Math.max(safe.eligibleUnlocks, requiredUnlocks),
      finalBossClears: Math.max(safe.finalBossClears, requiredUnlocks),
    });

    return { ok: true, reason: null, profile: updated, snakeId: nextUnlock.snakeId };
  }

  /**
   * Força desbloqueio de todas as cobras (comando dev).
   * @param {object} profile
   * @returns {{ ok: boolean, reason: null, profile: object }}
   */
  forceUnlockAll(profile) {
    const safe = ProfileValidator.sanitize(profile);
    const order  = GameConstants?.UNLOCK_ORDER ?? ["veloz", "tanque", "vidente"];
    const defaultId = GameConstants?.DEFAULT_SNAKE_ID ?? "basica";
    const all = [defaultId, ...order];
    const unlockedSnakeIds = [...new Set(all)]; // preserva ordem sem duplicatas
    const selectedSnakeId = unlockedSnakeIds.includes(safe.selectedSnakeId)
      ? safe.selectedSnakeId
      : order[order.length - 1] ?? defaultId;
    const requiredUnlocks = order.length;

    const updated = ProfileValidator.sanitize({
      ...safe,
      unlockedSnakeIds,
      selectedSnakeId,
      eligibleUnlocks: Math.max(safe.eligibleUnlocks, requiredUnlocks),
      finalBossClears: Math.max(safe.finalBossClears, requiredUnlocks),
    });

    return { ok: true, reason: null, profile: updated };
  }

  /**
   * Aplica o eco de morte: salva runas carregadas no pending echo.
   * @param {object} profile
   * @param {number} carriedRunes
   * @returns {object}
   */
  applyDeathEcho(profile, carriedRunes) {
    const safe = ProfileValidator.sanitize(profile);
    const runes = Math.max(0, Math.floor(Number.isFinite(carriedRunes) ? carriedRunes : 0));
    if (runes <= 0) return safe;
    return ProfileValidator.sanitize({ ...safe, pendingEcho: { runes } });
  }

  /**
   * Coleta o eco pendente: transfere para a carteira virtual.
   * @param {object} profile
   * @returns {{ profile: object, recoveredRunes: number }}
   */
  collectEcho(profile) {
    const safe = ProfileValidator.sanitize(profile);
    const recoveredRunes = safe.pendingEcho?.runes ?? 0;
    return {
      profile: ProfileValidator.sanitize({ ...safe, pendingEcho: null }),
      recoveredRunes,
    };
  }

  /**
   * Adiciona runas à carteira do perfil.
   * @param {object} profile
   * @param {number} amount
   * @returns {object}
   */
  addWalletRunes(profile, amount) {
    const safe = ProfileValidator.sanitize(profile);
    const runes = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
    return ProfileValidator.sanitize({ ...safe, walletRunes: safe.walletRunes + runes });
  }

  /**
   * Registra a derrota do boss final: +1 clear e +1 unlock elegível.
   * @param {object} profile
   * @returns {object}
   */
  registerFinalBossClear(profile) {
    const safe = ProfileValidator.sanitize(profile);
    return ProfileValidator.sanitize({
      ...safe,
      finalBossClears: safe.finalBossClears + 1,
      eligibleUnlocks: safe.eligibleUnlocks + 1,
    });
  }

  /**
   * Registra a derrota de um boss específico.
   * @param {object} profile
   * @param {string} bossId
   * @returns {object}
   */
  registerBossDefeat(profile, bossId) {
    const safe = ProfileValidator.sanitize(profile);
    if (typeof bossId !== "string" || !(bossId in safe.bossKills)) {
      return safe;
    }
    return ProfileValidator.sanitize({
      ...safe,
      bossKills: { ...safe.bossKills, [bossId]: safe.bossKills[bossId] + 1 },
    });
  }

  /**
   * Seleciona uma cobra desbloqueada como ativa.
   * @param {object} profile
   * @param {string} snakeId
   * @returns {object}
   */
  selectSnake(profile, snakeId) {
    const safe = ProfileValidator.sanitize(profile);
    if (!safe.unlockedSnakeIds.includes(snakeId)) return safe;
    return ProfileValidator.sanitize({ ...safe, selectedSnakeId: snakeId });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProfileService;
}
