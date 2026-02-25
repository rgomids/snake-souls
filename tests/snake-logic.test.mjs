import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createInitialState, placeFood, queueDirection, stepState } = require(
  "../src/snake-logic.js"
);

test("moves one cell in current direction without growing", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    inputQueue: [],
    food: { x: 4, y: 4 },
    score: 0,
    isGameOver: false,
    isPaused: false,
  };

  const next = stepState(state);
  assert.deepEqual(next.snake, [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 },
  ]);
  assert.equal(next.score, 0);
  assert.equal(next.isGameOver, false);
});

test("grows and increases score when food is eaten", () => {
  const state = {
    width: 5,
    height: 5,
    snake: [
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ],
    direction: "RIGHT",
    inputQueue: [],
    food: { x: 3, y: 2 },
    score: 0,
    isGameOver: false,
    isPaused: false,
  };

  const next = stepState(state, { rng: () => 0 });
  assert.equal(next.snake.length, 4);
  assert.equal(next.score, 1);
  assert.deepEqual(next.snake[0], { x: 3, y: 2 });
  assert.notDeepEqual(next.food, { x: 3, y: 2 });
});

test("sets game over on wall collision", () => {
  const state = {
    width: 4,
    height: 4,
    snake: [
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ],
    direction: "RIGHT",
    inputQueue: [],
    food: { x: 0, y: 0 },
    score: 0,
    isGameOver: false,
    isPaused: false,
  };

  const next = stepState(state);
  assert.equal(next.isGameOver, true);
});

test("sets game over on self collision", () => {
  const state = {
    width: 6,
    height: 6,
    snake: [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    direction: "UP",
    inputQueue: ["LEFT"],
    food: { x: 5, y: 5 },
    score: 0,
    isGameOver: false,
    isPaused: false,
  };

  const next = stepState(state);
  assert.equal(next.isGameOver, true);
});

test("food placement picks only free cells deterministically", () => {
  const snake = [{ x: 0, y: 0 }];
  const food = placeFood(3, 1, snake, () => 0.8);
  assert.deepEqual(food, { x: 2, y: 0 });
});

test("cannot reverse direction in a single input", () => {
  const state = createInitialState({ width: 8, height: 8, rng: () => 0 });
  const attemptedReverse = queueDirection(state, "LEFT");
  assert.equal(attemptedReverse.inputQueue.length, 0);
});
