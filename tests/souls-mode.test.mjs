import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SoulsData = require("../src/souls-data.js");
const SoulsProfile = require("../src/souls-profile.js");
const {
  chooseSoulsReward,
  createModeState,
  devSetSoulsBoss,
  devSetSoulsFloor,
  queueModeDirection,
  rerollSoulsReward,
  restartModeState,
  stepModeState,
} = require("../src/snake-modes.js");

function straightBase(width, height, food) {
  return {
    width,
    height,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    pendingDirection: "RIGHT",
    food,
    score: 0,
    isGameOver: false,
    isPaused: false,
  };
}

function minDistanceFromPreviewToHead(preview, head) {
  let minDistance = Infinity;
  const width = preview.width ?? preview.size ?? 1;
  const height = preview.height ?? preview.size ?? 1;
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) {
      const x = preview.x + dx;
      const y = preview.y + dy;
      const distance = Math.abs(head.x - x) + Math.abs(head.y - y);
      minDistance = Math.min(minDistance, distance);
    }
  }
  return minDistance;
}

test("souls starts on floor 1 normal with fixed 20x20 arena", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });

  assert.equal(state.mode, "souls");
  assert.equal(state.souls.floor, 1);
  assert.equal(state.souls.stageType, "normal");
  assert.equal(state.base.width, 20);
  assert.equal(state.base.height, 20);
  assert.equal(state.souls.objectiveType, "food");
});

test("floor 3 becomes boss stage with arena in boss range", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 3, y: 2 }),
    barriers: [],
    enemy: null,
    souls: {
      ...state.souls,
      floor: 2,
      stageType: "normal",
      objectiveType: "food",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: null,
      hazards: [],
      echo: null,
      reward: null,
    },
  };

  const next = stepModeState(custom, { rng: () => 0 });
  assert.equal(next.souls.floor, 3);
  assert.equal(next.souls.stageType, "boss");
  assert.equal(next.souls.objectiveType, "sigil");
  assert.equal(next.souls.countdownMsRemaining, 3000);
  assert.ok(next.base.width >= 22 && next.base.width <= 24);
  assert.ok(next.base.height >= 22 && next.base.height <= 24);
});

test("countdown blocks movement until it reaches zero", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    barriers: [],
    enemy: null,
    souls: {
      ...state.souls,
      countdownMsRemaining: 3000,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
    },
  };

  const next = stepModeState(custom, { rng: () => 0 });
  assert.deepEqual(next.base.snake[0], custom.base.snake[0]);
  assert.equal(next.souls.countdownMsRemaining < 3000, true);
});

test("movement resumes on tick after countdown expires", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    barriers: [],
    enemy: null,
    souls: {
      ...state.souls,
      countdownMsRemaining: 100,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
    },
  };

  const afterCountdown = stepModeState(custom, { rng: () => 0 });
  assert.deepEqual(afterCountdown.base.snake[0], custom.base.snake[0]);
  assert.equal(afterCountdown.souls.countdownMsRemaining, 0);

  const afterMove = stepModeState(afterCountdown, { rng: () => 0 });
  assert.deepEqual(afterMove.base.snake[0], { x: custom.base.snake[0].x + 1, y: custom.base.snake[0].y });
});

test("souls does not move snake before accumulator reaches interval", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    enemy: null,
    barriers: [],
    souls: {
      ...state.souls,
      countdownMsRemaining: 0,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
      snakeSpeedCps: 5,
      enemySpeedCps: 0,
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 50 });
  assert.deepEqual(next.base.snake[0], custom.base.snake[0]);
  assert.equal(next.souls.snakeMoveAccumulatorMs, 50);
});

test("souls moves when accumulator reaches snake interval", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    enemy: null,
    barriers: [],
    souls: {
      ...state.souls,
      countdownMsRemaining: 0,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
      snakeSpeedCps: 5,
      enemySpeedCps: 0,
      snakeMoveAccumulatorMs: 50,
      enemyMoveAccumulatorMs: 0,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 150 });
  assert.deepEqual(next.base.snake[0], { x: custom.base.snake[0].x + 1, y: custom.base.snake[0].y });
  assert.ok(next.souls.snakeMoveAccumulatorMs >= 0);
  assert.ok(next.souls.snakeMoveAccumulatorMs < 200);
});

test("last queued direction is applied on next souls step", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    enemy: null,
    barriers: [],
    souls: {
      ...state.souls,
      countdownMsRemaining: 0,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
      snakeSpeedCps: 5,
      enemySpeedCps: 0,
      snakeMoveAccumulatorMs: 199,
      enemyMoveAccumulatorMs: 0,
    },
  };

  const queuedOnce = queueModeDirection(custom, "UP");
  const queuedTwice = queueModeDirection(queuedOnce, "DOWN");
  const next = stepModeState(queuedTwice, { rng: () => 0, deltaMs: 1 });
  assert.deepEqual(next.base.snake[0], { x: custom.base.snake[0].x, y: custom.base.snake[0].y + 1 });
});

test("caçador is 2x2 and has +1 move tick penalty", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 3, y: 2 }),
    barriers: [],
    enemy: null,
    souls: {
      ...state.souls,
      floor: 2,
      stageType: "normal",
      objectiveType: "food",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: null,
      hazards: [],
      echo: null,
      reward: null,
      countdownMsRemaining: 0,
    },
  };

  const next = stepModeState(custom, { rng: () => 0 });
  assert.equal(next.souls.floor, 3);
  assert.equal(next.enemy?.id, "cacador");
  assert.equal(next.enemy?.width, 2);
  assert.equal(next.enemy?.height, 2);
  assert.equal(next.enemy?.moveEveryTicks, 2);
});

test("carcereiro and espectro spawn as 2x2 footprints", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const baseState = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });

  const toFloor6 = {
    ...baseState,
    base: straightBase(20, 20, { x: 3, y: 2 }),
    barriers: [],
    enemy: null,
    souls: {
      ...baseState.souls,
      floor: 5,
      stageType: "normal",
      objectiveType: "food",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: null,
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
    },
  };
  const floor6 = stepModeState(toFloor6, { rng: () => 0 });
  assert.equal(floor6.souls.floor, 6);
  assert.equal(floor6.enemy?.id, "carcereiro");
  assert.equal(floor6.enemy?.width, 2);
  assert.equal(floor6.enemy?.height, 2);

  const toFloor9 = {
    ...baseState,
    base: straightBase(20, 20, { x: 3, y: 2 }),
    barriers: [],
    enemy: null,
    souls: {
      ...baseState.souls,
      floor: 8,
      stageType: "normal",
      objectiveType: "food",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: null,
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
    },
  };
  const floor9 = stepModeState(toFloor9, { rng: () => 0 });
  assert.equal(floor9.souls.floor, 9);
  assert.equal(floor9.enemy?.id, "espectro");
  assert.equal(floor9.enemy?.width, 2);
  assert.equal(floor9.enemy?.height, 2);
  assert.equal(floor9.enemy?.moveEveryTicks, 2);
});

test("collision with any caçador 2x2 cell is lethal", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, null),
      snake: [
        { x: 4, y: 5 },
        { x: 3, y: 5 },
        { x: 2, y: 5 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 4,
      y: 4,
      direction: "LEFT",
      tickCounter: 0,
      moveEveryTicks: 2,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: "cacador",
      style: "aggressive",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 0,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    },
    souls: {
      ...state.souls,
      floor: 3,
      cycle: 1,
      withinCycle: 3,
      stageType: "boss",
      bossOrdinal: 1,
      bossName: "Caçador",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 20, y: 20 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
    },
  };

  const next = stepModeState(custom, { rng: () => 0 });
  assert.equal(next.isGameOver, true);
});

test("carcereiro chases when head is within manhattan range 3", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, null),
      snake: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 3, y: 5 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 7,
      y: 5,
      direction: "UP",
      tickCounter: 0,
      moveEveryTicks: 1,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: "carcereiro",
      style: "patrol",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 0,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 0,
    },
    souls: {
      ...state.souls,
      floor: 6,
      cycle: 1,
      withinCycle: 6,
      stageType: "boss",
      bossOrdinal: 2,
      bossName: "Carcereiro",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 20, y: 20 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 1000,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 1 });
  assert.equal(next.enemy?.x, 6);
  assert.equal(next.enemy?.y, 5);
});

test("carcereiro returns to patrol when head is outside range 3", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, null),
      snake: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 7,
      y: 5,
      direction: "UP",
      tickCounter: 0,
      moveEveryTicks: 1,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: "carcereiro",
      style: "patrol",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 0,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 0,
    },
    souls: {
      ...state.souls,
      floor: 6,
      cycle: 1,
      withinCycle: 6,
      stageType: "boss",
      bossOrdinal: 2,
      bossName: "Carcereiro",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 20, y: 20 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 1000,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 1 });
  assert.equal(next.enemy?.x, 7);
  assert.equal(next.enemy?.y, 4);
});

test("espectro schedules 1s preview before teleporting", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, null),
      snake: [
        { x: 12, y: 12 },
        { x: 11, y: 12 },
        { x: 10, y: 12 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 0,
      y: 0,
      direction: "RIGHT",
      tickCounter: 1,
      moveEveryTicks: 2,
      hazardCounter: 0,
      teleportCounter: 7,
      patternCounter: 0,
      id: "espectro",
      style: "phase",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 8,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    },
    souls: {
      ...state.souls,
      floor: 9,
      cycle: 1,
      withinCycle: 9,
      stageType: "boss",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 22, y: 22 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 500,
      enemyTeleportPreview: null,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 1 });
  assert.equal(Boolean(next.souls.enemyTeleportPreview), true);
  assert.equal(
    next.souls.enemyTeleportPreview.msRemaining,
    SoulsData.ESPECTRO_TELEPORT_PREVIEW_MS
  );
  assert.equal(next.enemy?.teleportCounter, 0);
  assert.ok(
    minDistanceFromPreviewToHead(next.souls.enemyTeleportPreview, next.base.snake[0]) <=
      SoulsData.ESPECTRO_TELEPORT_MAX_DISTANCE
  );
});

test("espectro teleports to locked preview target after 1s without extra move", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, null),
      snake: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 0,
      y: 0,
      direction: "RIGHT",
      tickCounter: 1,
      moveEveryTicks: 2,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: "espectro",
      style: "phase",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 8,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    },
    souls: {
      ...state.souls,
      floor: 9,
      cycle: 1,
      withinCycle: 9,
      stageType: "boss",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 22, y: 22 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 500,
      enemyTeleportPreview: {
        x: 12,
        y: 10,
        width: 2,
        height: 2,
        msRemaining: SoulsData.ESPECTRO_TELEPORT_PREVIEW_MS,
        enemyId: "espectro",
      },
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 1000 });
  assert.equal(next.souls.enemyTeleportPreview, null);
  assert.equal(next.enemy?.x, 12);
  assert.equal(next.enemy?.y, 10);
  assert.equal(next.enemy?.teleportCounter, 0);
});

test("espectro preview target stays locked while head moves", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: {
      ...straightBase(24, 24, { x: 20, y: 20 }),
      snake: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: [],
    enemy: {
      x: 0,
      y: 0,
      direction: "RIGHT",
      tickCounter: 0,
      moveEveryTicks: 2,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: "espectro",
      style: "phase",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 8,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    },
    souls: {
      ...state.souls,
      floor: 9,
      cycle: 1,
      withinCycle: 9,
      stageType: "boss",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 22, y: 22 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 200,
      enemyMoveAccumulatorMs: 0,
      enemyTeleportPreview: {
        x: 12,
        y: 10,
        width: 2,
        height: 2,
        msRemaining: SoulsData.ESPECTRO_TELEPORT_PREVIEW_MS,
        enemyId: "espectro",
      },
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 200 });
  assert.equal(next.base.snake[0].x, 11);
  assert.equal(next.souls.enemyTeleportPreview.x, 12);
  assert.equal(next.souls.enemyTeleportPreview.y, 10);
  assert.equal(next.souls.enemyTeleportPreview.msRemaining, 800);
});

test("espectro teleports with safe fallback when no nearby target exists", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });

  const snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  const blockedByBarriers = [];
  const openKeys = new Set([
    "0,0",
    "1,0",
    "0,1",
    "1,1",
    "0,2",
    "1,2",
    "0,3",
    "1,3",
    "10,10",
    "9,10",
    "8,10",
  ]);
  for (let y = 0; y < 12; y += 1) {
    for (let x = 0; x < 12; x += 1) {
      const key = `${x},${y}`;
      if (!openKeys.has(key)) {
        blockedByBarriers.push({ x, y });
      }
    }
  }

  const custom = {
    ...state,
    base: {
      ...straightBase(12, 12, null),
      snake,
      direction: "RIGHT",
      pendingDirection: "RIGHT",
    },
    barriers: blockedByBarriers,
    enemy: {
      x: 0,
      y: 0,
      direction: "RIGHT",
      tickCounter: 1,
      moveEveryTicks: 2,
      hazardCounter: 0,
      teleportCounter: 7,
      patternCounter: 0,
      id: "espectro",
      style: "phase",
      baseHazardEveryTicks: 0,
      baseTeleportEveryTicks: 8,
      width: 2,
      height: 2,
      size: 2,
      speedPenaltyTicks: 1,
    },
    souls: {
      ...state.souls,
      floor: 9,
      cycle: 1,
      withinCycle: 9,
      stageType: "boss",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 999,
      sigil: { x: 11, y: 11 },
      hazards: [],
      reward: null,
      countdownMsRemaining: 0,
      armorCharges: 0,
      powers: {},
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 500,
      enemyTeleportPreview: null,
    },
  };

  const next = stepModeState(custom, { rng: () => 0, deltaMs: 1 });
  assert.equal(Boolean(next.souls.enemyTeleportPreview), true);
  assert.ok(
    minDistanceFromPreviewToHead(next.souls.enemyTeleportPreview, next.base.snake[0]) >
      SoulsData.ESPECTRO_TELEPORT_MAX_DISTANCE
  );
});

test("holding current direction restores pre-slow speed in souls", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 10, y: 10 }),
    enemy: null,
    barriers: [],
    souls: {
      ...state.souls,
      floor: 1,
      stageType: "normal",
      countdownMsRemaining: 0,
      objectiveTarget: 999,
      objectiveProgress: 0,
      objectiveType: "food",
      hazards: [],
      reward: null,
      armorCharges: 0,
      snakeMoveAccumulatorMs: 170,
      enemyMoveAccumulatorMs: 0,
    },
  };

  const slowTick = stepModeState(custom, { rng: () => 0, deltaMs: 10 });
  assert.deepEqual(slowTick.base.snake[0], custom.base.snake[0]);

  const holdTick = stepModeState(custom, {
    rng: () => 0,
    deltaMs: 10,
    holdCurrentDirection: true,
  });
  assert.deepEqual(holdTick.base.snake[0], { x: custom.base.snake[0].x + 1, y: custom.base.snake[0].y });
});

test("final boss completion grants reward and selecting it advances cycle", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const initial = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const finalBossState = {
    ...initial,
    base: straightBase(24, 24, null),
    barriers: [],
    enemy: null,
    souls: {
      ...initial.souls,
      floor: 12,
      cycle: 1,
      withinCycle: 12,
      stageType: "final_boss",
      objectiveType: "sigil",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: { x: 3, y: 2 },
      sigilRespawnMsRemaining: 0,
      hazards: [],
      echo: null,
      reward: null,
      carriedRunes: 0,
      profile: SoulsProfile.createDefaultProfile(),
    },
  };

  const afterClear = stepModeState(finalBossState, { rng: () => 0 });
  assert.equal(afterClear.souls.reward !== null, true);
  assert.equal(afterClear.isPaused, true);
  assert.equal(afterClear.souls.profile.finalBossClears, 1);
  assert.equal(afterClear.souls.profile.eligibleUnlocks, 1);
  assert.equal(afterClear.souls.profile.bossKills.abissal, 1);
  assert.ok(afterClear.souls.carriedRunes >= SoulsData.getRuneReward("finalBossWin"));

  const chosenPower = afterClear.souls.reward.options[0];
  const afterChoice = chooseSoulsReward(afterClear, chosenPower, { rng: () => 0 });
  assert.equal(afterChoice.souls.floor, 13);
  assert.equal(afterChoice.souls.cycle, 2);
  assert.equal(afterChoice.souls.stageType, "normal");
  assert.equal(afterChoice.isPaused, false);
});

test("reroll consumes 30 runes and can only be used once per reward", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const initial = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const state = {
    ...initial,
    souls: {
      ...initial.souls,
      carriedRunes: 50,
      reward: {
        options: ["folego", "muralha", "ima"],
        rerolled: false,
      },
    },
  };

  const rerolled = rerollSoulsReward(state, { rng: () => 0.9 });
  assert.equal(rerolled.souls.carriedRunes, 20);
  assert.equal(rerolled.souls.reward.rerolled, true);

  const secondAttempt = rerollSoulsReward(rerolled, { rng: () => 0.2 });
  assert.equal(secondAttempt.souls.carriedRunes, 20);
  assert.deepEqual(secondAttempt.souls.reward.options, rerolled.souls.reward.options);
});

test("death creates echo and next run can recover it", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const initial = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const deathState = {
    ...initial,
    base: {
      ...straightBase(20, 20, { x: 19, y: 19 }),
      snake: [
        { x: 19, y: 2 },
        { x: 18, y: 2 },
        { x: 17, y: 2 },
      ],
    },
    souls: {
      ...initial.souls,
      carriedRunes: 44,
      objectiveTarget: 999,
      objectiveProgress: 0,
      stageType: "normal",
      objectiveType: "food",
      hazards: [],
      echo: null,
      reward: null,
    },
    barriers: [],
    enemy: null,
  };

  const dead = stepModeState(deathState, { rng: () => 0 });
  assert.equal(dead.isGameOver, true);
  assert.equal(dead.souls.profile.pendingEcho?.runes, 44);

  const restarted = restartModeState(dead, { rng: () => 0 });
  assert.equal(Boolean(restarted.souls.echo?.position), true);

  const echoPos = restarted.souls.echo.position;
  const headX = echoPos.x > 0 ? echoPos.x - 1 : echoPos.x + 1;
  const direction = echoPos.x > 0 ? "RIGHT" : "LEFT";
  const recoverState = {
    ...restarted,
    base: {
      ...restarted.base,
      snake: [
        { x: headX, y: echoPos.y },
        { x: headX - (direction === "RIGHT" ? 1 : -1), y: echoPos.y },
        { x: headX - (direction === "RIGHT" ? 2 : -2), y: echoPos.y },
      ],
      direction,
      pendingDirection: direction,
      food: { x: restarted.base.width - 1, y: restarted.base.height - 1 },
    },
    barriers: [],
    enemy: null,
    souls: {
      ...restarted.souls,
      objectiveTarget: 999,
      objectiveProgress: 0,
      hazards: [],
      reward: null,
    },
  };

  const recovered = stepModeState(recoverState, { rng: () => 0 });
  assert.equal(recovered.souls.profile.pendingEcho, null);
  assert.ok(recovered.souls.carriedRunes >= 44);
});

test("floor 12 is final boss and uses final arena range", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const custom = {
    ...state,
    base: straightBase(20, 20, { x: 3, y: 2 }),
    barriers: [],
    enemy: null,
    souls: {
      ...state.souls,
      floor: 11,
      stageType: "normal",
      objectiveType: "food",
      objectiveProgress: 0,
      objectiveTarget: 1,
      sigil: null,
      hazards: [],
      echo: null,
      reward: null,
    },
  };

  const next = stepModeState(custom, { rng: () => 0 });
  assert.equal(next.souls.floor, 12);
  assert.equal(next.souls.stageType, "final_boss");
  assert.equal(next.enemy?.id, "abissal");
  assert.equal(next.enemy?.width, 3);
  assert.equal(next.enemy?.height, 2);
  assert.ok(next.base.width >= 24 && next.base.width <= 26);
  assert.ok(next.base.height >= 24 && next.base.height <= 26);
});

test("devSetSoulsFloor jumps safely to target floor", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const state = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });

  const jumped = devSetSoulsFloor(state, 9, { rng: () => 0 });
  assert.equal(jumped.souls.floor, 9);
  assert.equal(jumped.souls.stageType, "boss");
  assert.equal(jumped.enemy?.id, "espectro");
  assert.equal(jumped.souls.countdownMsRemaining, 0);
  assert.equal(jumped.souls.reward, null);
});

test("devSetSoulsBoss jumps to boss floor within current cycle", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const base = createModeState({ mode: "souls", soulsProfile: profile, rng: () => 0 });
  const cycleTwo = devSetSoulsFloor(base, 13, { rng: () => 0 });

  const bossTwo = devSetSoulsBoss(cycleTwo, 2, { rng: () => 0 });
  assert.equal(bossTwo.souls.cycle, 2);
  assert.equal(bossTwo.souls.floor, 18);
  assert.equal(bossTwo.enemy?.id, "carcereiro");

  const finalBoss = devSetSoulsBoss(cycleTwo, "FINAL", { rng: () => 0 });
  assert.equal(finalBoss.souls.cycle, 2);
  assert.equal(finalBoss.souls.floor, 24);
  assert.equal(finalBoss.enemy?.id, "abissal");
});
