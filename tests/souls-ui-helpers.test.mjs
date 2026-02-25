import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildRewardRenderKey,
  canSelectReward,
} = require("../src/ui/souls-ui-helpers.js");

test("buildRewardRenderKey returns same key for same reward and stacks", () => {
  const reward = {
    options: ["folego", "muralha", "ima"],
    rerolled: false,
    source: "boss",
  };
  const powers = {
    folego: 1,
    muralha: 0,
    ima: 1,
  };

  const keyA = buildRewardRenderKey(reward, powers);
  const keyB = buildRewardRenderKey(reward, { ...powers });
  assert.equal(keyA, keyB);
});

test("buildRewardRenderKey changes when options, reroll or stacks change", () => {
  const baseReward = {
    options: ["folego", "muralha", "ima"],
    rerolled: false,
    source: "boss",
  };
  const basePowers = {
    folego: 1,
    muralha: 0,
    ima: 1,
  };

  const keyBase = buildRewardRenderKey(baseReward, basePowers);
  const keyOptions = buildRewardRenderKey(
    { ...baseReward, options: ["folego", "voracidade", "ima"] },
    basePowers
  );
  const keyRerolled = buildRewardRenderKey(
    { ...baseReward, rerolled: true },
    basePowers
  );
  const keyStacks = buildRewardRenderKey(baseReward, {
    ...basePowers,
    folego: 2,
  });

  assert.notEqual(keyBase, keyOptions);
  assert.notEqual(keyBase, keyRerolled);
  assert.notEqual(keyBase, keyStacks);
});

test("buildRewardRenderKey returns null when reward is invalid", () => {
  assert.equal(buildRewardRenderKey(null, {}), null);
  assert.equal(buildRewardRenderKey({}, {}), null);
  assert.equal(buildRewardRenderKey({ options: [] }, {}), null);
});

test("canSelectReward validates souls reward state", () => {
  const valid = {
    mode: "souls",
    isGameOver: false,
    souls: {
      reward: {
        options: ["folego"],
      },
    },
  };
  const invalidMode = { ...valid, mode: "levels" };
  const invalidOver = { ...valid, isGameOver: true };
  const invalidReward = {
    ...valid,
    souls: {
      reward: {
        options: [],
      },
    },
  };

  assert.equal(canSelectReward(valid), true);
  assert.equal(canSelectReward(invalidMode), false);
  assert.equal(canSelectReward(invalidOver), false);
  assert.equal(canSelectReward(invalidReward), false);
});
