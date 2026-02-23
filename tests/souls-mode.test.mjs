import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SoulsData = require("../src/souls-data.js");
const SoulsProfile = require("../src/souls-profile.js");
const {
  chooseSoulsReward,
  createModeState,
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
  assert.equal(next.enemy?.size, 2);
  assert.equal(next.enemy?.moveEveryTicks, 2);
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
      sigilRespawnTicks: 0,
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
  assert.ok(next.base.width >= 24 && next.base.width <= 26);
  assert.ok(next.base.height >= 24 && next.base.height <= 26);
});
