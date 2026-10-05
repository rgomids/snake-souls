(function defineSoulsProfile(global) {
  "use strict";

  const SoulsData =
    global.SoulsData ||
    (typeof require !== "undefined" ? require("./souls-data.js") : null);

  if (!SoulsData) {
    throw new Error("SoulsProfile requires SoulsData.");
  }

  const PROFILE_VERSION = 1;

  function createEmptyBossKills() {
    return {
      cacador: 0,
      carcereiro: 0,
      espectro: 0,
      abissal: 0,
    };
  }

  function createDefaultProfile() {
    return {
      version: PROFILE_VERSION,
      walletRunes: 0,
      unlockedSnakeIds: [SoulsData.DEFAULT_SNAKE_ID],
      selectedSnakeId: SoulsData.DEFAULT_SNAKE_ID,
      finalBossClears: 0,
      eligibleUnlocks: 0,
      pendingEcho: null,
      bossKills: createEmptyBossKills(),
    };
  }

  function toSafeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toSafeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
  }

  function normalizeUnlockedSnakeIds(snakeIds) {
    const knownIds = new Set(SoulsData.SNAKES.map((snake) => snake.id));
    const result = [];

    for (const snakeId of snakeIds) {
      if (typeof snakeId !== "string") continue;
      if (!knownIds.has(snakeId)) continue;
      if (result.includes(snakeId)) continue;
      result.push(snakeId);
    }

    if (!result.includes(SoulsData.DEFAULT_SNAKE_ID)) {
      result.unshift(SoulsData.DEFAULT_SNAKE_ID);
    }

    return result;
  }

  function normalizePendingEcho(pendingEcho) {
    if (!pendingEcho || typeof pendingEcho !== "object") {
      return null;
    }

    const runes = Math.max(0, Math.floor(toSafeNumber(pendingEcho.runes, 0)));
    if (runes <= 0) {
      return null;
    }

    return { runes };
  }

  function normalizeBossKills(bossKills) {
    const source = bossKills && typeof bossKills === "object" ? bossKills : {};
    const next = createEmptyBossKills();
    const knownBossIds = Object.keys(next);

    for (const bossId of knownBossIds) {
      next[bossId] = Math.max(0, Math.floor(toSafeNumber(source[bossId], 0)));
    }

    return next;
  }

  function sanitizeProfile(input) {
    const raw = input && typeof input === "object" ? input : {};
    const defaults = createDefaultProfile();
    const unlockedSnakeIds = normalizeUnlockedSnakeIds(
      toSafeArray(raw.unlockedSnakeIds)
    );
    const selectedSnakeId =
      typeof raw.selectedSnakeId === "string" &&
      unlockedSnakeIds.includes(raw.selectedSnakeId)
        ? raw.selectedSnakeId
        : defaults.selectedSnakeId;

    return {
      version: PROFILE_VERSION,
      walletRunes: Math.max(0, Math.floor(toSafeNumber(raw.walletRunes, 0))),
      unlockedSnakeIds,
      selectedSnakeId,
      finalBossClears: Math.max(
        0,
        Math.floor(toSafeNumber(raw.finalBossClears, 0))
      ),
      eligibleUnlocks: Math.max(
        0,
        Math.floor(toSafeNumber(raw.eligibleUnlocks, 0))
      ),
      pendingEcho: normalizePendingEcho(raw.pendingEcho),
      bossKills: normalizeBossKills(raw.bossKills),
    };
  }

  function loadProfile(storageValue) {
    if (!storageValue) {
      return createDefaultProfile();
    }

    try {
      const parsed =
        typeof storageValue === "string"
          ? JSON.parse(storageValue)
          : storageValue;
      return sanitizeProfile(parsed);
    } catch {
      return createDefaultProfile();
    }
  }

  function saveProfile(profile) {
    return JSON.stringify(sanitizeProfile(profile));
  }

  function hasSnakeUnlocked(profile, snakeId) {
    return sanitizeProfile(profile).unlockedSnakeIds.includes(snakeId);
  }

  function getNextUnlock(profile) {
    const safeProfile = sanitizeProfile(profile);
    for (let i = 0; i < SoulsData.UNLOCK_ORDER.length; i += 1) {
      const snakeId = SoulsData.UNLOCK_ORDER[i];
      if (!safeProfile.unlockedSnakeIds.includes(snakeId)) {
        return {
          snakeId,
          index: i,
          cost: SoulsData.getUnlockCostByIndex(i),
        };
      }
    }
    return null;
  }

  function purchaseSnake(profile, snakeId) {
    const safeProfile = sanitizeProfile(profile);
    const nextUnlock = getNextUnlock(safeProfile);

    if (!nextUnlock) {
      return { ok: false, reason: "all-unlocked", profile: safeProfile };
    }

    if (snakeId !== nextUnlock.snakeId) {
      return { ok: false, reason: "wrong-order", profile: safeProfile };
    }

    const requiredEligibility = nextUnlock.index + 1;
    if (safeProfile.eligibleUnlocks < requiredEligibility) {
      return { ok: false, reason: "not-eligible", profile: safeProfile };
    }

    if (safeProfile.walletRunes < nextUnlock.cost) {
      return { ok: false, reason: "insufficient-runes", profile: safeProfile };
    }

    const updated = {
      ...safeProfile,
      walletRunes: safeProfile.walletRunes - nextUnlock.cost,
      unlockedSnakeIds: [...safeProfile.unlockedSnakeIds, snakeId],
      selectedSnakeId: snakeId,
    };

    return { ok: true, reason: null, profile: sanitizeProfile(updated) };
  }

  function forceUnlockNext(profile) {
    const safeProfile = sanitizeProfile(profile);
    const nextUnlock = getNextUnlock(safeProfile);
    if (!nextUnlock) {
      return { ok: false, reason: "all-unlocked", profile: safeProfile };
    }

    const requiredUnlocks = nextUnlock.index + 1;
    const updated = {
      ...safeProfile,
      unlockedSnakeIds: [...safeProfile.unlockedSnakeIds, nextUnlock.snakeId],
      selectedSnakeId: nextUnlock.snakeId,
      eligibleUnlocks: Math.max(safeProfile.eligibleUnlocks, requiredUnlocks),
      finalBossClears: Math.max(safeProfile.finalBossClears, requiredUnlocks),
    };

    return {
      ok: true,
      reason: null,
      profile: sanitizeProfile(updated),
      snakeId: nextUnlock.snakeId,
    };
  }

  function forceUnlockAll(profile) {
    const safeProfile = sanitizeProfile(profile);
    const allSnakeIds = SoulsData.SNAKES.map((snake) => snake.id);
    const fullyUnlocked = normalizeUnlockedSnakeIds(allSnakeIds);
    const selectedSnakeId = fullyUnlocked.includes(safeProfile.selectedSnakeId)
      ? safeProfile.selectedSnakeId
      : SoulsData.UNLOCK_ORDER[SoulsData.UNLOCK_ORDER.length - 1] ??
        SoulsData.DEFAULT_SNAKE_ID;
    const requiredUnlocks = SoulsData.UNLOCK_ORDER.length;

    const updated = {
      ...safeProfile,
      unlockedSnakeIds: fullyUnlocked,
      selectedSnakeId,
      eligibleUnlocks: Math.max(safeProfile.eligibleUnlocks, requiredUnlocks),
      finalBossClears: Math.max(safeProfile.finalBossClears, requiredUnlocks),
    };

    return {
      ok: true,
      reason: null,
      profile: sanitizeProfile(updated),
    };
  }

  function applyDeathEcho(profile, carriedRunes) {
    const safeProfile = sanitizeProfile(profile);
    const runes = Math.max(0, Math.floor(toSafeNumber(carriedRunes, 0)));
    if (runes <= 0) {
      return safeProfile;
    }

    return {
      ...safeProfile,
      pendingEcho: { runes },
    };
  }

  function collectEcho(profile) {
    const safeProfile = sanitizeProfile(profile);
    const recoveredRunes = safeProfile.pendingEcho?.runes ?? 0;

    return {
      profile: {
        ...safeProfile,
        pendingEcho: null,
      },
      recoveredRunes,
    };
  }

  function addWalletRunes(profile, amount) {
    const safeProfile = sanitizeProfile(profile);
    const runes = Math.max(0, Math.floor(toSafeNumber(amount, 0)));
    return {
      ...safeProfile,
      walletRunes: safeProfile.walletRunes + runes,
    };
  }

  function registerFinalBossClear(profile) {
    const safeProfile = sanitizeProfile(profile);
    return {
      ...safeProfile,
      finalBossClears: safeProfile.finalBossClears + 1,
      eligibleUnlocks: safeProfile.eligibleUnlocks + 1,
    };
  }

  function registerBossDefeat(profile, bossId) {
    const safeProfile = sanitizeProfile(profile);
    if (typeof bossId !== "string" || !(bossId in safeProfile.bossKills)) {
      return safeProfile;
    }

    return {
      ...safeProfile,
      bossKills: {
        ...safeProfile.bossKills,
        [bossId]: safeProfile.bossKills[bossId] + 1,
      },
    };
  }

  function selectSnake(profile, snakeId) {
    const safeProfile = sanitizeProfile(profile);
    if (!safeProfile.unlockedSnakeIds.includes(snakeId)) {
      return safeProfile;
    }

    return {
      ...safeProfile,
      selectedSnakeId: snakeId,
    };
  }

  const api = Object.freeze({
    PROFILE_VERSION,
    createDefaultProfile,
    sanitizeProfile,
    loadProfile,
    saveProfile,
    hasSnakeUnlocked,
    getNextUnlock,
    purchaseSnake,
    forceUnlockNext,
    forceUnlockAll,
    applyDeathEcho,
    collectEcho,
    addWalletRunes,
    registerFinalBossClear,
    registerBossDefeat,
    selectSnake,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SoulsProfile = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
