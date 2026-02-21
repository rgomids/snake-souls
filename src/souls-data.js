(function defineSoulsData(global) {
  "use strict";

  const STORAGE_KEY = "snake-souls-profile-v1";
  const DEFAULT_SNAKE_ID = "basica";
  const UNLOCK_ORDER = Object.freeze(["veloz", "tanque", "vidente"]);
  const UNLOCK_COSTS = Object.freeze([120, 220, 360]);

  const SNAKES = Object.freeze([
    Object.freeze({
      id: "basica",
      name: "Básica",
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

  const POWER_POOL = Object.freeze([
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
  ]);

  const BOSS_DEFINITIONS = Object.freeze({
    1: Object.freeze({
      id: "cacador",
      name: "Caçador",
      moveEveryTicks: 1,
      hazardEveryTicks: 0,
      teleportEveryTicks: 0,
      style: "aggressive",
    }),
    2: Object.freeze({
      id: "carcereiro",
      name: "Carcereiro",
      moveEveryTicks: 1,
      hazardEveryTicks: 6,
      teleportEveryTicks: 0,
      style: "patrol",
    }),
    3: Object.freeze({
      id: "espectro",
      name: "Espectro",
      moveEveryTicks: 1,
      hazardEveryTicks: 0,
      teleportEveryTicks: 8,
      style: "phase",
    }),
    final: Object.freeze({
      id: "abissal",
      name: "Abissal",
      moveEveryTicks: 1,
      hazardEveryTicks: 5,
      teleportEveryTicks: 9,
      style: "mixed",
    }),
  });

  const ARENA_RANGES = Object.freeze({
    normal: Object.freeze({ min: 18, max: 22 }),
    boss: Object.freeze({ min: 22, max: 24 }),
    final_boss: Object.freeze({ min: 24, max: 26 }),
  });

  const TICK_BASE_BY_STAGE = Object.freeze({
    normal: 140,
    boss: 128,
    final_boss: 118,
  });

  const RUNE_REWARDS = Object.freeze({
    food: 2,
    sigil: 6,
    bossWin: 40,
    finalBossWin: 120,
    allPowersMaxed: 60,
  });

  const REROLL_COST = 30;
  const MIN_TICK_MS = 55;
  const GHOST_COOLDOWN_MS = 15000;

  function getSnakeById(snakeId) {
    return SNAKES.find((snake) => snake.id === snakeId) ?? SNAKES[0];
  }

  function getPowerById(powerId) {
    return POWER_POOL.find((power) => power.id === powerId) ?? null;
  }

  function getPowerMaxStacks(powerId) {
    const power = getPowerById(powerId);
    return power ? power.maxStacks : 0;
  }

  function getCycle(floor) {
    return Math.floor((floor - 1) / 12) + 1;
  }

  function getWithinCycle(floor) {
    return ((floor - 1) % 12) + 1;
  }

  function getStageType(floor) {
    const withinCycle = getWithinCycle(floor);
    if (withinCycle === 12) {
      return "final_boss";
    }

    if (withinCycle === 3 || withinCycle === 6 || withinCycle === 9) {
      return "boss";
    }

    return "normal";
  }

  function getBossOrdinal(floor) {
    const withinCycle = getWithinCycle(floor);
    if (withinCycle === 3) return 1;
    if (withinCycle === 6) return 2;
    if (withinCycle === 9) return 3;
    return null;
  }

  function getBossDefinition(floor) {
    const stageType = getStageType(floor);
    if (stageType === "final_boss") {
      return BOSS_DEFINITIONS.final;
    }

    const ordinal = getBossOrdinal(floor);
    return ordinal ? BOSS_DEFINITIONS[ordinal] : null;
  }

  function getDifficultyScale(cycle) {
    return Math.pow(1.18, cycle - 1);
  }

  function getObjectiveTarget(floor, stageType, snakeDefinition) {
    const cycle = getCycle(floor);
    const extraTarget = snakeDefinition?.extraObjectiveTarget ?? 0;

    if (stageType === "normal") {
      return 4 + Math.floor((floor - 1) / 3) + extraTarget;
    }

    if (stageType === "boss") {
      const bossOrdinal = getBossOrdinal(floor) ?? 1;
      return 6 + cycle * 2 + bossOrdinal + extraTarget;
    }

    return 12 + cycle * 3 + extraTarget;
  }

  function getBaseTickMs(stageType) {
    return TICK_BASE_BY_STAGE[stageType] ?? TICK_BASE_BY_STAGE.normal;
  }

  function getArenaRange(stageType) {
    return ARENA_RANGES[stageType] ?? ARENA_RANGES.normal;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomIntInclusive(min, max, rng) {
    const value = Math.floor(rng() * (max - min + 1)) + min;
    return clamp(value, min, max);
  }

  function getArenaSize(floor, stageType, snakeDefinition, rng = Math.random) {
    if (floor <= 2) {
      return { width: 20, height: 20 };
    }

    const range = getArenaRange(stageType);
    let width = randomIntInclusive(range.min, range.max, rng);
    let height = randomIntInclusive(range.min, range.max, rng);

    if (stageType === "normal") {
      const penalty = snakeDefinition?.normalArenaPenalty ?? 0;
      width = Math.max(range.min, width - penalty);
      height = Math.max(range.min, height - penalty);
    }

    return { width, height };
  }

  function getRuneReward(type) {
    return RUNE_REWARDS[type] ?? 0;
  }

  function getUnlockCostByIndex(index) {
    return UNLOCK_COSTS[index] ?? null;
  }

  const api = Object.freeze({
    STORAGE_KEY,
    DEFAULT_SNAKE_ID,
    UNLOCK_ORDER,
    UNLOCK_COSTS,
    SNAKES,
    POWER_POOL,
    BOSS_DEFINITIONS,
    ARENA_RANGES,
    TICK_BASE_BY_STAGE,
    RUNE_REWARDS,
    REROLL_COST,
    MIN_TICK_MS,
    GHOST_COOLDOWN_MS,
    getSnakeById,
    getPowerById,
    getPowerMaxStacks,
    getCycle,
    getWithinCycle,
    getStageType,
    getBossOrdinal,
    getBossDefinition,
    getDifficultyScale,
    getObjectiveTarget,
    getBaseTickMs,
    getArenaRange,
    getArenaSize,
    getRuneReward,
    getUnlockCostByIndex,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SoulsData = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
