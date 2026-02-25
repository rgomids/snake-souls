import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SoulsProfile = require("../src/souls-profile.js");
const {
  chooseSoulsReward,
  createModeState,
  devSetSoulsFloor,
  stepModeState,
} = require("../src/snake-modes.js");

function cloneState(state) {
  return structuredClone(state);
}

function createSouls() {
  return createModeState({
    mode: "souls",
    soulsProfile: SoulsProfile.createDefaultProfile(),
    rng: () => 0.37,
  });
}

function createSoulsMovementBenchmarkState() {
  const state = createSouls();
  state.souls.world = null;
  state.barriers = [];
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];
  state.souls.objectiveType = "food";
  state.souls.objectiveTarget = 999;
  state.souls.objectiveProgress = 0;
  state.base.food = { x: 9999, y: 9999 };
  state.base.direction = "RIGHT";
  state.base.pendingDirection = "RIGHT";
  return state;
}

function simulateSoulsWindow(state, options = {}) {
  const durationMs = Math.max(0, options.durationMs ?? 3000);
  const stepMs = Math.max(1, options.stepMs ?? 16);
  const holdCurrentDirection = options.holdCurrentDirection === true;
  const rng = typeof options.rng === "function" ? options.rng : () => 0.31;
  let remaining = durationMs;
  let next = cloneState(state);
  while (remaining > 0 && !next.isGameOver) {
    const delta = Math.min(stepMs, remaining);
    next = stepModeState(next, {
      deltaMs: delta,
      holdCurrentDirection,
      rng,
    });
    remaining -= delta;
  }
  return next;
}

function getForwardDisplacementX(initialState, finalState) {
  return finalState.base.snake[0].x - initialState.base.snake[0].x;
}

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

test("souls starts with infinite viewport state and camera", () => {
  const state = createSouls();

  assert.equal(state.mode, "souls");
  assert.equal(state.souls.stageType, "normal");
  assert.equal(state.base.width, 21);
  assert.equal(state.base.height, 21);
  assert.equal(state.souls.camera.centerX, state.base.snake[0].x);
  assert.equal(state.souls.camera.centerY, state.base.snake[0].y);
  assert.equal(state.souls.stageFlow.phase, "idle");
});

test("souls no longer dies on boundary crossing", () => {
  const state = createSouls();
  state.souls.world = null;
  state.base.snake = [
    { x: 1000, y: 1000 },
    { x: 999, y: 1000 },
    { x: 998, y: 1000 },
  ];
  state.base.direction = "RIGHT";
  state.base.pendingDirection = "RIGHT";
  state.base.food = { x: 5000, y: 5000 };
  state.barriers = [];
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];
  state.souls.objectiveType = "food";
  state.souls.objectiveTarget = 999;
  state.souls.objectiveProgress = 0;

  const next = stepModeState(state, { deltaMs: 250, rng: () => 0.12 });
  assert.equal(next.isGameOver, false);
  assert.deepEqual(next.base.snake[0], { x: 1001, y: 1000 });
});

test("souls camera follows snake head", () => {
  const state = createSouls();
  state.souls.world = null;
  state.base.food = { x: 5000, y: 5000 };
  state.souls.objectiveType = "food";
  state.souls.objectiveTarget = 99;
  state.souls.objectiveProgress = 0;

  const next = stepModeState(state, { deltaMs: 250, rng: () => 0.41 });
  assert.equal(next.souls.camera.centerX, next.base.snake[0].x);
  assert.equal(next.souls.camera.centerY, next.base.snake[0].y);
});

test("boss viewport uses 31 and minions scale by boss/cycle", () => {
  const initial = createSouls();

  const boss1Cycle1 = devSetSoulsFloor(initial, 3, { includeCountdown: false, rng: () => 0.2 });
  assert.equal(boss1Cycle1.souls.stageType, "boss");
  assert.equal(boss1Cycle1.base.width, 31);
  assert.equal(boss1Cycle1.base.height, 31);
  assert.equal(boss1Cycle1.souls.minions.length, 2);

  const boss1Cycle3 = devSetSoulsFloor(initial, 27, {
    includeCountdown: false,
    rng: () => 0.2,
  });
  assert.equal(boss1Cycle3.souls.stageType, "boss");
  assert.equal(boss1Cycle3.souls.minions.length, 3);
});

test("minion curve scales by boss tier and cycle with cap 8", () => {
  const initial = createSouls();

  const boss2Cycle1 = devSetSoulsFloor(initial, 6, {
    includeCountdown: false,
    rng: () => 0.2,
  });
  assert.equal(boss2Cycle1.souls.minions.length, 3);

  const boss3Cycle5 = devSetSoulsFloor(initial, 57, {
    includeCountdown: false,
    rng: () => 0.2,
  });
  assert.equal(boss3Cycle5.souls.minions.length, 6);

  const finalCycle9 = devSetSoulsFloor(initial, 108, {
    includeCountdown: false,
    rng: () => 0.2,
  });
  assert.equal(finalCycle9.souls.minions.length, 8);
});

test("carcereiro keeps chasing even at long distance", () => {
  let state = createSouls();
  state = devSetSoulsFloor(state, 6, { includeCountdown: false, rng: () => 0.24 });
  state.souls.world = null;
  state.barriers = [];
  state.souls.hazards = [];
  state.souls.minions = [];
  state.base.food = null;
  state.souls.objectiveType = "sigil";
  state.souls.objectiveTarget = 999;

  const head = state.base.snake[0];
  state.enemy = {
    ...state.enemy,
    x: head.x + 8,
    y: head.y + 6,
    tickCounter: 0,
  };

  const before = manhattan(state.enemy, head);
  const next = stepModeState(state, { deltaMs: 160, rng: () => 0.24 });
  const after = manhattan(next.enemy, next.base.snake[0]);
  assert.ok(after < before, `expected chase distance to decrease (${before} -> ${after})`);
});

test("abissal movement prioritizes chase direction", () => {
  let state = createSouls();
  state = devSetSoulsFloor(state, 12, { includeCountdown: false, rng: () => 0.29 });
  state.souls.world = null;
  state.barriers = [];
  state.souls.hazards = [];
  state.souls.minions = [];
  state.base.food = null;
  state.souls.objectiveType = "sigil";
  state.souls.objectiveTarget = 999;
  state.base.snake = [
    { x: 10, y: 15 },
    { x: 9, y: 15 },
    { x: 8, y: 15 },
  ];
  state.base.direction = "RIGHT";
  state.base.pendingDirection = "RIGHT";
  state.enemy = {
    ...state.enemy,
    x: 10,
    y: 10,
    patternCounter: 2,
    tickCounter: 0,
    direction: "LEFT",
  };

  const next = stepModeState(state, { deltaMs: 120, rng: () => 0.29 });
  assert.equal(next.enemy.x, 10);
  assert.equal(next.enemy.y, 11);
});

test("souls viewport adapts to aspect ratio and keeps odd dimensions", () => {
  const state = createModeState({
    mode: "souls",
    soulsProfile: SoulsProfile.createDefaultProfile(),
    viewportAspect: 16 / 9,
    rng: () => 0.11,
  });

  assert.ok(state.base.width > state.base.height);
  assert.equal(state.base.width % 2, 1);
  assert.equal(state.base.height % 2, 1);
  assert.equal(state.base.height, 21);
});

test("normal stage completion runs message then countdown then advances floor", () => {
  const state = createSouls();
  state.souls.world = null;
  state.barriers = [];
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];
  state.souls.stageType = "normal";
  state.souls.objectiveType = "food";
  state.souls.objectiveProgress = 0;
  state.souls.objectiveTarget = 1;
  state.base.food = {
    x: state.base.snake[0].x + 1,
    y: state.base.snake[0].y,
  };

  const afterComplete = stepModeState(state, { deltaMs: 250, rng: () => 0.18 });
  assert.equal(afterComplete.souls.stageFlow.phase, "message");
  assert.equal(afterComplete.souls.stageFlow.nextFloor, 2);

  const afterMessage = stepModeState(afterComplete, { deltaMs: 2000, rng: () => 0.18 });
  assert.equal(afterMessage.souls.stageFlow.phase, "countdown");
  assert.ok(afterMessage.souls.countdownMsRemaining > 0);

  const afterCountdown = stepModeState(afterMessage, { deltaMs: 3000, rng: () => 0.18 });
  assert.equal(afterCountdown.souls.floor, 2);
  assert.equal(afterCountdown.souls.stageFlow.phase, "idle");
});

test("boss completion waits reward before message/countdown", () => {
  const base = createSouls();
  const bossState = devSetSoulsFloor(base, 3, { includeCountdown: false, rng: () => 0.33 });
  bossState.souls.world = null;
  bossState.barriers = [];
  bossState.enemy = null;
  bossState.souls.minions = [];
  bossState.souls.hazards = [];
  bossState.souls.objectiveType = "sigil";
  bossState.souls.objectiveProgress = 0;
  bossState.souls.objectiveTarget = 1;
  bossState.souls.sigil = {
    x: bossState.base.snake[0].x + 1,
    y: bossState.base.snake[0].y,
  };

  const afterBossWin = stepModeState(bossState, { deltaMs: 250, rng: () => 0.55 });
  assert.equal(afterBossWin.souls.stageFlow.phase, "reward");
  assert.ok(afterBossWin.souls.reward);

  const powerId = afterBossWin.souls.reward.options[0];
  const afterChoice = chooseSoulsReward(afterBossWin, powerId, { rng: () => 0.55 });
  assert.equal(afterChoice.souls.reward, null);
  assert.equal(afterChoice.souls.stageFlow.phase, "message");

  const afterMessage = stepModeState(afterChoice, { deltaMs: 2000, rng: () => 0.55 });
  assert.equal(afterMessage.souls.stageFlow.phase, "countdown");

  const afterCountdown = stepModeState(afterMessage, { deltaMs: 3000, rng: () => 0.55 });
  assert.equal(afterCountdown.souls.floor, 4);
  assert.equal(afterCountdown.souls.stageFlow.phase, "idle");
});

test("sigil indicator points when sigil is offscreen", () => {
  const state = createSouls();
  state.souls.world = null;
  state.souls.stageType = "boss";
  state.base.width = 31;
  state.base.height = 31;
  state.souls.objectiveType = "sigil";
  state.souls.sigil = { x: state.base.snake[0].x + 40, y: state.base.snake[0].y };
  state.souls.objectiveTarget = 99;
  state.souls.objectiveProgress = 0;
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];
  state.base.food = null;

  const next = stepModeState(state, { deltaMs: 1, rng: () => 0.2 });
  assert.equal(next.souls.sigilIndicator.visible, true);
  assert.ok(Math.abs(next.souls.sigilIndicator.angleDeg) <= 10);
  assert.ok(next.souls.sigilIndicator.distance >= 18);
});

test("food indicator points when food is offscreen", () => {
  const state = createSouls();
  state.souls.world = null;
  state.souls.objectiveType = "food";
  state.souls.objectiveTarget = 99;
  state.souls.objectiveProgress = 0;
  state.base.food = { x: state.base.snake[0].x + 60, y: state.base.snake[0].y + 10 };
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];

  const next = stepModeState(state, { deltaMs: 1, rng: () => 0.17 });
  assert.equal(next.souls.sigilIndicator.visible, true);
  assert.ok(next.souls.sigilIndicator.distance > 20);
});

test("souls stamina drains on hold and enters exhaustion/lock", () => {
  let state = createSouls();
  state.souls.world = null;
  state.enemy = null;
  state.souls.minions = [];
  state.souls.hazards = [];
  state.souls.objectiveType = "food";
  state.souls.objectiveTarget = 999;
  state.base.food = { x: 9999, y: 9999 };

  state = stepModeState(state, {
    deltaMs: 1000,
    holdCurrentDirection: true,
    rng: () => 0.31,
  });
  assert.equal(state.souls.stamina.phase, "ready");
  assert.ok(state.souls.stamina.current <= 75.1 && state.souls.stamina.current >= 74.8);

  for (let i = 0; i < 4; i += 1) {
    state = stepModeState(state, {
      deltaMs: 1000,
      holdCurrentDirection: true,
      rng: () => 0.31,
    });
  }

  assert.equal(state.souls.stamina.phase, "recovering_lock");
  assert.ok(state.souls.stamina.current >= 0);
  assert.ok(state.souls.stamina.current < state.souls.stamina.max);

  state = stepModeState(state, {
    deltaMs: 12000,
    holdCurrentDirection: true,
    rng: () => 0.31,
  });
  assert.equal(state.souls.stamina.phase, "ready");
  assert.equal(Math.round(state.souls.stamina.current), state.souls.stamina.max);
});

test("souls hold boost increases real displacement over equal duration", () => {
  const normalStart = createSoulsMovementBenchmarkState();
  const boostStart = cloneState(normalStart);

  const normalEnd = simulateSoulsWindow(normalStart, {
    durationMs: 3000,
    holdCurrentDirection: false,
    stepMs: 16,
    rng: () => 0.23,
  });
  const boostEnd = simulateSoulsWindow(boostStart, {
    durationMs: 3000,
    holdCurrentDirection: true,
    stepMs: 16,
    rng: () => 0.23,
  });

  const normalDisplacement = getForwardDisplacementX(normalStart, normalEnd);
  const boostDisplacement = getForwardDisplacementX(boostStart, boostEnd);
  assert.ok(normalDisplacement > 0);
  assert.ok(
    boostDisplacement >= normalDisplacement * 1.3,
    `expected boost displacement >= 1.30x normal (${boostDisplacement} vs ${normalDisplacement})`
  );
});

test("souls exhausted stamina slows snake below normal speed", () => {
  const normal = createSouls();
  normal.souls.world = null;
  normal.enemy = null;
  normal.souls.minions = [];
  normal.souls.hazards = [];
  normal.souls.objectiveType = "food";
  normal.souls.objectiveTarget = 999;
  normal.base.food = { x: 9999, y: 9999 };

  const readyStep = stepModeState(normal, {
    deltaMs: 16,
    holdCurrentDirection: false,
    rng: () => 0.14,
  });

  const exhaustedState = cloneState(normal);
  exhaustedState.souls.stamina = {
    ...exhaustedState.souls.stamina,
    current: 0,
    phase: "exhausted",
    exhaustedMsRemaining: 1000,
    lockMsRemaining: 0,
  };
  const exhaustedStep = stepModeState(exhaustedState, {
    deltaMs: 16,
    holdCurrentDirection: false,
    rng: () => 0.14,
  });

  assert.ok(exhaustedStep.souls.snakeSpeedCps < readyStep.souls.snakeSpeedCps);
});

test("souls exhausted phase reduces real displacement over equal duration", () => {
  const normalStart = createSoulsMovementBenchmarkState();
  const exhaustedStart = cloneState(normalStart);
  exhaustedStart.souls.stamina = {
    ...exhaustedStart.souls.stamina,
    current: 0,
    phase: "exhausted",
    exhaustedMsRemaining: 900,
    lockMsRemaining: 0,
  };

  const normalEnd = simulateSoulsWindow(normalStart, {
    durationMs: 900,
    holdCurrentDirection: false,
    stepMs: 16,
    rng: () => 0.19,
  });
  const exhaustedEnd = simulateSoulsWindow(exhaustedStart, {
    durationMs: 900,
    holdCurrentDirection: false,
    stepMs: 16,
    rng: () => 0.19,
  });

  const normalDisplacement = getForwardDisplacementX(normalStart, normalEnd);
  const exhaustedDisplacement = getForwardDisplacementX(exhaustedStart, exhaustedEnd);
  assert.ok(normalDisplacement > 0);
  assert.ok(
    exhaustedDisplacement <= normalDisplacement * 0.75,
    `expected exhausted displacement <= 0.75x normal (${exhaustedDisplacement} vs ${normalDisplacement})`
  );
});

test("adrenalina increases stamina max and recovery speed", () => {
  const base = createSouls();
  base.souls.world = null;
  base.enemy = null;
  base.souls.minions = [];
  base.souls.hazards = [];
  base.souls.objectiveType = "food";
  base.souls.objectiveTarget = 999;
  base.base.food = { x: 9999, y: 9999 };

  const boosted = cloneState(base);
  boosted.souls.powers.adrenalina = 2;
  boosted.souls.stamina.current = 0;
  boosted.souls.stamina.phase = "recovering_lock";
  boosted.souls.stamina.lockMsRemaining = 12000;

  const baseline = cloneState(base);
  baseline.souls.stamina.current = 0;
  baseline.souls.stamina.phase = "recovering_lock";
  baseline.souls.stamina.lockMsRemaining = 12000;

  const boostedStep = stepModeState(boosted, {
    deltaMs: 1000,
    holdCurrentDirection: false,
    rng: () => 0.2,
  });
  const baselineStep = stepModeState(baseline, {
    deltaMs: 1000,
    holdCurrentDirection: false,
    rng: () => 0.2,
  });

  assert.equal(boostedStep.souls.stamina.max, 140);
  assert.ok(boostedStep.souls.stamina.current > baselineStep.souls.stamina.current);
});

test("boss 1 matches normal snake speed and stamina boost opens escape window", () => {
  let state = createSouls();
  state = devSetSoulsFloor(state, 3, { includeCountdown: false, rng: () => 0.42 });
  state.souls.world = null;
  state.souls.hazards = [];
  state.souls.minions = [];

  const normalStep = stepModeState(state, {
    deltaMs: 16,
    holdCurrentDirection: false,
    rng: () => 0.42,
  });
  assert.ok(Math.abs(normalStep.souls.enemySpeedCps - normalStep.souls.snakeSpeedCps) < 0.001);

  const boostedStep = stepModeState(normalStep, {
    deltaMs: 200,
    holdCurrentDirection: true,
    rng: () => 0.42,
  });
  assert.ok(boostedStep.souls.snakeSpeedCps > boostedStep.souls.enemySpeedCps);
});

test("hunter boost cycles through boost, fatigue, recover and ready", () => {
  let state = createSouls();
  state = devSetSoulsFloor(state, 3, { includeCountdown: false, rng: () => 0.21 });
  state.souls.world = null;
  state.barriers = [];
  state.souls.hazards = [];
  state.souls.minions = [];
  state.base.food = null;
  state.souls.objectiveType = "sigil";
  state.souls.objectiveTarget = 999;
  state.enemy = {
    ...state.enemy,
    x: state.base.snake[0].x + 6,
    y: state.base.snake[0].y + 4,
    tickCounter: 0,
  };

  const afterTrigger = stepModeState(state, { deltaMs: 180, rng: () => 0.21 });
  assert.equal(afterTrigger.enemy.hunterBoost.phase, "boost");
  assert.equal(afterTrigger.enemy.hunterBoost.msRemaining, 700);

  const frozen = cloneState(afterTrigger);
  frozen.enemy.moveEveryTicks = 9999;

  const afterBoost = stepModeState(frozen, { deltaMs: 700, rng: () => 0.21 });
  assert.equal(afterBoost.enemy.hunterBoost.phase, "fatigue");
  assert.equal(afterBoost.enemy.hunterBoost.msRemaining, 1200);

  const afterFatigue = stepModeState(afterBoost, { deltaMs: 1200, rng: () => 0.21 });
  assert.equal(afterFatigue.enemy.hunterBoost.phase, "recover");
  assert.equal(afterFatigue.enemy.hunterBoost.msRemaining, 5000);

  const afterRecover = stepModeState(afterFatigue, { deltaMs: 5000, rng: () => 0.21 });
  assert.equal(afterRecover.enemy.hunterBoost.phase, "ready");
  assert.equal(afterRecover.enemy.hunterBoost.msRemaining, 0);
});
