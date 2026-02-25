(function defineSoulsWorld(global) {
  "use strict";

  const DEFAULT_CHUNK_SIZE = 32;
  const DEFAULT_ACTIVE_RADIUS = 2;
  const MIN_SIGIL_DISTANCE = 18;
  const DEFAULT_REENTRY_COOLDOWN_MS = 1200;

  const POOL_LIMITS = Object.freeze({
    obstaclePool: 800,
    pickupPool: 80,
    minionPool: 120,
  });

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function floorDiv(value, divisor) {
    return Math.floor(value / divisor);
  }

  function keyForPosition(position) {
    return `${position.x},${position.y}`;
  }

  function keyForChunk(cx, cy) {
    return `${cx},${cy}`;
  }

  function parseChunkKey(chunkKey) {
    const [cx, cy] = String(chunkKey).split(",").map((value) => Number(value));
    return { cx, cy };
  }

  function createMulberry32(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashChunkSeed(seed, cx, cy) {
    let value = seed >>> 0;
    value ^= Math.imul(cx | 0, 374761393);
    value ^= Math.imul(cy | 0, 668265263);
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    return (value ^ (value >>> 16)) >>> 0;
  }

  function randomIntInclusive(rng, min, max) {
    if (max <= min) {
      return min;
    }
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function getStageObstacleCount(stageType, cycle) {
    const stageBase =
      stageType === "normal" ? 4 : stageType === "boss" ? 9 : 12;
    return clamp(stageBase + Math.floor((Math.max(1, cycle) - 1) * 1.5), 2, 26);
  }

  function getCameraBounds(camera, padding = 0) {
    const halfWidth = Math.floor(camera.width / 2);
    const halfHeight = Math.floor(camera.height / 2);

    const minX = camera.centerX - halfWidth - padding;
    const maxX = camera.centerX + halfWidth + padding;
    const minY = camera.centerY - halfHeight - padding;
    const maxY = camera.centerY + halfHeight + padding;

    return { minX, maxX, minY, maxY };
  }

  function isPositionInCamera(position, camera, padding = 0) {
    if (!position || !camera) {
      return false;
    }

    const bounds = getCameraBounds(camera, padding);
    return (
      position.x >= bounds.minX &&
      position.x <= bounds.maxX &&
      position.y >= bounds.minY &&
      position.y <= bounds.maxY
    );
  }

  function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function trimPool(pool, limit) {
    if (pool.length <= limit) {
      return;
    }

    pool.splice(0, pool.length - limit);
  }

  function takeFromPool(pool, x, y) {
    const recycled = pool.pop();
    if (recycled) {
      recycled.x = x;
      recycled.y = y;
      return recycled;
    }

    return { x, y };
  }

  function createWorldSession(options = {}) {
    const seed = Number.isFinite(Number(options.seed))
      ? Math.floor(Number(options.seed))
      : Math.floor(Math.random() * 0xffffffff);

    const chunkSize = Math.max(8, Math.floor(options.chunkSize ?? DEFAULT_CHUNK_SIZE));
    const activeRadius = Math.max(
      1,
      Math.floor(options.activeRadius ?? DEFAULT_ACTIVE_RADIUS)
    );

    return {
      seed,
      chunkSize,
      activeRadius,
      stageType: options.stageType ?? "normal",
      cycle: Math.max(1, Math.floor(options.cycle ?? 1)),
      random: options.rng ?? Math.random,
      activeChunks: new Map(),
      activeChunkKeys: new Set(),
      pools: {
        obstaclePool: [],
        pickupPool: [],
        minionPool: [],
      },
      lastCameraCenter: { x: 0, y: 0 },
    };
  }

  function generateChunk(world, cx, cy) {
    const chunkKey = keyForChunk(cx, cy);
    if (world.activeChunks.has(chunkKey)) {
      return world.activeChunks.get(chunkKey);
    }

    const chunkRng = createMulberry32(hashChunkSeed(world.seed, cx, cy));
    const count = getStageObstacleCount(world.stageType, world.cycle);
    const used = new Set();
    const obstacles = [];

    const originX = cx * world.chunkSize;
    const originY = cy * world.chunkSize;
    const attempts = count * 8;

    for (let i = 0; i < attempts && obstacles.length < count; i += 1) {
      const localX = randomIntInclusive(chunkRng, 0, world.chunkSize - 1);
      const localY = randomIntInclusive(chunkRng, 0, world.chunkSize - 1);
      const key = `${localX},${localY}`;
      if (used.has(key)) {
        continue;
      }

      used.add(key);
      const x = originX + localX;
      const y = originY + localY;
      obstacles.push(takeFromPool(world.pools.obstaclePool, x, y));
    }

    const chunk = { cx, cy, obstacles };
    world.activeChunks.set(chunkKey, chunk);
    world.activeChunkKeys.add(chunkKey);
    return chunk;
  }

  function recycleChunk(world, chunkKey) {
    const chunk = world.activeChunks.get(chunkKey);
    if (!chunk) {
      return false;
    }

    world.activeChunks.delete(chunkKey);
    world.activeChunkKeys.delete(chunkKey);

    for (const obstacle of chunk.obstacles) {
      world.pools.obstaclePool.push(obstacle);
    }
    trimPool(world.pools.obstaclePool, POOL_LIMITS.obstaclePool);

    return true;
  }

  function updateActiveChunks(world, cameraCenter) {
    const center = {
      x: Math.floor(cameraCenter.x),
      y: Math.floor(cameraCenter.y),
    };
    world.lastCameraCenter = center;

    const centerChunkX = floorDiv(center.x, world.chunkSize);
    const centerChunkY = floorDiv(center.y, world.chunkSize);

    const desired = new Set();
    for (let dy = -world.activeRadius; dy <= world.activeRadius; dy += 1) {
      for (let dx = -world.activeRadius; dx <= world.activeRadius; dx += 1) {
        const cx = centerChunkX + dx;
        const cy = centerChunkY + dy;
        const chunkKey = keyForChunk(cx, cy);
        desired.add(chunkKey);
        generateChunk(world, cx, cy);
      }
    }

    for (const chunkKey of [...world.activeChunkKeys]) {
      if (!desired.has(chunkKey)) {
        recycleChunk(world, chunkKey);
      }
    }

    return world;
  }

  function getVisibleEntities(world, camera, stageType = "normal") {
    world.stageType = stageType;
    updateActiveChunks(world, { x: camera.centerX, y: camera.centerY });

    const barriers = [];
    const bounds = getCameraBounds(camera, 3);

    for (const chunk of world.activeChunks.values()) {
      for (const obstacle of chunk.obstacles) {
        if (
          obstacle.x < bounds.minX ||
          obstacle.x > bounds.maxX ||
          obstacle.y < bounds.minY ||
          obstacle.y > bounds.maxY
        ) {
          continue;
        }

        barriers.push({ x: obstacle.x, y: obstacle.y });
      }
    }

    return { barriers };
  }

  function pickRandomCellFromActiveChunks(world) {
    const chunkList = Array.from(world.activeChunks.values());
    if (chunkList.length === 0) {
      return null;
    }

    const chunkIndex = randomIntInclusive(world.random, 0, chunkList.length - 1);
    const chunk = chunkList[chunkIndex];

    const x =
      chunk.cx * world.chunkSize + randomIntInclusive(world.random, 0, world.chunkSize - 1);
    const y =
      chunk.cy * world.chunkSize + randomIntInclusive(world.random, 0, world.chunkSize - 1);

    return { x, y };
  }

  function spawnSoulsFood(world, snakeHead, blockedSet = new Set(), camera = null) {
    updateActiveChunks(world, snakeHead);
    const cameraRef = camera ?? buildCameraForSpawn(world, snakeHead);
    const bounds = getCameraBounds(cameraRef, 0);

    // Prefer spawning inside current viewport so objectives stay readable.
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const candidate = {
        x: randomIntInclusive(world.random, bounds.minX, bounds.maxX),
        y: randomIntInclusive(world.random, bounds.minY, bounds.maxY),
      };
      if (blockedSet.has(keyForPosition(candidate))) {
        continue;
      }
      return takeFromPool(world.pools.pickupPool, candidate.x, candidate.y);
    }

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = pickRandomCellFromActiveChunks(world);
      if (!candidate) {
        return null;
      }

      if (blockedSet.has(keyForPosition(candidate))) {
        continue;
      }

      return takeFromPool(world.pools.pickupPool, candidate.x, candidate.y);
    }

    return null;
  }

  function buildCameraForSpawn(world, snakeHead) {
    const size = world.stageType === "normal" ? 21 : 31;
    return {
      centerX: snakeHead.x,
      centerY: snakeHead.y,
      width: size,
      height: size,
    };
  }

  function spawnSoulsSigil(
    world,
    snakeHead,
    blockedSet = new Set(),
    minDistance = MIN_SIGIL_DISTANCE,
    requireOffscreen = true,
    camera = null
  ) {
    updateActiveChunks(world, snakeHead);

    const safeMinDistance = Math.max(1, Math.floor(minDistance));
    const cameraRef = camera ?? buildCameraForSpawn(world, snakeHead);

    for (let attempt = 0; attempt < 2000; attempt += 1) {
      const radius = safeMinDistance + randomIntInclusive(world.random, 0, 64);
      const angle = world.random() * Math.PI * 2;
      const x = snakeHead.x + Math.round(Math.cos(angle) * radius);
      const y = snakeHead.y + Math.round(Math.sin(angle) * radius);
      const candidate = { x, y };

      if (blockedSet.has(keyForPosition(candidate))) {
        continue;
      }

      if (manhattanDistance(candidate, snakeHead) < safeMinDistance) {
        continue;
      }

      if (requireOffscreen && isPositionInCamera(candidate, cameraRef, 0)) {
        continue;
      }

      return takeFromPool(world.pools.pickupPool, candidate.x, candidate.y);
    }

    for (let radius = safeMinDistance; radius <= safeMinDistance + 96; radius += 2) {
      const ring = [
        { x: snakeHead.x + radius, y: snakeHead.y },
        { x: snakeHead.x - radius, y: snakeHead.y },
        { x: snakeHead.x, y: snakeHead.y + radius },
        { x: snakeHead.x, y: snakeHead.y - radius },
        { x: snakeHead.x + radius, y: snakeHead.y + radius },
        { x: snakeHead.x - radius, y: snakeHead.y + radius },
        { x: snakeHead.x + radius, y: snakeHead.y - radius },
        { x: snakeHead.x - radius, y: snakeHead.y - radius },
      ];

      for (const candidate of ring) {
        if (blockedSet.has(keyForPosition(candidate))) {
          continue;
        }

        if (requireOffscreen && isPositionInCamera(candidate, cameraRef, 0)) {
          continue;
        }

        return takeFromPool(world.pools.pickupPool, candidate.x, candidate.y);
      }
    }

    return null;
  }

  function buildEdgeCandidates(camera, margin = 4) {
    const bounds = getCameraBounds(camera, margin);
    const candidates = [];

    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      candidates.push({ x, y: bounds.minY });
      candidates.push({ x, y: bounds.maxY });
    }

    for (let y = bounds.minY + 1; y <= bounds.maxY - 1; y += 1) {
      candidates.push({ x: bounds.minX, y });
      candidates.push({ x: bounds.maxX, y });
    }

    return candidates;
  }

  function reenterEnemyAtEdge(
    world,
    enemy,
    snakeHead,
    camera,
    cooldownMs = DEFAULT_REENTRY_COOLDOWN_MS,
    blockedSet = new Set(),
    deltaMs = 0
  ) {
    if (!enemy) {
      return enemy;
    }

    const next = {
      ...enemy,
      reentryCooldownMs: Math.max(0, (enemy.reentryCooldownMs ?? 0) - Math.max(0, deltaMs)),
    };

    const outside = !isPositionInCamera(next, camera, 8);
    if (!outside || next.reentryCooldownMs > 0) {
      return next;
    }

    const candidates = buildEdgeCandidates(camera, 4);
    const picked = [];
    for (let i = 0; i < candidates.length; i += 1) {
      const index = randomIntInclusive(world.random, 0, candidates.length - 1);
      picked.push(candidates[index]);
    }

    for (const candidate of picked) {
      if (manhattanDistance(candidate, snakeHead) < 8) {
        continue;
      }

      if (blockedSet.has(keyForPosition(candidate))) {
        continue;
      }

      return {
        ...next,
        x: candidate.x,
        y: candidate.y,
        reentryCooldownMs: Math.max(0, cooldownMs),
      };
    }

    return next;
  }

  function recyclePositionInPool(world, position, poolName) {
    if (!position) return;
    const pool = world?.pools?.[poolName];
    const limit = POOL_LIMITS[poolName];
    if (!pool || !Number.isFinite(limit)) {
      return;
    }

    pool.push(position);
    trimPool(pool, limit);
  }

  const api = Object.freeze({
    POOL_LIMITS,
    createWorldSession,
    updateActiveChunks,
    getVisibleEntities,
    spawnSoulsFood,
    spawnSoulsSigil,
    recycleChunk,
    reenterEnemyAtEdge,
    recyclePositionInPool,
    keyForPosition,
    keyForChunk,
    parseChunkKey,
    isPositionInCamera,
    getCameraBounds,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SoulsWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
