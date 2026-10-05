import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  KONAMI_SEQUENCE,
  normalizeKonamiKey,
  advanceSequence,
  createKonamiTracker,
} = require("../src/easter-eggs.js");

test("normalizeKonamiKey maps supported keyboard tokens", () => {
  assert.equal(normalizeKonamiKey("ArrowUp"), "UP");
  assert.equal(normalizeKonamiKey("ArrowDown"), "DOWN");
  assert.equal(normalizeKonamiKey("ArrowLeft"), "LEFT");
  assert.equal(normalizeKonamiKey("ArrowRight"), "RIGHT");
  assert.equal(normalizeKonamiKey("b"), "B");
  assert.equal(normalizeKonamiKey("a"), "A");
  assert.equal(normalizeKonamiKey("Enter"), null);
});

test("advanceSequence supports overlap reset logic", () => {
  const sequence = ["UP", "UP", "DOWN"];
  let index = 0;

  ({ nextIndex: index } = advanceSequence(sequence, index, "UP"));
  assert.equal(index, 1);

  ({ nextIndex: index } = advanceSequence(sequence, index, "UP"));
  assert.equal(index, 2);

  ({ nextIndex: index } = advanceSequence(sequence, index, "UP"));
  assert.equal(index, 1);
});

test("createKonamiTracker unlocks on full konami sequence and resets progress", () => {
  const tracker = createKonamiTracker();

  for (let i = 0; i < KONAMI_SEQUENCE.length - 1; i += 1) {
    assert.equal(tracker.consumeKey(KONAMI_SEQUENCE[i]), false);
  }

  assert.equal(tracker.consumeKey(KONAMI_SEQUENCE[KONAMI_SEQUENCE.length - 1]), true);
  assert.equal(tracker.getProgress(), 0);
});

test("createKonamiTracker ignores unsupported keys", () => {
  const tracker = createKonamiTracker();
  assert.equal(tracker.consumeKey("Enter"), false);
  assert.equal(tracker.getProgress(), 0);
});
