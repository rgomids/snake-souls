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
