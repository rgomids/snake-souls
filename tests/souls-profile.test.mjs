import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SoulsData = require("../src/souls-data.js");
const SoulsProfile = require("../src/souls-profile.js");

test("loads default profile when storage is invalid", () => {
  const profile = SoulsProfile.loadProfile("{not-json");
  assert.equal(profile.walletRunes, 0);
  assert.deepEqual(profile.unlockedSnakeIds, [SoulsData.DEFAULT_SNAKE_ID]);
  assert.equal(profile.selectedSnakeId, SoulsData.DEFAULT_SNAKE_ID);
});

test("purchase obeys unlock order, eligibility and rune cost", () => {
  let profile = SoulsProfile.createDefaultProfile();
  profile = SoulsProfile.addWalletRunes(profile, 500);

  const invalidDirect = SoulsProfile.purchaseSnake(profile, "vidente");
  assert.equal(invalidDirect.ok, false);
  assert.equal(invalidDirect.reason, "wrong-order");

  const notEligible = SoulsProfile.purchaseSnake(profile, "veloz");
  assert.equal(notEligible.ok, false);
  assert.equal(notEligible.reason, "not-eligible");

  profile = SoulsProfile.registerFinalBossClear(profile);
  const unlockVeloz = SoulsProfile.purchaseSnake(profile, "veloz");
  assert.equal(unlockVeloz.ok, true);
  profile = unlockVeloz.profile;
  assert.equal(profile.unlockedSnakeIds.includes("veloz"), true);
  assert.equal(profile.walletRunes, 380);

  const tanqueWithoutEligibility = SoulsProfile.purchaseSnake(profile, "tanque");
  assert.equal(tanqueWithoutEligibility.ok, false);
  assert.equal(tanqueWithoutEligibility.reason, "not-eligible");

  profile = SoulsProfile.registerFinalBossClear(profile);
  const unlockTanque = SoulsProfile.purchaseSnake(profile, "tanque");
  assert.equal(unlockTanque.ok, true);
  assert.equal(unlockTanque.profile.unlockedSnakeIds.includes("tanque"), true);
});

test("death echo is created and can be collected", () => {
  const profile = SoulsProfile.createDefaultProfile();
  const afterDeath = SoulsProfile.applyDeathEcho(profile, 77);
  assert.equal(afterDeath.pendingEcho?.runes, 77);

  const collected = SoulsProfile.collectEcho(afterDeath);
  assert.equal(collected.recoveredRunes, 77);
  assert.equal(collected.profile.pendingEcho, null);
});

test("profile serialization roundtrip keeps safe values", () => {
  const source = {
    walletRunes: 123,
    unlockedSnakeIds: ["basica", "veloz"],
    selectedSnakeId: "veloz",
    finalBossClears: 3,
    eligibleUnlocks: 2,
    pendingEcho: { runes: 55 },
  };

  const serialized = SoulsProfile.saveProfile(source);
  const loaded = SoulsProfile.loadProfile(serialized);

  assert.equal(loaded.walletRunes, 123);
  assert.deepEqual(loaded.unlockedSnakeIds, ["basica", "veloz"]);
  assert.equal(loaded.selectedSnakeId, "veloz");
  assert.equal(loaded.finalBossClears, 3);
  assert.equal(loaded.eligibleUnlocks, 2);
  assert.equal(loaded.pendingEcho?.runes, 55);
});
