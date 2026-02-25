import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { calculateFixedSteps } = require("../src/game/souls-loop.js");

test("fixed-step scheduler computes steps and remaining accumulator", () => {
  const result = calculateFixedSteps({
    accumulatorMs: 2,
    deltaMs: 20,
    fixedStepMs: 8,
    maxStepsPerFrame: 5,
  });

  assert.equal(result.steps, 2);
  assert.equal(result.requestedSteps, 2);
  assert.equal(result.accumulatorAfterMs, 6);
});

test("fixed-step scheduler caps catch-up to maxStepsPerFrame", () => {
  const result = calculateFixedSteps({
    accumulatorMs: 0,
    deltaMs: 200,
    fixedStepMs: 10,
    maxStepsPerFrame: 5,
  });

  assert.equal(result.steps, 5);
  assert.equal(result.requestedSteps, 20);
  assert.equal(result.accumulatorAfterMs, 50);
  assert.equal(result.overflowStepsDropped, 0);
});

test("fixed-step scheduler can drop overflow backlog", () => {
  const result = calculateFixedSteps({
    accumulatorMs: 0,
    deltaMs: 200,
    fixedStepMs: 10,
    maxStepsPerFrame: 5,
    dropOverflow: true,
  });

  assert.equal(result.steps, 5);
  assert.equal(result.requestedSteps, 20);
  assert.equal(result.accumulatorAfterMs, 0);
  assert.equal(result.overflowStepsDropped, 15);
});
