import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const SoulsWorld = require("../src/world/souls-world.js");

function cameraAt(x, y, size = 21) {
  return {
    centerX: x,
    centerY: y,
    width: size,
    height: size,
  };
}

test("updateActiveChunks keeps at most 5x5 active chunks", () => {
  const world = SoulsWorld.createWorldSession({
    seed: 42,
    chunkSize: 32,
    activeRadius: 2,
    stageType: "normal",
    cycle: 1,
  });

  SoulsWorld.updateActiveChunks(world, { x: 0, y: 0 });
  assert.equal(world.activeChunks.size, 25);

  SoulsWorld.updateActiveChunks(world, { x: 160, y: 96 });
  assert.equal(world.activeChunks.size, 25);
});

test("chunk recycling respects pool caps", () => {
  const world = SoulsWorld.createWorldSession({
    seed: 7,
    chunkSize: 32,
    activeRadius: 2,
    stageType: "final_boss",
    cycle: 8,
  });

  SoulsWorld.updateActiveChunks(world, { x: 0, y: 0 });

  for (let i = 0; i < 80; i += 1) {
    SoulsWorld.updateActiveChunks(world, { x: i * 64, y: i * 64 });
  }

  assert.ok(
    world.pools.obstaclePool.length <= SoulsWorld.POOL_LIMITS.obstaclePool
  );
  assert.ok(world.pools.pickupPool.length <= SoulsWorld.POOL_LIMITS.pickupPool);
  assert.ok(world.pools.minionPool.length <= SoulsWorld.POOL_LIMITS.minionPool);
});

test("spawnSoulsSigil can force offscreen spawn with minimum distance", () => {
  const world = SoulsWorld.createWorldSession({
    seed: 1337,
    chunkSize: 32,
    activeRadius: 2,
    stageType: "boss",
    cycle: 2,
  });

  const head = { x: 10, y: 10 };
  const camera = cameraAt(head.x, head.y, 31);
  SoulsWorld.updateActiveChunks(world, head);

  const sigil = SoulsWorld.spawnSoulsSigil(
    world,
    head,
    new Set(),
    18,
    true,
    camera
  );

  assert.ok(sigil);
  const distance = Math.abs(sigil.x - head.x) + Math.abs(sigil.y - head.y);
  assert.ok(distance >= 18);
  assert.equal(SoulsWorld.isPositionInCamera(sigil, camera), false);
});

test("spawnSoulsFood prefers visible camera area when camera is provided", () => {
  const world = SoulsWorld.createWorldSession({
    seed: 404,
    chunkSize: 32,
    activeRadius: 2,
    stageType: "normal",
    cycle: 1,
  });

  const head = { x: 32, y: -12 };
  const camera = {
    centerX: head.x,
    centerY: head.y,
    width: 39,
    height: 21,
  };
  SoulsWorld.updateActiveChunks(world, head);

  const food = SoulsWorld.spawnSoulsFood(world, head, new Set(), camera);
  assert.ok(food);
  assert.equal(SoulsWorld.isPositionInCamera(food, camera), true);
});

test("reenterEnemyAtEdge respects cooldown and safe distance", () => {
  const world = SoulsWorld.createWorldSession({
    seed: 2024,
    chunkSize: 32,
    activeRadius: 2,
    stageType: "boss",
    cycle: 1,
  });

  const head = { x: 0, y: 0 };
  const camera = cameraAt(0, 0, 31);
  const blocked = new Set(["0,0", "1,0", "0,1"]);

  const enemy = {
    x: 200,
    y: 200,
    reentryCooldownMs: 0,
  };

  const moved = SoulsWorld.reenterEnemyAtEdge(
    world,
    enemy,
    head,
    camera,
    1200,
    blocked,
    0
  );

  assert.ok(moved.reentryCooldownMs >= 1200);
  const distance = Math.abs(moved.x - head.x) + Math.abs(moved.y - head.y);
  assert.ok(distance >= 8);

  const stillCooling = SoulsWorld.reenterEnemyAtEdge(
    world,
    moved,
    head,
    camera,
    1200,
    blocked,
    200
  );
  assert.ok(stillCooling.reentryCooldownMs < moved.reentryCooldownMs);
});
