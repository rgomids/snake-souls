import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SnakeLogic = require("../src/core/snake-logic.js");
const {
  createModeState,
  queueModeDirection,
  restartModeState,
  stepModeState,
  toggleModePause,
} = require("../src/modes/snake-modes.js");

function sequenceRng(values, fallback = 0) {
  let index = 0;
  return () => {
    if (index < values.length) {
      const value = values[index];
      index += 1;
      return value;
    }
    return fallback;
  };
}

function makeLevelState(overrides = {}) {
  const initial = createModeState({
    mode: "levels",
    width: 20,
    height: 20,
    rng: () => 0,
  });

  return {
    ...initial,
    ...overrides,
    base: {
      ...initial.base,
      ...(overrides.base ?? {}),
    },
  };
}

test("traditional mode creates shooter state with 3 typed segments", () => {
  const state = createModeState({ mode: "traditional", rng: () => 0 });

  assert.equal(state.mode, "traditional");
  assert.ok(state.shooter, "shooter sub-state should exist");
  assert.equal(state.base.snake.length, 3);
  assert.equal(state.base.snake[0].type, "head");
  assert.equal(state.base.snake[1].type, "weapon");
  assert.equal(state.base.snake[2].type, "life");
  assert.equal(state.shooter.wave.phase, "countdown");
  assert.equal(state.shooter.wave.number, 1);
});

test("traditional mode step advances wave countdown", () => {
  const state = createModeState({ mode: "traditional", rng: () => 0 });
  const countdownBefore = state.shooter.wave.countdownMs;

  const next = stepModeState(state, { deltaMs: 500, rng: () => 0 });

  assert.equal(next.mode, "traditional");
  assert.ok(next.shooter.wave.countdownMs < countdownBefore, "countdown should decrease");
  assert.equal(next.base.isGameOver, false);
});

test("traditional mode snake does NOT move without input", () => {
  const state = createModeState({ mode: "traditional", rng: () => 0 });
  const headBefore = { x: state.base.snake[0].x, y: state.base.snake[0].y };

  // step without any queued direction — snake should stay put
  const next = stepModeState(state, { deltaMs: 250, rng: () => 0 });

  const headAfter = next.base.snake[0];
  assert.equal(headAfter.x, headBefore.x, "x should not change without input");
  assert.equal(headAfter.y, headBefore.y, "y should not change without input");
});

test("traditional mode snake moves one step when direction is queued", () => {
  const state = createModeState({ mode: "traditional", rng: () => 0 });
  // Seed a direction in the input queue to trigger one step
  const stateWithInput = {
    ...state,
    base: { ...state.base, inputQueue: ["RIGHT"] },
  };
  const headBefore = { x: stateWithInput.base.snake[0].x, y: stateWithInput.base.snake[0].y };

  const next = stepModeState(stateWithInput, { deltaMs: 16, rng: () => 0 });

  const headAfter = next.base.snake[0];
  const moved = headAfter.x !== headBefore.x || headAfter.y !== headBefore.y;
  assert.ok(moved, "snake head should have moved after queuing a direction");
});

test("traditional mode snake keeps moving when holdCurrentDirection is true", () => {
  const state = createModeState({ mode: "traditional", rng: () => 0 });
  const headBefore = { x: state.base.snake[0].x, y: state.base.snake[0].y };

  // First step: queue is empty but holdCurrentDirection injects current direction
  const next = stepModeState(state, { deltaMs: 16, rng: () => 0, holdCurrentDirection: true });

  const headAfter = next.base.snake[0];
  const moved = headAfter.x !== headBefore.x || headAfter.y !== headBefore.y;
  assert.ok(moved, "snake should move when holdCurrentDirection is true");
});

test("levels mode starts with level 1 defaults", () => {
  const state = createModeState({
    mode: "levels",
    width: 20,
    height: 20,
    rng: () => 0,
  });

  assert.equal(state.level, 1);
  assert.equal(state.levelTarget, 5);
  assert.equal(state.tickMs, 148);
  assert.deepEqual(state.barriers, []);
  assert.equal(state.enemy, null);
});

test("levels mode advances and recalculates difficulty on target completion", () => {
  const state = makeLevelState({
    level: 1,
    levelProgress: 4,
    levelTarget: 5,
    tickMs: 130,
    barriers: [],
    enemy: null,
    powerUp: null,
    base: {
      width: 20,
      height: 20,
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 3, y: 2 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  const next = stepModeState(state, { rng: () => 0 });
  assert.equal(next.level, 2);
  assert.equal(next.levelProgress, 0);
  assert.equal(next.levelTarget, 7);
  assert.equal(next.tickMs, 142);
  assert.equal(next.barriers.length, 3);
  assert.equal(next.enemy, null);
  assert.equal(next.isGameOver, false);
});

test("holding current direction restores pre-slow tick in levels", () => {
  const levels = createModeState({ mode: "levels", width: 20, height: 20, rng: () => 0 });
  const levelsStep = stepModeState(levels, {
    rng: () => 0,
    holdCurrentDirection: true,
  });
  assert.equal(levelsStep.tickMs, 130);
});

test("barrier collision without shield causes game over", () => {
  const state = makeLevelState({
    level: 2,
    levelProgress: 0,
    levelTarget: 7,
    tickMs: 125,
    barriers: [{ x: 3, y: 2 }],
    enemy: null,
    powerUp: null,
    shieldMsRemaining: 0,
    base: {
      width: 20,
      height: 20,
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 10, y: 10 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  const next = stepModeState(state, { rng: () => 0 });
  assert.equal(next.isGameOver, true);
});

test("barrier collision with active shield does not end the game", () => {
  const state = makeLevelState({
    level: 2,
    levelProgress: 0,
    levelTarget: 7,
    tickMs: 125,
    barriers: [{ x: 3, y: 2 }],
    enemy: null,
    powerUp: null,
    shieldMsRemaining: 1000,
    base: {
      width: 20,
      height: 20,
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 10, y: 10 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  const next = stepModeState(state, { rng: () => 0 });
  assert.equal(next.isGameOver, false);
  assert.deepEqual(next.base.snake[0], { x: 3, y: 2 });
  assert.ok(next.shieldMsRemaining > 0);
});

test("enemy movement can collide with snake head and end the game", () => {
  const state = makeLevelState({
    level: 3,
    levelProgress: 0,
    levelTarget: 9,
    tickMs: 120,
    barriers: [],
    enemy: {
      x: 4,
      y: 2,
      direction: "LEFT",
      stepEveryTicks: 1,
      tickCounter: 0,
    },
    powerUp: null,
    shieldMsRemaining: 0,
    base: {
      width: 20,
      height: 20,
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 10, y: 10 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  const next = stepModeState(state, { rng: () => 0 });
  assert.equal(next.isGameOver, true);
});

test("collecting power-up activates shield and shield expires over ticks", () => {
  let state = makeLevelState({
    level: 4,
    levelProgress: 0,
    levelTarget: 11,
    tickMs: 115,
    barriers: [],
    enemy: null,
    powerUp: {
      x: 11,
      y: 10,
      ttlTicks: 60,
    },
    shieldMsRemaining: 0,
    base: {
      width: 300,
      height: 20,
      snake: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 250, y: 10 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  state = stepModeState(state, { rng: () => 0 });
  assert.ok(state.shieldMsRemaining > 0);
  assert.equal(state.powerUp, null);

  for (let i = 0; i < 60; i += 1) {
    state = stepModeState(state, { rng: () => 0 });
  }

  assert.equal(state.shieldMsRemaining, 0);
  assert.equal(state.isGameOver, false);
});

test("spawned food and power-up never overlap occupied cells", () => {
  const rng = sequenceRng([0, 0, 0], 0);
  const state = makeLevelState({
    level: 4,
    levelProgress: 0,
    levelTarget: 11,
    tickMs: 115,
    barriers: [{ x: 5, y: 5 }],
    enemy: null,
    powerUp: null,
    shieldMsRemaining: 0,
    base: {
      width: 20,
      height: 20,
      snake: [
        { x: 2, y: 2 },
        { x: 1, y: 2 },
        { x: 0, y: 2 },
      ],
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: { x: 3, y: 2 },
      score: 0,
      isGameOver: false,
      isPaused: false,
    },
  });

  const next = stepModeState(state, { rng });
  assert.ok(next.base.food);
  assert.ok(next.powerUp);

  const snakeKeys = new Set(next.base.snake.map((segment) => `${segment.x},${segment.y}`));
  const barrierKeys = new Set(next.barriers.map((barrier) => `${barrier.x},${barrier.y}`));
  const foodKey = `${next.base.food.x},${next.base.food.y}`;
  const powerUpKey = `${next.powerUp.x},${next.powerUp.y}`;

  assert.equal(snakeKeys.has(foodKey), false);
  assert.equal(snakeKeys.has(powerUpKey), false);
  assert.equal(barrierKeys.has(foodKey), false);
  assert.equal(barrierKeys.has(powerUpKey), false);
  assert.notEqual(foodKey, powerUpKey);
});

test("mode helpers queue direction, toggle pause and restart using same mode", () => {
  let state = createModeState({ mode: "levels", width: 20, height: 20, rng: () => 0 });
  state = queueModeDirection(state, "DOWN");
  assert.equal(state.base.inputQueue[0], "DOWN");

  state = toggleModePause(state);
  assert.equal(state.isPaused, true);

  const restarted = restartModeState(state, { rng: () => 0 });
  assert.equal(restarted.mode, "levels");
  assert.equal(restarted.base.width, 20);
  assert.equal(restarted.isPaused, false);
});
