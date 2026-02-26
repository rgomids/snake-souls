(function defineSnakeModes(global) {
  "use strict";

  const SnakeLogic =
    global.SnakeLogic ||
    (typeof require !== "undefined" ? require("../core/snake-logic.js") : null);
  const SoulsData =
    global.SoulsData ||
    (typeof require !== "undefined" ? require("../data/souls-data.js") : null);
  const SoulsProfile =
    global.SoulsProfile ||
    (typeof require !== "undefined" ? require("../profile/souls-profile.js") : null);
  const SoulsWorld =
    global.SoulsWorld ||
    (typeof require !== "undefined" ? require("../world/souls-world.js") : null);

  const ShooterState =
    global.ShooterState ||
    (typeof require !== "undefined" ? require("./shooter/shooter-state.js") : null);

  if (!SnakeLogic) {
    throw new Error("SnakeModes requires SnakeLogic.");
  }

  const TRADITIONAL_BASE_TICK_MS = 120;
  const GLOBAL_SNAKE_SLOW_FACTOR = SoulsData?.GLOBAL_SNAKE_SLOW_FACTOR ?? 0.88;
  const TRADITIONAL_TICK_MS = Math.max(
    1,
    Math.round(TRADITIONAL_BASE_TICK_MS / GLOBAL_SNAKE_SLOW_FACTOR)
  );
  const SHIELD_DURATION_MS = 5000;
  const POWER_UP_TTL_TICKS = 60;
  const HAZARD_TTL_MS = 500;
  const SOULS_COUNTDOWN_MS = 3000;
  const SOULS_STAGE_MESSAGE_MS = 600;
  const ESPECTRO_TELEPORT_PREVIEW_MS =
    SoulsData?.ESPECTRO_TELEPORT_PREVIEW_MS ?? 1000;
  const ESPECTRO_TELEPORT_MAX_DISTANCE =
    SoulsData?.ESPECTRO_TELEPORT_MAX_DISTANCE ?? 3;
  const SOULS_VIEWPORT_NORMAL = 21;
  const SOULS_VIEWPORT_BOSS = 31;
  const SOULS_CHUNK_SIZE = 32;
  const SOULS_ACTIVE_RADIUS = 2;
  const SOULS_REENTRY_COOLDOWN_MS = 1200;
  const SOULS_MIN_VIEWPORT_ASPECT = 0.5;
  const SOULS_MAX_VIEWPORT_ASPECT = 2.5;
  const STAMINA_MAX_BASE = 100;
  const STAMINA_DRAIN_PER_SEC = 25;
  const STAMINA_EXHAUST_MS = 1000;
  const STAMINA_RECOVERY_MS_BASE = 12000;
  const STAMINA_BOOST_MULT = 1.6;
  const STAMINA_EXHAUST_MULT = 0.65;
  const STAMINA_PHASE_READY = "ready";
  const STAMINA_PHASE_EXHAUSTED = "exhausted";
  const STAMINA_PHASE_RECOVERING = "recovering_lock";
  const HUNTER_BOOST_PHASE_READY = "ready";
  const HUNTER_BOOST_PHASE_BOOST = "boost";
  const HUNTER_BOOST_PHASE_FATIGUE = "fatigue";
  const HUNTER_BOOST_PHASE_RECOVER = "recover";
  const HUNTER_BOOST_MS = 700;
  const HUNTER_FATIGUE_MS = 1200;
  const HUNTER_RECOVER_MS = 5000;
  const HUNTER_BOOST_MULT = 1.55;
  const HUNTER_FATIGUE_MULT = 0.7;
  const SOULS_CHASE_DIRECTIONS = Object.freeze([
    "UP",
    "UP_RIGHT",
    "RIGHT",
    "DOWN_RIGHT",
    "DOWN",
    "DOWN_LEFT",
    "LEFT",
    "UP_LEFT",
  ]);

  function keyForPosition(position) {
    return `${position.x},${position.y}`;
  }

  function clonePosition(position) {
    return { x: position.x, y: position.y };
  }

  function clonePositions(positions) {
    return positions.map(clonePosition);
  }

  function clampIndex(index, length) {
    if (length <= 1) return 0;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeSoulsViewportAspect(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 1;
    }
    return clamp(numeric, SOULS_MIN_VIEWPORT_ASPECT, SOULS_MAX_VIEWPORT_ASPECT);
  }

  function toOdd(value, minimum) {
    const safe = Math.max(minimum, Math.floor(value));
    return safe % 2 === 0 ? safe + 1 : safe;
  }

  function getSoulsViewportDimensions(stageType, viewportAspect = 1) {
    const baseSize =
      stageType === "normal" ? SOULS_VIEWPORT_NORMAL : SOULS_VIEWPORT_BOSS;
    const aspect = normalizeSoulsViewportAspect(viewportAspect);

    let width = baseSize;
    let height = baseSize;
    if (aspect >= 1) {
      width = Math.round(baseSize * aspect);
    } else {
      height = Math.round(baseSize / aspect);
    }

    return {
      width: toOdd(Math.max(baseSize, width), baseSize),
      height: toOdd(Math.max(baseSize, height), baseSize),
    };
  }

  function buildSoulsCamera(head, stageType, viewportAspect = 1) {
    const viewport = getSoulsViewportDimensions(stageType, viewportAspect);
    return {
      centerX: head.x,
      centerY: head.y,
      width: viewport.width,
      height: viewport.height,
    };
  }

  function listEnemyEntities(enemy, minions) {
    const list = [];
    if (enemy) {
      list.push(enemy);
    }
    if (Array.isArray(minions)) {
      for (const minion of minions) {
        if (minion) {
          list.push(minion);
        }
      }
    }
    return list;
  }

  function getEnemyFootprint(enemy) {
    if (!enemy) {
      return { width: 1, height: 1 };
    }

    return {
      width: Math.max(1, enemy.width ?? enemy.size ?? 1),
      height: Math.max(1, enemy.height ?? enemy.size ?? 1),
    };
  }

  function applyGlobalSlowdownToTickMs(tickMs) {
    return Math.max(1, Math.round(tickMs / GLOBAL_SNAKE_SLOW_FACTOR));
  }

  function arePositionsEqual(a, b) {
    return SnakeLogic.arePositionsEqual(a, b);
  }

  function containsPosition(positions, target) {
    return positions.some((position) => arePositionsEqual(position, target));
  }

  function getEnemyCells(enemy) {
    if (!enemy) return [];

    const footprint = getEnemyFootprint(enemy);
    const cells = [];
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        cells.push({ x: enemy.x + dx, y: enemy.y + dy });
      }
    }
    return cells;
  }

  function getTeleportPreviewCells(preview) {
    if (!preview) return [];
    const width = Math.max(1, preview.width ?? preview.size ?? 1);
    const height = Math.max(1, preview.height ?? preview.size ?? 1);
    const cells = [];
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        cells.push({ x: preview.x + dx, y: preview.y + dy });
      }
    }
    return cells;
  }

  function getAnchoredEnemyCells(anchor, footprint) {
    const cells = [];
    for (let dy = 0; dy < footprint.height; dy += 1) {
      for (let dx = 0; dx < footprint.width; dx += 1) {
        cells.push({ x: anchor.x + dx, y: anchor.y + dy });
      }
    }
    return cells;
  }

  function enemyOccupiesPosition(enemy, position) {
    if (!enemy || !position) return false;
    return getEnemyCells(enemy).some((cell) => arePositionsEqual(cell, position));
  }

  function listAvailableCells(width, height, blockedKeys) {
    const free = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const position = { x, y };
        if (!blockedKeys.has(keyForPosition(position))) {
          free.push(position);
        }
      }
    }
    return free;
  }

  function pickRandomCell(width, height, blockedKeys, rng) {
    const freeCells = listAvailableCells(width, height, blockedKeys);
    if (freeCells.length === 0) {
      return null;
    }

    const index = clampIndex(
      Math.floor(rng() * freeCells.length),
      freeCells.length
    );
    return freeCells[index];
  }

  function getLevelTarget(level) {
    return 5 + (level - 1) * 2;
  }

  function getBaseLevelTickMs(level) {
    return Math.max(70, 130 - (level - 1) * 5);
  }

  function getTickMs(level, options = {}) {
    const baseTickMs = getBaseLevelTickMs(level);
    if (options.holdCurrentDirection) {
      return baseTickMs;
    }

    return applyGlobalSlowdownToTickMs(baseTickMs);
  }

  function getBarrierCount(level) {
    return Math.min(40, (level - 1) * 3);
  }

  function getEnemyStepEveryTicks(level) {
    return Math.max(1, 4 - Math.floor((level - 3) / 3));
  }

  function getPowerUpSpawnChance(level) {
    return Math.min(0.45, 0.2 + (level - 4) * 0.03);
  }

  function getSafeZoneKeysAroundHead(base) {
    const safeZone = new Set();
    const head = base.snake[0];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = head.x + dx;
        const y = head.y + dy;
        if (x < 0 || x >= base.width || y < 0 || y >= base.height) {
          continue;
        }
        safeZone.add(`${x},${y}`);
      }
    }
    return safeZone;
  }

  function occupiedKeysFromSnake(base) {
    return new Set(base.snake.map(keyForPosition));
  }

  function generateBarriers(base, level, rng) {
    const desiredCount = getBarrierCount(level);
    if (desiredCount <= 0) {
      return [];
    }

    const blocked = occupiedKeysFromSnake(base);
    const safeZone = getSafeZoneKeysAroundHead(base);
    for (const safeKey of safeZone) {
      blocked.add(safeKey);
    }

    const freeCells = listAvailableCells(base.width, base.height, blocked);
    const barriers = [];
    const count = Math.min(desiredCount, freeCells.length);

    for (let i = 0; i < count; i += 1) {
      const index = clampIndex(
        Math.floor(rng() * freeCells.length),
        freeCells.length
      );
      const barrier = freeCells[index];
      barriers.push(barrier);
      freeCells.splice(index, 1);
    }

    return barriers;
  }

  function buildBlockedForEntitySpawn(base, barriers, enemy, powerUp) {
    const blocked = occupiedKeysFromSnake(base);

    for (const barrier of barriers) {
      blocked.add(keyForPosition(barrier));
    }

    if (enemy) {
      blocked.add(keyForPosition(enemy));
    }

    if (powerUp) {
      blocked.add(keyForPosition(powerUp));
    }

    return blocked;
  }

  function placeFoodAvoiding(base, barriers, enemy, powerUp, rng) {
    const blocked = buildBlockedForEntitySpawn(base, barriers, enemy, powerUp);
    return pickRandomCell(base.width, base.height, blocked, rng);
  }

  function spawnPowerUp(base, barriers, enemy, rng) {
    const blocked = buildBlockedForEntitySpawn(base, barriers, enemy, null);
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }

    const position = pickRandomCell(base.width, base.height, blocked, rng);
    if (!position) {
      return null;
    }

    return {
      x: position.x,
      y: position.y,
      ttlTicks: POWER_UP_TTL_TICKS,
    };
  }

  function spawnEnemy(base, level, barriers, rng) {
    if (level < 3) {
      return null;
    }

    const blocked = occupiedKeysFromSnake(base);
    for (const barrier of barriers) {
      blocked.add(keyForPosition(barrier));
    }
    const safeZone = getSafeZoneKeysAroundHead(base);
    for (const safeKey of safeZone) {
      blocked.add(safeKey);
    }

    const position = pickRandomCell(base.width, base.height, blocked, rng);
    if (!position) {
      return null;
    }

    return {
      x: position.x,
      y: position.y,
      direction: "LEFT",
      stepEveryTicks: getEnemyStepEveryTicks(level),
      tickCounter: 0,
    };
  }

  function regenerateLevelLayout(base, level, rng) {
    const barriers = generateBarriers(base, level, rng);
    const enemy = spawnEnemy(base, level, barriers, rng);
    const food = placeFoodAvoiding(base, barriers, enemy, null, rng);

    return {
      barriers,
      enemy,
      food,
    };
  }

  function createTraditionalModeState(options) {
    return ShooterState.createShooterState(options);
  }

  function createLevelsModeState(options) {
    const width = options.width ?? 20;
    const height = options.height ?? 20;
    const rng = options.rng ?? Math.random;
    const base = SnakeLogic.createInitialState({ width, height, rng });
    const level = 1;
    const levelTarget = getLevelTarget(level);
    const tickMs = getTickMs(level);
    const barriers = [];
    const enemy = null;
    const powerUp = null;
    const food = placeFoodAvoiding(base, barriers, enemy, powerUp, rng);
    const nextBase = {
      ...base,
      food,
      score: 0,
      isGameOver: food === null,
      isPaused: false,
    };

    return {
      mode: "levels",
      base: nextBase,
      level,
      levelProgress: 0,
      levelTarget,
      tickMs,
      barriers,
      enemy,
      powerUp,
      shieldMsRemaining: 0,
      isGameOver: nextBase.isGameOver,
      isPaused: false,
      souls: null,
    };
  }

  function getNextHead(base) {
    const nextQueue = [...(base.inputQueue ?? [])];
    const nextDirection = nextQueue.shift() ?? base.direction;
    const movement = SnakeLogic.DIRECTION_VECTORS[nextDirection];
    const head = base.snake[0];
    return {
      direction: nextDirection,
      nextQueue,
      nextHead: {
        x: head.x + movement.x,
        y: head.y + movement.y,
      },
    };
  }

  function isOutOfBounds(base, position) {
    return (
      position.x < 0 ||
      position.x >= base.width ||
      position.y < 0 ||
      position.y >= base.height
    );
  }

  function createGameOverState(state, base) {
    return {
      ...state,
      base: {
        ...base,
        isGameOver: true,
      },
      isGameOver: true,
      isPaused: false,
    };
  }

  function orderedEnemyDirections(enemy, snakeHead) {
    const directions = [];
    const dx = snakeHead.x - enemy.x;
    const dy = snakeHead.y - enemy.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) directions.push("RIGHT");
      if (dx < 0) directions.push("LEFT");
      if (dy > 0) directions.push("DOWN");
      if (dy < 0) directions.push("UP");
    } else {
      if (dy > 0) directions.push("DOWN");
      if (dy < 0) directions.push("UP");
      if (dx > 0) directions.push("RIGHT");
      if (dx < 0) directions.push("LEFT");
    }

    for (const direction of ["UP", "RIGHT", "DOWN", "LEFT"]) {
      if (!directions.includes(direction)) {
        directions.push(direction);
      }
    }

    return directions;
  }

  function orderedSoulsEnemyDirections(enemy, snakeHead) {
    const validDirections = SOULS_CHASE_DIRECTIONS.filter(
      (direction) => SnakeLogic.DIRECTION_VECTORS[direction]
    );
    const preferredDirection =
      typeof enemy?.direction === "string" && SnakeLogic.DIRECTION_VECTORS[enemy.direction]
        ? enemy.direction
        : null;

    return validDirections
      .map((direction, index) => {
        const vector = SnakeLogic.DIRECTION_VECTORS[direction];
        const nextDx = snakeHead.x - (enemy.x + vector.x);
        const nextDy = snakeHead.y - (enemy.y + vector.y);
        const chebyshevDistance = Math.max(Math.abs(nextDx), Math.abs(nextDy));
        const manhattanDistance = Math.abs(nextDx) + Math.abs(nextDy);
        const keepsDirection = preferredDirection === direction ? 0 : 1;

        return {
          direction,
          chebyshevDistance,
          manhattanDistance,
          keepsDirection,
          index,
        };
      })
      .sort((left, right) => {
        if (left.chebyshevDistance !== right.chebyshevDistance) {
          return left.chebyshevDistance - right.chebyshevDistance;
        }
        if (left.manhattanDistance !== right.manhattanDistance) {
          return left.manhattanDistance - right.manhattanDistance;
        }
        if (left.keepsDirection !== right.keepsDirection) {
          return left.keepsDirection - right.keepsDirection;
        }
        return left.index - right.index;
      })
      .map((candidate) => candidate.direction);
  }

  function moveEnemy(enemy, base, barriers, powerUp) {
    if (!enemy) {
      return null;
    }

    const nextCounter = enemy.tickCounter + 1;
    if (nextCounter < enemy.stepEveryTicks) {
      return {
        ...enemy,
        tickCounter: nextCounter,
      };
    }

    const blocked = new Set();
    for (let i = 1; i < base.snake.length; i += 1) {
      blocked.add(keyForPosition(base.snake[i]));
    }
    for (const barrier of barriers) {
      blocked.add(keyForPosition(barrier));
    }
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }
    if (powerUp) {
      blocked.add(keyForPosition(powerUp));
    }

    const snakeHead = base.snake[0];
    const directions = orderedEnemyDirections(enemy, snakeHead);

    for (const direction of directions) {
      const movement = SnakeLogic.DIRECTION_VECTORS[direction];
      const candidate = {
        x: enemy.x + movement.x,
        y: enemy.y + movement.y,
      };

      if (isOutOfBounds(base, candidate)) {
        continue;
      }

      if (blocked.has(keyForPosition(candidate))) {
        continue;
      }

      return {
        x: candidate.x,
        y: candidate.y,
        direction,
        stepEveryTicks: enemy.stepEveryTicks,
        tickCounter: 0,
      };
    }

    return {
      ...enemy,
      tickCounter: 0,
    };
  }

  function stepLevelsState(state, options = {}) {
    if (state.isGameOver || state.isPaused) {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const base = {
      ...state.base,
    };
    const { direction, nextHead, nextQueue } = getNextHead(base);

    if (isOutOfBounds(base, nextHead)) {
      const nextBase = {
        ...base,
        direction,
        inputQueue: nextQueue,
      };
      return createGameOverState(state, nextBase);
    }

    const willEatFood = base.food ? arePositionsEqual(nextHead, base.food) : false;
    const nextSnake = [nextHead, ...base.snake];
    if (!willEatFood) {
      nextSnake.pop();
    }

    const collidedWithSelf = nextSnake
      .slice(1)
      .some((segment) => arePositionsEqual(segment, nextHead));

    if (collidedWithSelf) {
      const nextBase = {
        ...base,
        snake: nextSnake,
        direction,
        inputQueue: nextQueue,
      };
      return createGameOverState(state, nextBase);
    }

    let nextBase = {
      ...base,
      snake: nextSnake,
      direction,
      inputQueue: nextQueue,
      score: base.score + (willEatFood ? 1 : 0),
      isGameOver: false,
      isPaused: false,
    };
    let isGameOver = false;
    let level = state.level;
    const holdCurrentDirection = options.holdCurrentDirection === true;
    let levelProgress = state.levelProgress + (willEatFood ? 1 : 0);
    let levelTarget = state.levelTarget;
    let tickMs = getTickMs(level, { holdCurrentDirection });
    let barriers = clonePositions(state.barriers);
    let enemy = state.enemy ? { ...state.enemy } : null;
    let powerUp = state.powerUp ? { ...state.powerUp } : null;
    let shieldMsRemaining = Math.max(0, state.shieldMsRemaining);

    const hitBarrier = containsPosition(barriers, nextHead);
    const hitEnemy = enemy && arePositionsEqual(enemy, nextHead);
    if ((hitBarrier || hitEnemy) && shieldMsRemaining <= 0) {
      return createGameOverState(state, nextBase);
    }

    if (willEatFood) {
      nextBase.food = placeFoodAvoiding(nextBase, barriers, enemy, powerUp, rng);
      if (!nextBase.food) {
        isGameOver = true;
      } else if (!powerUp && shieldMsRemaining <= 0 && level >= 4) {
        if (rng() < getPowerUpSpawnChance(level)) {
          powerUp = spawnPowerUp(nextBase, barriers, enemy, rng);
        }
      }
    }

    if (powerUp && arePositionsEqual(powerUp, nextHead)) {
      shieldMsRemaining = SHIELD_DURATION_MS;
      powerUp = null;
    }

    if (powerUp) {
      const ttlTicks = powerUp.ttlTicks - 1;
      powerUp = ttlTicks > 0 ? { ...powerUp, ttlTicks } : null;
    }

    enemy = moveEnemy(enemy, nextBase, barriers, powerUp);

    if (enemy && arePositionsEqual(enemy, nextBase.snake[0]) && shieldMsRemaining <= 0) {
      isGameOver = true;
    }

    if (shieldMsRemaining > 0) {
      shieldMsRemaining = Math.max(0, shieldMsRemaining - tickMs);
    }

    if (!isGameOver && levelProgress >= levelTarget) {
      level += 1;
      levelProgress = 0;
      levelTarget = getLevelTarget(level);
      tickMs = getTickMs(level, { holdCurrentDirection });
      const regenerated = regenerateLevelLayout(nextBase, level, rng);
      barriers = regenerated.barriers;
      enemy = regenerated.enemy;
      powerUp = null;
      nextBase = {
        ...nextBase,
        food: regenerated.food,
      };
      if (!nextBase.food) {
        isGameOver = true;
      }
    }

    return {
      ...state,
      base: {
        ...nextBase,
        isGameOver: isGameOver,
      },
      level,
      levelProgress,
      levelTarget,
      tickMs,
      barriers,
      enemy,
      powerUp,
      shieldMsRemaining,
      isGameOver,
      isPaused: false,
      souls: null,
    };
  }

  function manhattanDistance(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function isWithinCollectionRange(head, target, range) {
    if (!target) return false;
    return manhattanDistance(head, target) <= range;
  }

  function getEnemyDistanceToPosition(enemy, target) {
    if (!enemy || !target) {
      return Infinity;
    }

    let minDistance = Infinity;
    for (const cell of getEnemyCells(enemy)) {
      minDistance = Math.min(minDistance, manhattanDistance(cell, target));
    }
    return minDistance;
  }

  function getAnchorDistanceToPosition(anchor, footprint, target) {
    if (!anchor || !target) {
      return Infinity;
    }

    let minDistance = Infinity;
    for (const cell of getAnchoredEnemyCells(anchor, footprint)) {
      minDistance = Math.min(minDistance, manhattanDistance(cell, target));
    }
    return minDistance;
  }

  function normalizeHunterBoostState(source) {
    const phase =
      source?.phase === HUNTER_BOOST_PHASE_BOOST
        ? HUNTER_BOOST_PHASE_BOOST
        : source?.phase === HUNTER_BOOST_PHASE_FATIGUE
          ? HUNTER_BOOST_PHASE_FATIGUE
          : source?.phase === HUNTER_BOOST_PHASE_RECOVER
            ? HUNTER_BOOST_PHASE_RECOVER
            : HUNTER_BOOST_PHASE_READY;

    const msRemaining =
      phase === HUNTER_BOOST_PHASE_READY
        ? 0
        : Math.max(0, Math.floor(Number(source?.msRemaining ?? 0)));

    return {
      phase,
      msRemaining,
    };
  }

  function getHunterBoostPhaseDuration(phase) {
    if (phase === HUNTER_BOOST_PHASE_BOOST) return HUNTER_BOOST_MS;
    if (phase === HUNTER_BOOST_PHASE_FATIGUE) return HUNTER_FATIGUE_MS;
    if (phase === HUNTER_BOOST_PHASE_RECOVER) return HUNTER_RECOVER_MS;
    return 0;
  }

  function getNextHunterBoostPhase(phase) {
    if (phase === HUNTER_BOOST_PHASE_BOOST) return HUNTER_BOOST_PHASE_FATIGUE;
    if (phase === HUNTER_BOOST_PHASE_FATIGUE) return HUNTER_BOOST_PHASE_RECOVER;
    if (phase === HUNTER_BOOST_PHASE_RECOVER) return HUNTER_BOOST_PHASE_READY;
    return HUNTER_BOOST_PHASE_READY;
  }

  function advanceHunterBoostState(state, deltaMs) {
    const normalized = normalizeHunterBoostState(state);
    let phase = normalized.phase;
    let msRemaining = normalized.msRemaining;
    let remainingDelta = Math.max(0, Number(deltaMs) || 0);

    while (remainingDelta > 0 && phase !== HUNTER_BOOST_PHASE_READY) {
      const spent = Math.min(msRemaining, remainingDelta);
      msRemaining -= spent;
      remainingDelta -= spent;

      if (msRemaining > 0) {
        break;
      }

      phase = getNextHunterBoostPhase(phase);
      msRemaining = getHunterBoostPhaseDuration(phase);
    }

    if (phase === HUNTER_BOOST_PHASE_READY) {
      msRemaining = 0;
    }

    return {
      phase,
      msRemaining,
    };
  }

  function updateHunterBoostRuntime(enemy, deltaMs) {
    if (!enemy || enemy.id !== "cacador") {
      return enemy;
    }

    return {
      ...enemy,
      hunterBoost: advanceHunterBoostState(enemy.hunterBoost, deltaMs),
    };
  }

  function tryActivateHunterBoost(enemy, target) {
    if (!enemy || enemy.id !== "cacador") {
      return enemy;
    }

    const hunterBoost = normalizeHunterBoostState(enemy.hunterBoost);
    if (hunterBoost.phase !== HUNTER_BOOST_PHASE_READY) {
      return {
        ...enemy,
        hunterBoost,
      };
    }

    const distanceToHead = getEnemyDistanceToPosition(enemy, target);
    if (!Number.isFinite(distanceToHead) || distanceToHead <= 1) {
      return {
        ...enemy,
        hunterBoost,
      };
    }

    return {
      ...enemy,
      hunterBoost: {
        phase: HUNTER_BOOST_PHASE_BOOST,
        msRemaining: HUNTER_BOOST_MS,
      },
    };
  }

  function getPowerStack(souls, powerId) {
    return souls.powers[powerId] ?? 0;
  }

  function hasPower(souls, powerId) {
    return getPowerStack(souls, powerId) > 0;
  }

  function getSnakeDefinition(souls) {
    return SoulsData ? SoulsData.getSnakeById(souls.selectedSnakeId) : null;
  }

  function getRuneMultiplier(souls) {
    const snake = getSnakeDefinition(souls);
    const snakeMultiplier = snake?.runeGainMultiplier ?? 1;
    const runaVivaStacks = getPowerStack(souls, "runa_viva");
    return snakeMultiplier * (1 + runaVivaStacks * 0.3);
  }

  function applyRuneGain(souls, baseAmount) {
    if (baseAmount <= 0) {
      return 0;
    }

    const amount = Math.max(1, Math.round(baseAmount * getRuneMultiplier(souls)));
    souls.carriedRunes += amount;
    return amount;
  }

  function getSoulsSnakeBaseSpeedCps(floor, stageType, souls) {
    const cycle = SoulsData.getCycle(floor);
    const snake = getSnakeDefinition(souls);
    const folegoStacks = getPowerStack(souls, "folego");
    const baseByStage =
      stageType === "normal" ? 6 : stageType === "boss" ? 7 : 8;

    let cps = baseByStage * Math.pow(SoulsData.getDifficultyScale(cycle), 0.65);
    cps *= 1 / (snake?.tickMultiplier ?? 1);
    cps *= Math.pow(1.05, folegoStacks);

    return clamp(cps, 2, 18);
  }

  function getSoulsEnemyReferenceBaseSpeedCps(floor, stageType) {
    const cycle = SoulsData.getCycle(floor);
    const baseByStage =
      stageType === "normal" ? 6 : stageType === "boss" ? 7 : 8;
    const cps = baseByStage * Math.pow(SoulsData.getDifficultyScale(cycle), 0.65);
    return clamp(cps, 2, 18);
  }

  function getSoulsEnemyReferenceNormalSpeedCps(floor, stageType) {
    const baseCps = getSoulsEnemyReferenceBaseSpeedCps(floor, stageType);
    return clamp(baseCps * GLOBAL_SNAKE_SLOW_FACTOR, 2, 18);
  }

  function getSoulsSnakeNormalSpeedCps(floor, stageType, souls) {
    const baseCps = getSoulsSnakeBaseSpeedCps(floor, stageType, souls);
    return clamp(baseCps * GLOBAL_SNAKE_SLOW_FACTOR, 2, 18);
  }

  function getSoulsMinionSpeedCps(floor, stageType) {
    return clamp(getSoulsEnemyReferenceNormalSpeedCps(floor, stageType) * 0.75, 1.2, 12);
  }

  function getSoulsStaminaStats(souls) {
    const adrenalineStacks = getPowerStack(souls, "adrenalina");
    const max = STAMINA_MAX_BASE + adrenalineStacks * 20;
    const recoveryMs = Math.max(
      1000,
      Math.round(STAMINA_RECOVERY_MS_BASE * Math.pow(0.85, adrenalineStacks))
    );
    const rechargeRate = max / (recoveryMs / 1000);
    return {
      max,
      recoveryMs,
      rechargeRate,
    };
  }

  function createSoulsStaminaState(souls, options = {}) {
    const stats = getSoulsStaminaStats(souls);
    const current =
      options.current === "max"
        ? stats.max
        : clamp(
          Number(options.current ?? stats.max),
          0,
          stats.max
        );
    const phase =
      options.phase === STAMINA_PHASE_EXHAUSTED
        ? STAMINA_PHASE_EXHAUSTED
        : options.phase === STAMINA_PHASE_RECOVERING
          ? STAMINA_PHASE_RECOVERING
          : STAMINA_PHASE_READY;
    const exhaustedMsRemaining =
      phase === STAMINA_PHASE_EXHAUSTED
        ? Math.max(
          0,
          Math.floor(options.exhaustedMsRemaining ?? STAMINA_EXHAUST_MS)
        )
        : 0;
    const lockMsRemaining =
      phase === STAMINA_PHASE_RECOVERING
        ? Math.max(
          0,
          Math.floor(options.lockMsRemaining ?? stats.recoveryMs)
        )
        : 0;

    return {
      current,
      max: stats.max,
      phase,
      exhaustedMsRemaining,
      lockMsRemaining,
    };
  }

  function normalizeSoulsStaminaState(souls, stamina) {
    const stats = getSoulsStaminaStats(souls);
    const source = stamina ?? createSoulsStaminaState(souls, { current: "max" });
    return {
      current: clamp(Number(source.current ?? stats.max), 0, stats.max),
      max: stats.max,
      phase:
        source.phase === STAMINA_PHASE_EXHAUSTED
          ? STAMINA_PHASE_EXHAUSTED
          : source.phase === STAMINA_PHASE_RECOVERING
            ? STAMINA_PHASE_RECOVERING
            : STAMINA_PHASE_READY,
      exhaustedMsRemaining: Math.max(
        0,
        Math.floor(source.exhaustedMsRemaining ?? 0)
      ),
      lockMsRemaining: Math.max(0, Math.floor(source.lockMsRemaining ?? 0)),
    };
  }

  function updateSoulsStaminaState(souls, deltaMs, wantsBoost) {
    const stamina = normalizeSoulsStaminaState(souls, souls.stamina);
    const stats = getSoulsStaminaStats(souls);
    const dt = Math.max(0, deltaMs) / 1000;
    let boostActive = false;

    if (stamina.phase === STAMINA_PHASE_EXHAUSTED) {
      stamina.exhaustedMsRemaining = Math.max(
        0,
        stamina.exhaustedMsRemaining - deltaMs
      );
      if (stamina.exhaustedMsRemaining <= 0) {
        stamina.phase = STAMINA_PHASE_RECOVERING;
        stamina.lockMsRemaining = stats.recoveryMs;
      }
    } else if (stamina.phase === STAMINA_PHASE_RECOVERING) {
      stamina.lockMsRemaining = Math.max(0, stamina.lockMsRemaining - deltaMs);
      stamina.current = clamp(
        stamina.current + stats.rechargeRate * dt,
        0,
        stamina.max
      );
      if (stamina.lockMsRemaining <= 0 && stamina.current >= stamina.max - 0.0001) {
        stamina.current = stamina.max;
        stamina.phase = STAMINA_PHASE_READY;
        stamina.lockMsRemaining = 0;
      }
    } else {
      if (wantsBoost && stamina.current > 0) {
        boostActive = true;
        stamina.current = Math.max(0, stamina.current - STAMINA_DRAIN_PER_SEC * dt);
        if (stamina.current <= 0) {
          stamina.current = 0;
          stamina.phase = STAMINA_PHASE_EXHAUSTED;
          stamina.exhaustedMsRemaining = STAMINA_EXHAUST_MS;
        }
      } else {
        stamina.current = clamp(
          stamina.current + stats.rechargeRate * dt,
          0,
          stamina.max
        );
      }
    }

    souls.stamina = {
      ...stamina,
      max: stats.max,
    };

    return {
      boostActive:
        boostActive && souls.stamina.phase === STAMINA_PHASE_READY,
      exhausted: souls.stamina.phase === STAMINA_PHASE_EXHAUSTED,
    };
  }

  function getSoulsSnakeSpeedCps(floor, stageType, souls, options = {}) {
    const normalCps = getSoulsSnakeNormalSpeedCps(floor, stageType, souls);
    if (options.exhausted) {
      return clamp(normalCps * STAMINA_EXHAUST_MULT, 1.5, 18);
    }

    if (options.boostActive) {
      return clamp(normalCps * STAMINA_BOOST_MULT, 2, 24);
    }

    return normalCps;
  }

  function getSoulsEnemySpeedCps(enemy, speedRef) {
    if (!enemy) return 0;
    const snakeBaseCps = speedRef?.snakeBaseCps ?? 0;
    const snakeNormalCps = speedRef?.snakeNormalCps ?? snakeBaseCps;

    if (enemy.id === "cacador") {
      const hunterBoost = normalizeHunterBoostState(enemy.hunterBoost);
      let multiplier = 1;
      if (hunterBoost.phase === HUNTER_BOOST_PHASE_BOOST) {
        multiplier = HUNTER_BOOST_MULT;
      } else if (hunterBoost.phase === HUNTER_BOOST_PHASE_FATIGUE) {
        multiplier = HUNTER_FATIGUE_MULT;
      }
      return clamp(snakeNormalCps * multiplier, 1.2, 24);
    }

    const styleMultiplier =
      enemy.style === "patrol"
        ? 0.9
        : enemy.style === "phase"
          ? 0.95
          : enemy.style === "mixed"
            ? 1.1
            : 1;

    const cps =
      (snakeBaseCps / Math.max(1, enemy.moveEveryTicks ?? 1)) * styleMultiplier;
    return clamp(cps, 1.2, 16);
  }

  function getSoulsTickMs(floor, stageType, souls) {
    const snakeSpeedCps = getSoulsSnakeSpeedCps(floor, stageType, souls);
    return Math.max(SoulsData.MIN_TICK_MS, Math.round(1000 / snakeSpeedCps));
  }

  function getSoulsSnakeIntervalMs(souls) {
    return 1000 / Math.max(0.1, souls.snakeSpeedCps || 1);
  }

  function getSoulsEnemyIntervalMs(souls) {
    if (!souls.enemySpeedCps || souls.enemySpeedCps <= 0) {
      return Infinity;
    }
    return 1000 / souls.enemySpeedCps;
  }

  function getSoulsSigilRespawnMs(souls) {
    const snake = getSnakeDefinition(souls);
    const factor = snake?.sigilSpawnFactor ?? 1;
    return Math.max(100, Math.round(getSoulsSnakeIntervalMs(souls) * 4 * factor));
  }

  function getSoulsBarrierCount(base, floor, stageType) {
    const cycle = SoulsData.getCycle(floor);
    const difficultyScale = SoulsData.getDifficultyScale(cycle);
    const maxByArea = Math.floor(base.width * base.height * 0.2);
    const baseCount =
      stageType === "normal"
        ? 2 + Math.floor(floor / 2)
        : 6 + Math.floor(floor / 2);

    return clamp(
      Math.round(baseCount * Math.max(1, difficultyScale * 0.8)),
      0,
      maxByArea
    );
  }

  function generateSoulsBarriers(base, floor, stageType, rng) {
    const desiredCount = getSoulsBarrierCount(base, floor, stageType);
    if (desiredCount <= 0) {
      return [];
    }

    const blocked = occupiedKeysFromSnake(base);
    const safeZone = getSafeZoneKeysAroundHead(base);
    for (const safeKey of safeZone) {
      blocked.add(safeKey);
    }

    const freeCells = listAvailableCells(base.width, base.height, blocked);
    const barriers = [];
    const count = Math.min(desiredCount, freeCells.length);

    for (let i = 0; i < count; i += 1) {
      const index = clampIndex(
        Math.floor(rng() * freeCells.length),
        freeCells.length
      );
      const barrier = freeCells[index];
      barriers.push(barrier);
      freeCells.splice(index, 1);
    }

    return barriers;
  }

  function makeBlockedSet(
    base,
    barriers,
    enemy,
    minions,
    hazards,
    sigil,
    echo,
    enemyTeleportPreview
  ) {
    const blocked = occupiedKeysFromSnake(base);

    for (const barrier of barriers) {
      blocked.add(keyForPosition(barrier));
    }

    for (const entity of listEnemyEntities(enemy, minions)) {
      for (const enemyCell of getEnemyCells(entity)) {
        blocked.add(keyForPosition(enemyCell));
      }
    }

    for (const hazard of hazards) {
      blocked.add(keyForPosition(hazard));
    }

    if (sigil) {
      blocked.add(keyForPosition(sigil));
    }

    if (echo?.position) {
      blocked.add(keyForPosition(echo.position));
    }

    if (enemyTeleportPreview) {
      for (const previewCell of getTeleportPreviewCells(enemyTeleportPreview)) {
        blocked.add(keyForPosition(previewCell));
      }
    }

    return blocked;
  }

  function spawnSoulsFood(
    base,
    souls,
    barriers,
    enemy,
    minions,
    hazards,
    sigil,
    echo,
    rng,
    enemyTeleportPreview = null
  ) {
    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
      minions,
      hazards,
      sigil,
      echo,
      enemyTeleportPreview
    );

    if (!SoulsWorld || !souls?.world) {
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const radius = 6 + Math.floor(rng() * 20);
        const angle = rng() * Math.PI * 2;
        const candidate = {
          x: base.snake[0].x + Math.round(Math.cos(angle) * radius),
          y: base.snake[0].y + Math.round(Math.sin(angle) * radius),
        };
        if (!blocked.has(keyForPosition(candidate))) {
          return candidate;
        }
      }
      return null;
    }

    const food = SoulsWorld.spawnSoulsFood(
      souls.world,
      base.snake[0],
      blocked,
      souls.camera
    );
    if (!food) {
      return null;
    }

    return { x: food.x, y: food.y };
  }

  function spawnSoulsSigil(
    base,
    souls,
    barriers,
    enemy,
    minions,
    hazards,
    echo,
    rng,
    enemyTeleportPreview = null
  ) {
    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
      minions,
      hazards,
      null,
      echo,
      enemyTeleportPreview
    );
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }

    if (!SoulsWorld || !souls?.world) {
      for (let attempt = 0; attempt < 450; attempt += 1) {
        const radius = 18 + Math.floor(rng() * 40);
        const angle = rng() * Math.PI * 2;
        const candidate = {
          x: base.snake[0].x + Math.round(Math.cos(angle) * radius),
          y: base.snake[0].y + Math.round(Math.sin(angle) * radius),
        };
        if (blocked.has(keyForPosition(candidate))) {
          continue;
        }
        if (
          souls.camera &&
          SoulsWorld?.isPositionInCamera &&
          SoulsWorld.isPositionInCamera(candidate, souls.camera, 0)
        ) {
          continue;
        }
        return candidate;
      }
      return null;
    }

    const sigil = SoulsWorld.spawnSoulsSigil(
      souls.world,
      base.snake[0],
      blocked,
      18,
      true,
      souls.camera
    );
    if (!sigil) {
      return null;
    }

    return { x: sigil.x, y: sigil.y };
  }

  function spawnSoulsEcho(
    base,
    souls,
    barriers,
    enemy,
    minions,
    hazards,
    sigil,
    pendingEcho,
    rng,
    enemyTeleportPreview = null
  ) {
    if (!pendingEcho || pendingEcho.runes <= 0) {
      return null;
    }

    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
      minions,
      hazards,
      sigil,
      null,
      enemyTeleportPreview
    );
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }

    let position = null;
    if (SoulsWorld && souls?.world) {
      position = SoulsWorld.spawnSoulsFood(souls.world, base.snake[0], blocked);
    } else {
      position = spawnSoulsFood(
        base,
        souls,
        barriers,
        enemy,
        minions,
        hazards,
        sigil,
        null,
        rng,
        enemyTeleportPreview
      );
    }
    if (!position) {
      return null;
    }

    return {
      runes: pendingEcho.runes,
      position,
    };
  }

  function buildStageBlockedSet(base, barriers, enemy, minions, hazards, sigil, echo) {
    return makeBlockedSet(
      base,
      barriers,
      enemy,
      minions,
      hazards ?? [],
      sigil ?? null,
      echo ?? null,
      null
    );
  }

  function getSoulsEnemySpawnDistance(floor, stageType) {
    if (stageType === "normal") {
      return 10 + Math.floor(Math.min(10, floor / 2));
    }
    return 14 + Math.floor(Math.min(12, floor / 2));
  }

  function pickSpawnAroundHead(base, blocked, rng, distance, footprint = { width: 1, height: 1 }) {
    const head = base.snake[0];
    const minDistance = Math.max(4, Math.floor(distance));
    const maxDistance = minDistance + 18;

    for (let attempt = 0; attempt < 500; attempt += 1) {
      const radius = minDistance + Math.floor(rng() * Math.max(1, maxDistance - minDistance));
      const angle = rng() * Math.PI * 2;
      const anchor = {
        x: head.x + Math.round(Math.cos(angle) * radius),
        y: head.y + Math.round(Math.sin(angle) * radius),
      };

      let canUse = true;
      for (let dy = 0; dy < footprint.height; dy += 1) {
        for (let dx = 0; dx < footprint.width; dx += 1) {
          const key = `${anchor.x + dx},${anchor.y + dy}`;
          if (blocked.has(key)) {
            canUse = false;
            break;
          }
        }
        if (!canUse) break;
      }

      if (canUse) {
        return anchor;
      }
    }

    return {
      x: head.x + minDistance,
      y: head.y,
    };
  }

  function spawnSoulsEnemy(base, barriers, minions, floor, stageType, bossDefinition, rng) {
    if (!bossDefinition) {
      return null;
    }

    const blocked = buildStageBlockedSet(base, barriers, null, minions, [], null, null);
    const width = bossDefinition.width ?? bossDefinition.size ?? 1;
    const height = bossDefinition.height ?? bossDefinition.size ?? 1;

    const position = pickSpawnAroundHead(
      base,
      blocked,
      rng,
      getSoulsEnemySpawnDistance(floor, stageType),
      { width, height }
    );

    const cycle = SoulsData.getCycle(floor);
    const moveEveryTicks = Math.max(
      1,
      Math.round(bossDefinition.moveEveryTicks / Math.max(1, cycle * 0.22)) +
      (bossDefinition.speedPenaltyTicks ?? 0)
    );

    return {
      x: position.x,
      y: position.y,
      direction: "LEFT",
      tickCounter: 0,
      moveEveryTicks,
      hazardCounter: 0,
      teleportCounter: 0,
      patternCounter: 0,
      id: bossDefinition.id,
      style: bossDefinition.style,
      baseHazardEveryTicks: bossDefinition.hazardEveryTicks,
      baseTeleportEveryTicks: bossDefinition.teleportEveryTicks,
      width,
      height,
      size: width === height ? width : undefined,
      speedPenaltyTicks: bossDefinition.speedPenaltyTicks ?? 0,
      reentryCooldownMs: 0,
      hunterBoost:
        bossDefinition.id === "cacador"
          ? {
            phase: HUNTER_BOOST_PHASE_READY,
            msRemaining: 0,
          }
          : null,
    };
  }

  function getSoulsMinionBlockBase(withinCycle) {
    const safeWithinCycle = Math.max(1, withinCycle);
    const blockIndex = Math.floor((safeWithinCycle - 1) / 3);
    if (blockIndex <= 0) {
      return 0;
    }
    return Math.min(6, blockIndex * 2);
  }

  function getSoulsMinionCount(stageType, bossOrdinal, cycle, withinCycle = 1) {
    const safeWithinCycle = Math.max(1, withinCycle);
    const withinBlock = ((safeWithinCycle - 1) % 3) + 1;
    const blockBase = getSoulsMinionBlockBase(safeWithinCycle);

    if (withinBlock === 1) {
      return blockBase;
    }

    if (withinBlock === 2) {
      return Math.min(8, blockBase + 1);
    }

    return Math.min(8, blockBase + 3);
  }

  function shouldResetMinionsOnTransition(previousFloor, nextFloor) {
    const previousWithinCycle = SoulsData.getWithinCycle(previousFloor);
    const nextWithinCycle = SoulsData.getWithinCycle(nextFloor);
    const endedBoss =
      previousWithinCycle === 3 ||
      previousWithinCycle === 6 ||
      previousWithinCycle === 9 ||
      previousWithinCycle === 12;
    return endedBoss && previousWithinCycle !== nextWithinCycle;
  }

  function createSoulsMinionEntity(id, anchor, source = null) {
    const direction =
      source && SnakeLogic.DIRECTION_VECTORS[source.direction]
        ? source.direction
        : "LEFT";
    return {
      id,
      x: anchor.x,
      y: anchor.y,
      direction,
      tickCounter: 0,
      moveEveryTicks: Math.max(1, Math.floor(source?.moveEveryTicks ?? 1)),
      width: 1,
      height: 1,
      style: source?.style ?? "aggressive",
      reentryCooldownMs: 0,
    };
  }

  function createMinionIdFactory(minions) {
    const usedIds = new Set();
    let maxNumericId = 0;
    if (Array.isArray(minions)) {
      for (const minion of minions) {
        if (!minion || typeof minion.id !== "string") {
          continue;
        }
        usedIds.add(minion.id);
        const numericMatch = /^minion-(\d+)$/.exec(minion.id);
        if (numericMatch) {
          maxNumericId = Math.max(maxNumericId, Number(numericMatch[1]));
        }
      }
    }

    return function getNextMinionId() {
      let candidate = "";
      do {
        maxNumericId += 1;
        candidate = `minion-${maxNumericId}`;
      } while (usedIds.has(candidate));
      usedIds.add(candidate);
      return candidate;
    };
  }

  function rebalanceSoulsMinions(base, barriers, enemy, previousMinions, desiredCount, rng) {
    const targetCount = Math.max(0, Math.floor(desiredCount));
    if (targetCount <= 0) {
      return [];
    }

    const source = Array.isArray(previousMinions) ? previousMinions : [];
    const getNextMinionId = createMinionIdFactory(source);
    const assignedIds = new Set();
    const nextMinions = [];

    for (const minion of source) {
      if (!minion || nextMinions.length >= targetCount) {
        continue;
      }
      let minionId = typeof minion.id === "string" ? minion.id : getNextMinionId();
      if (assignedIds.has(minionId)) {
        minionId = getNextMinionId();
      }
      assignedIds.add(minionId);

      const sourceX = Number(minion.x);
      const sourceY = Number(minion.y);
      let anchor = {
        x: Number.isFinite(sourceX) ? Math.floor(sourceX) : base.snake[0].x,
        y: Number.isFinite(sourceY) ? Math.floor(sourceY) : base.snake[0].y,
      };
      const blockedForKeep = buildStageBlockedSet(
        base,
        barriers,
        enemy,
        nextMinions,
        [],
        null,
        null
      );
      if (blockedForKeep.has(keyForPosition(anchor))) {
        anchor = pickSpawnAroundHead(base, blockedForKeep, rng, 10 + nextMinions.length * 2, {
          width: 1,
          height: 1,
        });
      }

      nextMinions.push(createSoulsMinionEntity(minionId, anchor, minion));
    }

    while (nextMinions.length < targetCount) {
      const blocked = buildStageBlockedSet(base, barriers, enemy, nextMinions, [], null, null);
      const anchor = pickSpawnAroundHead(base, blocked, rng, 10 + nextMinions.length * 2, {
        width: 1,
        height: 1,
      });
      nextMinions.push(createSoulsMinionEntity(getNextMinionId(), anchor));
    }

    return nextMinions;
  }

  function spawnSoulsMinions(
    base,
    barriers,
    enemy,
    stageType,
    bossOrdinal,
    cycle,
    withinCycle,
    rng
  ) {
    const count = getSoulsMinionCount(stageType, bossOrdinal, cycle, withinCycle);
    if (count <= 0) {
      return [];
    }

    const minions = [];
    for (let i = 0; i < count; i += 1) {
      const blocked = buildStageBlockedSet(base, barriers, enemy, minions, [], null, null);
      const anchor = pickSpawnAroundHead(base, blocked, rng, 10 + i * 2, {
        width: 1,
        height: 1,
      });
      minions.push(createSoulsMinionEntity(`minion-${i + 1}`, anchor));
    }

    return minions;
  }

  function getStageDescriptor(floor) {
    const stageType = SoulsData.getStageType(floor);
    const cycle = SoulsData.getCycle(floor);
    const withinCycle = SoulsData.getWithinCycle(floor);
    const bossOrdinal = SoulsData.getBossOrdinal(floor);
    const bossDefinition = SoulsData.getBossDefinition(floor);

    return {
      stageType,
      cycle,
      withinCycle,
      bossOrdinal,
      bossDefinition,
    };
  }

  function createSoulsWorldSession(stage) {
    if (!SoulsWorld) {
      return null;
    }

    return SoulsWorld.createWorldSession({
      seed: (stage.cycle << 12) + stage.withinCycle * 97,
      chunkSize: SOULS_CHUNK_SIZE,
      activeRadius: SOULS_ACTIVE_RADIUS,
      stageType: stage.stageType,
      cycle: stage.cycle,
    });
  }

  function updateSoulsCameraAndWorld(base, souls, stageType, viewportAspect = 1) {
    const camera = buildSoulsCamera(base.snake[0], stageType, viewportAspect);
    if (!souls.world || !SoulsWorld) {
      return { camera, barriers: [] };
    }

    souls.world.stageType = stageType;
    souls.world.cycle = souls.cycle;
    SoulsWorld.updateActiveChunks(souls.world, {
      x: camera.centerX,
      y: camera.centerY,
    });
    const visible = SoulsWorld.getVisibleEntities(souls.world, camera, stageType);
    return {
      camera,
      barriers: visible.barriers ?? [],
    };
  }

  function buildSoulsSigilIndicator(base, souls) {
    if (!souls.camera) {
      return {
        visible: false,
        angleDeg: 0,
        leftPercent: 50,
        topPercent: 50,
        distance: 0,
      };
    }

    const target =
      souls.objectiveType === "sigil"
        ? souls.sigil
        : souls.objectiveType === "food"
          ? base.food
          : null;
    if (!target) {
      return {
        visible: false,
        angleDeg: 0,
        leftPercent: 50,
        topPercent: 50,
        distance: 0,
      };
    }

    const head = base.snake[0];
    const dx = target.x - head.x;
    const dy = target.y - head.y;
    const distance = manhattanDistance(head, target);
    const inView = SoulsWorld?.isPositionInCamera
      ? SoulsWorld.isPositionInCamera(target, souls.camera, 0)
      : false;
    if (inView) {
      return {
        visible: false,
        angleDeg: 0,
        leftPercent: 50,
        topPercent: 50,
        distance,
      };
    }

    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const leftPercent = clamp(50 + cos * 42, 6, 94);
    const topPercent = clamp(50 + sin * 42, 6, 94);

    return {
      visible: true,
      angleDeg: (angle * 180) / Math.PI,
      leftPercent,
      topPercent,
      distance,
    };
  }

  function createStageFlowState(phase = "idle", options = {}) {
    return {
      phase,
      message: options.message ?? "",
      msRemaining: Math.max(0, options.msRemaining ?? 0),
      nextFloor: options.nextFloor ?? null,
    };
  }

  function getSoulsArmorPerStage(souls) {
    const snake = getSnakeDefinition(souls);
    const snakeArmor = snake?.extraArmorPerStage ?? 0;
    const muralha = getPowerStack(souls, "muralha");
    return snakeArmor + muralha;
  }

  function hasGhostAvailable(souls) {
    return hasPower(souls, "passo_fantasma") && souls.ghostCooldownMs <= 0;
  }

  function consumeGhost(souls) {
    souls.ghostCooldownMs = SoulsData.GHOST_COOLDOWN_MS;
  }

  function createSoulsStageState(state, floor, rng, options = {}) {
    const stage = getStageDescriptor(floor);
    const snakeDefinition = getSnakeDefinition(state.souls);
    const viewportAspect = normalizeSoulsViewportAspect(
      options.viewportAspect ?? state.souls.viewportAspect ?? 1
    );
    const viewport = getSoulsViewportDimensions(stage.stageType, viewportAspect);
    const base = {
      width: viewport.width,
      height: viewport.height,
      snake: [
        { x: 0, y: 0 },
        { x: -1, y: 0 },
        { x: -2, y: 0 },
      ],
      direction: "RIGHT",
      inputQueue: [],
      food: null,
      score: state.base.score,
      isGameOver: false,
      isPaused: false,
    };

    const world = createSoulsWorldSession(stage);
    const stageSouls = {
      ...state.souls,
      floor,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      stageType: stage.stageType,
      world,
      viewportAspect,
    };
    const cameraResult = updateSoulsCameraAndWorld(
      base,
      stageSouls,
      stage.stageType,
      viewportAspect
    );
    const barriers = cameraResult.barriers;
    const hazards = [];
    const enemy = spawnSoulsEnemy(
      base,
      barriers,
      [],
      floor,
      stage.stageType,
      stage.bossDefinition,
      rng
    );
    const minions = spawnSoulsMinions(
      base,
      barriers,
      enemy,
      stage.stageType,
      stage.bossOrdinal,
      stage.cycle,
      stage.withinCycle,
      rng
    );

    let food = null;
    let sigil = null;

    if (stage.stageType === "normal") {
      food = spawnSoulsFood(
        base,
        stageSouls,
        barriers,
        enemy,
        minions,
        hazards,
        null,
        null,
        rng
      );
    } else {
      sigil = spawnSoulsSigil(
        base,
        stageSouls,
        barriers,
        enemy,
        minions,
        hazards,
        null,
        rng
      );
    }

    const objectiveTarget = SoulsData.getObjectiveTarget(
      floor,
      stage.stageType,
      snakeDefinition
    );

    const snakeSpeedCps = getSoulsSnakeSpeedCps(
      floor,
      stage.stageType,
      state.souls
    );
    const enemyBaseSnakeSpeedCps = getSoulsEnemyReferenceBaseSpeedCps(
      floor,
      stage.stageType
    );
    const enemyNormalSnakeSpeedCps = getSoulsEnemyReferenceNormalSpeedCps(
      floor,
      stage.stageType
    );
    const tickMs = Math.max(SoulsData.MIN_TICK_MS, Math.round(1000 / snakeSpeedCps));

    const echo =
      floor === 1 && stage.stageType === "normal"
        ? spawnSoulsEcho(
          base,
          stageSouls,
          barriers,
          enemy,
          minions,
          hazards,
          sigil,
          state.souls.profile.pendingEcho,
          rng
        )
        : null;

    const nextBase = {
      ...base,
      food,
      score: state.base.score,
      isGameOver: false,
      isPaused: false,
    };
    const initialStageFlow =
      options.includeCountdown === true
        ? createStageFlowState("countdown", {
          msRemaining: SOULS_COUNTDOWN_MS,
        })
        : createStageFlowState("idle");

    return {
      base: nextBase,
      barriers,
      enemy,
      stageType: stage.stageType,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      bossOrdinal: stage.bossOrdinal,
      bossName: stage.bossDefinition?.name ?? null,
      objectiveType: stage.stageType === "normal" ? "food" : "sigil",
      objectiveProgress: 0,
      objectiveTarget,
      sigil,
      sigilRespawnMsRemaining: 0,
      hazards,
      enemyTeleportPreview: null,
      echo,
      minions,
      camera: cameraResult.camera,
      world,
      stageFlow: initialStageFlow,
      viewportAspect,
      sigilIndicator: buildSoulsSigilIndicator({ ...base, food }, {
        ...stageSouls,
        camera: cameraResult.camera,
        sigil,
        objectiveType: stage.stageType === "normal" ? "food" : "sigil",
      }),
      tickMs,
      snakeSpeedCps,
      enemySpeedCps: getSoulsEnemySpeedCps(enemy, {
        snakeBaseCps: enemyBaseSnakeSpeedCps,
        snakeNormalCps: enemyNormalSnakeSpeedCps,
      }),
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
      armorCharges: getSoulsArmorPerStage(state.souls),
      stamina: createSoulsStaminaState(state.souls, { current: "max" }),
      countdownMsRemaining:
        initialStageFlow.phase === "countdown" ? initialStageFlow.msRemaining : 0,
    };
  }

  function getAvailablePowerIds(souls) {
    const available = [];
    for (const power of SoulsData.POWER_POOL) {
      const stack = getPowerStack(souls, power.id);
      if (stack < power.maxStacks) {
        available.push(power.id);
      }
    }
    return available;
  }

  function rollPowerOptions(souls, rng) {
    const available = getAvailablePowerIds(souls);
    if (available.length === 0) {
      return [];
    }

    const pool = [...available];
    const options = [];
    const count = Math.min(3, pool.length);

    for (let i = 0; i < count; i += 1) {
      const index = clampIndex(Math.floor(rng() * pool.length), pool.length);
      options.push(pool[index]);
      pool.splice(index, 1);
    }

    return options;
  }

  function buildSoulsModeState(options = {}) {
    if (!SoulsData || !SoulsProfile) {
      throw new Error("Souls mode requires SoulsData and SoulsProfile modules.");
    }
    if (!SoulsWorld) {
      throw new Error("Souls mode requires SoulsWorld module.");
    }

    const rng = options.rng ?? Math.random;
    const sourceProfile = options.soulsProfile ?? SoulsProfile.createDefaultProfile();
    const sanitizedProfile = SoulsProfile.sanitizeProfile(sourceProfile);
    const requestedSnakeId = options.soulsSnakeId ?? sanitizedProfile.selectedSnakeId;
    const selectedSnakeId = sanitizedProfile.unlockedSnakeIds.includes(requestedSnakeId)
      ? requestedSnakeId
      : SoulsData.DEFAULT_SNAKE_ID;
    const profile = SoulsProfile.selectSnake(sanitizedProfile, selectedSnakeId);

    const viewportAspect = normalizeSoulsViewportAspect(options.viewportAspect ?? 1);
    const initialViewport = getSoulsViewportDimensions("normal", viewportAspect);

    const state = {
      mode: "souls",
      base: {
        width: initialViewport.width,
        height: initialViewport.height,
        snake: [
          { x: 0, y: 0 },
          { x: -1, y: 0 },
          { x: -2, y: 0 },
        ],
        direction: "RIGHT",
        inputQueue: [],
        food: null,
        score: 0,
        isGameOver: false,
        isPaused: false,
      },
      level: null,
      levelProgress: 0,
      levelTarget: 0,
      tickMs: 140,
      barriers: [],
      enemy: null,
      powerUp: null,
      shieldMsRemaining: 0,
      isGameOver: false,
      isPaused: false,
      souls: {
        floor: 1,
        cycle: 1,
        withinCycle: 1,
        stageType: "normal",
        bossOrdinal: null,
        bossName: null,
        objectiveType: "food",
        objectiveProgress: 0,
        objectiveTarget: 0,
        carriedRunes: 0,
        profile,
        selectedSnakeId,
        powers: {},
        reward: null,
        rewardRerolled: false,
        sigil: null,
        sigilRespawnMsRemaining: 0,
        hazards: [],
        enemyTeleportPreview: null,
        echo: null,
        minions: [],
        camera: buildSoulsCamera({ x: 0, y: 0 }, "normal", viewportAspect),
        world: null,
        stageFlow: createStageFlowState("idle"),
        viewportAspect,
        sigilIndicator: {
          visible: false,
          angleDeg: 0,
          leftPercent: 50,
          topPercent: 50,
          distance: 0,
        },
        snakeSpeedCps: 0,
        enemySpeedCps: 0,
        snakeMoveAccumulatorMs: 0,
        enemyMoveAccumulatorMs: 0,
        armorCharges: 0,
        stamina: createSoulsStaminaState(
          { powers: {} },
          { current: STAMINA_MAX_BASE }
        ),
        ghostCooldownMs: 0,
        directionLockMsRemaining: 0,
        lastDeathRunes: 0,
        lastDeathEcho: 0,
        countdownMsRemaining: 0,
      },
    };

    const stageState = createSoulsStageState(state, 1, rng, {
      includeCountdown: false,
      viewportAspect,
    });

    state.base = stageState.base;
    state.tickMs = stageState.tickMs;
    state.barriers = stageState.barriers;
    state.enemy = stageState.enemy;
    state.souls.stageType = stageState.stageType;
    state.souls.cycle = stageState.cycle;
    state.souls.withinCycle = stageState.withinCycle;
    state.souls.bossOrdinal = stageState.bossOrdinal;
    state.souls.bossName = stageState.bossName;
    state.souls.objectiveType = stageState.objectiveType;
    state.souls.objectiveTarget = stageState.objectiveTarget;
    state.souls.objectiveProgress = stageState.objectiveProgress;
    state.souls.sigil = stageState.sigil;
    state.souls.sigilRespawnMsRemaining = stageState.sigilRespawnMsRemaining;
    state.souls.hazards = stageState.hazards;
    state.souls.enemyTeleportPreview = stageState.enemyTeleportPreview;
    state.souls.echo = stageState.echo;
    state.souls.minions = stageState.minions;
    state.souls.camera = stageState.camera;
    state.souls.world = stageState.world;
    state.souls.stageFlow = stageState.stageFlow;
    state.souls.sigilIndicator = stageState.sigilIndicator;
    state.souls.snakeSpeedCps = stageState.snakeSpeedCps;
    state.souls.enemySpeedCps = stageState.enemySpeedCps;
    state.souls.snakeMoveAccumulatorMs = stageState.snakeMoveAccumulatorMs;
    state.souls.enemyMoveAccumulatorMs = stageState.enemyMoveAccumulatorMs;
    state.souls.armorCharges = stageState.armorCharges;
    state.souls.stamina = stageState.stamina;
    state.souls.countdownMsRemaining = stageState.countdownMsRemaining;
    state.souls.viewportAspect = stageState.viewportAspect ?? viewportAspect;

    return state;
  }

  function createModeState(options = {}) {
    const mode =
      options.mode === "levels"
        ? "levels"
        : options.mode === "souls"
          ? "souls"
          : "traditional";

    if (mode === "levels") {
      return createLevelsModeState(options);
    }

    if (mode === "souls") {
      return buildSoulsModeState(options);
    }

    return createTraditionalModeState(options);
  }

  function queueModeDirection(state, direction) {
    if (state.mode !== "souls") {
      const nextBase = SnakeLogic.queueDirection(state.base, direction);
      return {
        ...state,
        base: nextBase,
      };
    }

    if (state.souls.directionLockMsRemaining > 0) {
      return state;
    }

    const nextBase = SnakeLogic.queueDirection(state.base, direction);
    const snake = getSnakeDefinition(state.souls);
    const changed = nextBase.inputQueue.length > state.base.inputQueue.length;

    return {
      ...state,
      base: nextBase,
      souls: {
        ...state.souls,
        directionLockMsRemaining:
          changed && snake?.directionLockTicks
            ? Math.round(
              snake.directionLockTicks *
              (1000 / Math.max(0.1, state.souls.snakeSpeedCps || 1))
            )
            : 0,
      },
    };
  }

  function toggleModePause(state) {
    if (state.mode === "souls" && state.souls.reward) {
      return state;
    }

    const nextBase = SnakeLogic.togglePause(state.base);
    return {
      ...state,
      base: nextBase,
      isPaused: nextBase.isPaused,
    };
  }

  function restartModeState(state, options = {}) {
    const rng = options.rng ?? Math.random;

    if (state.mode === "souls") {
      return createModeState({
        mode: "souls",
        soulsProfile: state.souls.profile,
        soulsSnakeId: state.souls.selectedSnakeId,
        viewportAspect:
          options.viewportAspect ?? state.souls.viewportAspect ?? 1,
        rng,
      });
    }

    if (state.mode === "traditional" && state.shooter) {
      return createModeState({
        mode: state.mode,
        viewportAspect: options.viewportAspect ?? 1,
        rng,
      });
    }

    return createModeState({
      mode: state.mode,
      width: state.base.width,
      height: state.base.height,
      rng,
    });
  }

  function reduceSoulsCooldowns(souls, deltaMs) {
    if (souls.ghostCooldownMs > 0) {
      souls.ghostCooldownMs = Math.max(0, souls.ghostCooldownMs - deltaMs);
    }

    if (souls.directionLockMsRemaining > 0) {
      souls.directionLockMsRemaining = Math.max(
        0,
        souls.directionLockMsRemaining - deltaMs
      );
    }
  }

  function normalizeHazards(hazards, deltaMs) {
    return hazards
      .map((hazard) => ({
        ...hazard,
        ttlMs: (hazard.ttlMs ?? HAZARD_TTL_MS) - deltaMs,
      }))
      .filter((hazard) => hazard.ttlMs > 0)
      .map((hazard) => ({ x: hazard.x, y: hazard.y, ttlMs: hazard.ttlMs }));
  }

  function addHazardPulse(base, enemy, hazards) {
    if (!enemy) return hazards;

    const candidates = [];
    for (const enemyCell of getEnemyCells(enemy)) {
      candidates.push({ x: enemyCell.x - 1, y: enemyCell.y });
      candidates.push({ x: enemyCell.x + 1, y: enemyCell.y });
      candidates.push({ x: enemyCell.x, y: enemyCell.y - 1 });
      candidates.push({ x: enemyCell.x, y: enemyCell.y + 1 });
    }

    const next = [...hazards];
    for (const candidate of candidates) {
      if (containsPosition(next, candidate)) {
        continue;
      }

      next.push({ ...candidate, ttlMs: HAZARD_TTL_MS });
    }

    return next;
  }

  function canEnemyMoveTo(base, candidate, enemy, minions, barriers, hazards) {
    const nextEnemy = {
      ...enemy,
      x: candidate.x,
      y: candidate.y,
    };

    for (const enemyCell of getEnemyCells(nextEnemy)) {
      if (containsPosition(base.snake.slice(1), enemyCell)) {
        return false;
      }

      if (containsPosition(barriers, enemyCell)) {
        return false;
      }

      if (containsPosition(hazards, enemyCell)) {
        return false;
      }

      if (base.food && arePositionsEqual(base.food, enemyCell)) {
        return false;
      }

      if (Array.isArray(minions)) {
        for (const other of minions) {
          if (!other || other.id === enemy.id) continue;
          if (enemyOccupiesPosition(other, enemyCell)) {
            return false;
          }
        }
      }
    }

    return true;
  }

  function listTeleportAnchorsForEnemy(
    enemy,
    base,
    barriers,
    minions,
    hazards,
    sigil,
    echo,
    camera,
    enemyTeleportPreview = null
  ) {
    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
      minions,
      hazards,
      sigil,
      echo,
      enemyTeleportPreview
    );
    for (const currentCell of getEnemyCells(enemy)) {
      blocked.delete(keyForPosition(currentCell));
    }

    const candidates = [];
    const footprint = getEnemyFootprint(enemy);
    const fallbackCamera = {
      centerX: base.snake[0].x,
      centerY: base.snake[0].y,
      width: Math.max(3, Math.floor(base.width || SOULS_VIEWPORT_NORMAL)),
      height: Math.max(3, Math.floor(base.height || SOULS_VIEWPORT_NORMAL)),
    };
    const bounds =
      SoulsWorld?.getCameraBounds(camera ?? fallbackCamera, 4) ?? {
        minX: base.snake[0].x - 16,
        maxX: base.snake[0].x + 16,
        minY: base.snake[0].y - 16,
        maxY: base.snake[0].y + 16,
      };
    for (let y = bounds.minY; y <= bounds.maxY - footprint.height + 1; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX - footprint.width + 1; x += 1) {
        let canUse = true;
        for (let dy = 0; dy < footprint.height; dy += 1) {
          for (let dx = 0; dx < footprint.width; dx += 1) {
            const cellKey = `${x + dx},${y + dy}`;
            if (blocked.has(cellKey)) {
              canUse = false;
              break;
            }
          }
          if (!canUse) break;
        }
        if (canUse) {
          candidates.push({ x, y });
        }
      }
    }

    return candidates;
  }

  function pickTeleportAnchorForEnemy(
    enemy,
    base,
    barriers,
    minions,
    hazards,
    sigil,
    echo,
    camera,
    rng,
    options = {}
  ) {
    const candidates = listTeleportAnchorsForEnemy(
      enemy,
      base,
      barriers,
      minions,
      hazards,
      sigil,
      echo,
      camera,
      options.enemyTeleportPreview
    );
    if (candidates.length === 0) {
      return null;
    }

    let pool = candidates;
    if (options.preferNearTarget && options.target) {
      const footprint = getEnemyFootprint(enemy);
      const maxDistance = Math.max(
        0,
        options.maxDistance ?? ESPECTRO_TELEPORT_MAX_DISTANCE
      );
      const nearby = candidates.filter(
        (anchor) =>
          getAnchorDistanceToPosition(anchor, footprint, options.target) <=
          maxDistance
      );
      if (nearby.length > 0) {
        pool = nearby;
      }
    }

    const index = clampIndex(Math.floor(rng() * pool.length), pool.length);
    return pool[index];
  }

  function applyEnemyTeleportAnchor(enemy, anchor) {
    if (!enemy || !anchor) {
      return enemy;
    }

    return {
      ...enemy,
      x: anchor.x,
      y: anchor.y,
      tickCounter: 0,
    };
  }

  function teleportEnemy(
    enemy,
    base,
    barriers,
    minions,
    hazards,
    sigil,
    echo,
    camera,
    rng,
    options = {}
  ) {
    const anchor = pickTeleportAnchorForEnemy(
      enemy,
      base,
      barriers,
      minions,
      hazards,
      sigil,
      echo,
      camera,
      rng,
      options
    );
    if (!anchor) {
      return enemy;
    }

    return applyEnemyTeleportAnchor(enemy, anchor);
  }

  function moveSoulsEnemy(enemy, souls, base, barriers, hazards, rng) {
    if (!enemy) return enemy;

    const head = base.snake[0];
    let nextEnemy = {
      ...enemy,
      tickCounter: enemy.tickCounter + 1,
      patternCounter: enemy.patternCounter + 1,
      hazardCounter: enemy.hazardCounter + 1,
      teleportCounter: enemy.teleportCounter + 1,
    };

    if (
      enemy.baseTeleportEveryTicks > 0 &&
      nextEnemy.teleportCounter >= enemy.baseTeleportEveryTicks
    ) {
      if (enemy.id === "espectro") {
        if (!souls.enemyTeleportPreview) {
          const anchor = pickTeleportAnchorForEnemy(
            nextEnemy,
            base,
            barriers,
            souls.minions,
            hazards,
            souls.sigil,
            souls.echo,
            souls.camera,
            rng,
            {
              preferNearTarget: true,
              target: head,
              maxDistance: ESPECTRO_TELEPORT_MAX_DISTANCE,
              enemyTeleportPreview: souls.enemyTeleportPreview,
            }
          );
          if (anchor) {
            const footprint = getEnemyFootprint(nextEnemy);
            souls.enemyTeleportPreview = {
              x: anchor.x,
              y: anchor.y,
              width: footprint.width,
              height: footprint.height,
              msRemaining: ESPECTRO_TELEPORT_PREVIEW_MS,
              enemyId: nextEnemy.id,
            };
          }
        }
      } else {
        nextEnemy = teleportEnemy(
          nextEnemy,
          base,
          barriers,
          souls.minions,
          hazards,
          souls.sigil,
          souls.echo,
          souls.camera,
          rng,
          { enemyTeleportPreview: souls.enemyTeleportPreview }
        );
      }
      nextEnemy.teleportCounter = 0;
    }

    if (nextEnemy.tickCounter < enemy.moveEveryTicks) {
      return nextEnemy;
    }

    nextEnemy.tickCounter = 0;
    nextEnemy = tryActivateHunterBoost(nextEnemy, head);
    const directions = orderedSoulsEnemyDirections(nextEnemy, head);

    for (const direction of directions) {
      const vector = SnakeLogic.DIRECTION_VECTORS[direction];
      const candidate = {
        x: nextEnemy.x + vector.x,
        y: nextEnemy.y + vector.y,
      };
      if (
        !canEnemyMoveTo(
          base,
          candidate,
          nextEnemy,
          souls.minions,
          barriers,
          hazards
        )
      ) {
        continue;
      }

      nextEnemy.x = candidate.x;
      nextEnemy.y = candidate.y;
      nextEnemy.direction = direction;
      return nextEnemy;
    }

    return nextEnemy;
  }

  function moveSoulsMinions(minions, souls, base, barriers, hazards, rng, deltaMs) {
    if (!Array.isArray(minions) || minions.length === 0) {
      return [];
    }

    const blocked = buildStageBlockedSet(base, barriers, souls.enemy, minions, hazards, souls.sigil, souls.echo);
    const next = [];

    for (const minion of minions) {
      if (!minion) continue;
      let nextMinion = {
        ...minion,
        tickCounter: (minion.tickCounter ?? 0) + 1,
      };

      const moveEveryTicks = Math.max(1, minion.moveEveryTicks ?? 1);
      if (nextMinion.tickCounter >= moveEveryTicks) {
        nextMinion.tickCounter = 0;
        const directions = orderedSoulsEnemyDirections(nextMinion, base.snake[0]);
        for (const direction of directions) {
          const vector = SnakeLogic.DIRECTION_VECTORS[direction];
          const candidate = {
            x: nextMinion.x + vector.x,
            y: nextMinion.y + vector.y,
          };
          if (
            !canEnemyMoveTo(base, candidate, nextMinion, next, barriers, hazards) ||
            blocked.has(keyForPosition(candidate))
          ) {
            continue;
          }

          nextMinion = {
            ...nextMinion,
            x: candidate.x,
            y: candidate.y,
            direction,
          };
          break;
        }
      }

      if (SoulsWorld && souls.camera) {
        nextMinion = SoulsWorld.reenterEnemyAtEdge(
          souls.world,
          nextMinion,
          base.snake[0],
          souls.camera,
          SOULS_REENTRY_COOLDOWN_MS,
          blocked,
          deltaMs
        );
      }

      next.push(nextMinion);
    }

    return next;
  }

  function tryMitigateSoulsCollision(souls) {
    if (souls.armorCharges > 0) {
      souls.armorCharges -= 1;
      return true;
    }

    if (hasGhostAvailable(souls)) {
      consumeGhost(souls);
      return true;
    }

    return false;
  }

  function createSoulsGameOver(state, nextBase, souls) {
    const lostRunes = souls.carriedRunes;
    const updatedProfile = SoulsProfile.applyDeathEcho(souls.profile, lostRunes);

    const nextSouls = {
      ...souls,
      profile: updatedProfile,
      carriedRunes: 0,
      lastDeathRunes: lostRunes,
      lastDeathEcho: updatedProfile.pendingEcho?.runes ?? 0,
      enemyTeleportPreview: null,
      reward: null,
      stageFlow: createStageFlowState("idle"),
      countdownMsRemaining: 0,
    };

    return {
      ...state,
      base: {
        ...nextBase,
        isGameOver: true,
      },
      isGameOver: true,
      isPaused: false,
      souls: nextSouls,
    };
  }

  function createSoulsStageMessageFlow(message) {
    if (typeof message !== "string" || message.trim().length === 0) {
      return createStageFlowState("idle");
    }
    return createStageFlowState("message", {
      message: message.trim(),
      msRemaining: SOULS_STAGE_MESSAGE_MS,
    });
  }

  function transitionSoulsFloorInPlace(state, currentBase, souls, floor, rng, options = {}) {
    const stage = getStageDescriptor(floor);
    const snakeDefinition = getSnakeDefinition(souls);
    const viewportAspect = normalizeSoulsViewportAspect(
      options.viewportAspect ?? souls.viewportAspect ?? state.souls.viewportAspect ?? 1
    );
    const viewport = getSoulsViewportDimensions(stage.stageType, viewportAspect);
    const keepCurrentObstacles = options.keepCurrentObstacles !== false;
    const resetMinions =
      options.resetMinions === true || shouldResetMinionsOnTransition(souls.floor, floor);
    const sourceMinions = resetMinions ? [] : souls.minions;

    const nextBase = {
      ...currentBase,
      width: viewport.width,
      height: viewport.height,
      food: null,
      isGameOver: false,
      isPaused: false,
    };
    const nextSouls = {
      ...souls,
      floor,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      stageType: stage.stageType,
      bossOrdinal: stage.bossOrdinal,
      bossName: stage.bossDefinition?.name ?? null,
      objectiveType: stage.stageType === "normal" ? "food" : "sigil",
      objectiveProgress: 0,
      objectiveTarget: SoulsData.getObjectiveTarget(floor, stage.stageType, snakeDefinition),
      sigil: null,
      sigilRespawnMsRemaining: 0,
      hazards: [],
      enemyTeleportPreview: null,
      echo: null,
      reward: null,
      rewardRerolled: false,
      world: souls.world ?? createSoulsWorldSession(stage),
      viewportAspect,
      stageFlow: createSoulsStageMessageFlow(options.message ?? ""),
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
      armorCharges: getSoulsArmorPerStage(souls),
      stamina: createSoulsStaminaState(souls, { current: "max" }),
      countdownMsRemaining: 0,
    };
    const camera = buildSoulsCamera(nextBase.snake[0], stage.stageType, viewportAspect);
    nextSouls.camera = camera;
    if (nextSouls.world && SoulsWorld) {
      nextSouls.world.stageType = stage.stageType;
      nextSouls.world.cycle = stage.cycle;
      SoulsWorld.updateActiveChunks(nextSouls.world, {
        x: camera.centerX,
        y: camera.centerY,
      });
    }

    let barriers =
      keepCurrentObstacles && Array.isArray(state.barriers)
        ? clonePositions(state.barriers)
        : [];
    if (barriers.length === 0) {
      const cameraResult = updateSoulsCameraAndWorld(
        nextBase,
        nextSouls,
        stage.stageType,
        viewportAspect
      );
      nextSouls.camera = cameraResult.camera;
      barriers = cameraResult.barriers ?? [];
    }

    const minionTarget = getSoulsMinionCount(
      stage.stageType,
      stage.bossOrdinal,
      stage.cycle,
      stage.withinCycle
    );
    let minions = rebalanceSoulsMinions(
      nextBase,
      barriers,
      null,
      sourceMinions,
      minionTarget,
      rng
    );
    const enemy = spawnSoulsEnemy(
      nextBase,
      barriers,
      minions,
      floor,
      stage.stageType,
      stage.bossDefinition,
      rng
    );
    minions = rebalanceSoulsMinions(
      nextBase,
      barriers,
      enemy,
      minions,
      minionTarget,
      rng
    );

    if (nextSouls.objectiveType === "food") {
      nextBase.food = spawnSoulsFood(
        nextBase,
        nextSouls,
        barriers,
        enemy,
        minions,
        nextSouls.hazards,
        null,
        nextSouls.echo,
        rng
      );
      if (!nextBase.food) {
        return createSoulsGameOver(state, nextBase, nextSouls);
      }
    } else {
      nextSouls.sigil = spawnSoulsSigil(
        nextBase,
        nextSouls,
        barriers,
        enemy,
        minions,
        nextSouls.hazards,
        nextSouls.echo,
        rng
      );
      if (!nextSouls.sigil) {
        return createSoulsGameOver(state, nextBase, nextSouls);
      }
    }

    nextSouls.minions = minions;
    nextSouls.snakeSpeedCps = getSoulsSnakeSpeedCps(floor, stage.stageType, nextSouls);
    nextSouls.enemySpeedCps = enemy
      ? getSoulsEnemySpeedCps(enemy, {
        snakeBaseCps: getSoulsEnemyReferenceBaseSpeedCps(floor, stage.stageType),
        snakeNormalCps: getSoulsEnemyReferenceNormalSpeedCps(floor, stage.stageType),
      })
      : 0;
    nextSouls.sigilIndicator = buildSoulsSigilIndicator(nextBase, nextSouls);

    return {
      ...state,
      base: nextBase,
      tickMs: Math.max(SoulsData.MIN_TICK_MS, Math.round(1000 / nextSouls.snakeSpeedCps)),
      barriers: clonePositions(barriers),
      enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls: nextSouls,
    };
  }

  function handleSoulsStageCompletion(state, nextBase, souls, rng) {
    const nextFloor = souls.floor + 1;
    const completionLabel =
      souls.stageType === "normal"
        ? `Andar ${souls.floor} concluido`
        : `Boss ${souls.bossName ?? ""} derrotado`.trim();

    if (souls.stageType === "normal") {
      return transitionSoulsFloorInPlace(state, nextBase, souls, nextFloor, rng, {
        message: completionLabel,
      });
    }

    const defeatedBossId =
      state.enemy?.id ?? SoulsData.getBossDefinition(souls.floor)?.id ?? null;
    if (defeatedBossId) {
      souls.profile = SoulsProfile.registerBossDefeat(souls.profile, defeatedBossId);
    }

    if (souls.carriedRunes > 0) {
      souls.profile = SoulsProfile.addWalletRunes(souls.profile, souls.carriedRunes);
      souls.carriedRunes = 0;
    }

    const stageReward =
      souls.stageType === "final_boss"
        ? SoulsData.getRuneReward("finalBossWin")
        : SoulsData.getRuneReward("bossWin");
    applyRuneGain(souls, stageReward);

    if (souls.stageType === "final_boss") {
      souls.profile = SoulsProfile.registerFinalBossClear(souls.profile);
    }

    const options = rollPowerOptions(souls, rng);

    if (options.length === 0) {
      applyRuneGain(souls, SoulsData.getRuneReward("allPowersMaxed"));
      return transitionSoulsFloorInPlace(state, nextBase, souls, nextFloor, rng, {
        message: completionLabel,
      });
    }

    return {
      ...state,
      base: {
        ...nextBase,
        isGameOver: false,
        isPaused: true,
      },
      tickMs: state.tickMs,
      barriers: clonePositions(state.barriers),
      enemy: state.enemy ? { ...state.enemy } : null,
      isGameOver: false,
      isPaused: true,
      souls: {
        ...souls,
        enemyTeleportPreview: null,
        stageFlow: createStageFlowState("reward", {
          message: completionLabel,
          nextFloor,
          msRemaining: 0,
        }),
        reward: {
          options,
          rerolled: false,
          source: souls.stageType,
        },
      },
    };
  }

  function startNextSoulsFloor(
    state,
    currentBase,
    souls,
    floor,
    rng,
    options = {}
  ) {
    const includeCountdown = options.includeCountdown !== false;
    const workingState = {
      ...state,
      base: currentBase,
      souls: {
        ...souls,
        floor,
        objectiveProgress: 0,
        reward: null,
        rewardRerolled: false,
      },
    };

    const stageState = createSoulsStageState(workingState, floor, rng, {
      includeCountdown,
      viewportAspect:
        options.viewportAspect ?? souls.viewportAspect ?? state.souls.viewportAspect ?? 1,
    });

    return {
      ...workingState,
      base: {
        ...stageState.base,
        score: currentBase.score,
        isGameOver: false,
        isPaused: false,
      },
      tickMs: stageState.tickMs,
      barriers: stageState.barriers,
      enemy: stageState.enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls: {
        ...workingState.souls,
        cycle: stageState.cycle,
        withinCycle: stageState.withinCycle,
        stageType: stageState.stageType,
        bossOrdinal: stageState.bossOrdinal,
        bossName: stageState.bossName,
        objectiveType: stageState.objectiveType,
        objectiveTarget: stageState.objectiveTarget,
        objectiveProgress: stageState.objectiveProgress,
        sigil: stageState.sigil,
        sigilRespawnMsRemaining: stageState.sigilRespawnMsRemaining,
        hazards: stageState.hazards,
        enemyTeleportPreview: stageState.enemyTeleportPreview,
        echo: stageState.echo,
        minions: stageState.minions,
        camera: stageState.camera,
        world: stageState.world,
        stageFlow: stageState.stageFlow,
        viewportAspect: stageState.viewportAspect,
        sigilIndicator: stageState.sigilIndicator,
        snakeSpeedCps: stageState.snakeSpeedCps,
        enemySpeedCps: stageState.enemySpeedCps,
        snakeMoveAccumulatorMs: stageState.snakeMoveAccumulatorMs,
        enemyMoveAccumulatorMs: stageState.enemyMoveAccumulatorMs,
        armorCharges: stageState.armorCharges,
        stamina: stageState.stamina,
        countdownMsRemaining: stageState.countdownMsRemaining,
      },
    };
  }

  function stepSoulsState(state, options = {}) {
    if (state.isGameOver || state.souls.reward) {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const base = {
      ...state.base,
      snake: state.base.snake.map((segment) => ({ ...segment })),
      food: state.base.food ? { ...state.base.food } : null,
    };
    const souls = {
      ...state.souls,
      profile: SoulsProfile.sanitizeProfile(state.souls.profile),
      powers: { ...state.souls.powers },
      hazards: state.souls.hazards.map((hazard) => ({ ...hazard })),
      enemyTeleportPreview: state.souls.enemyTeleportPreview
        ? { ...state.souls.enemyTeleportPreview }
        : null,
      reward: state.souls.reward,
      echo: state.souls.echo
        ? {
          ...state.souls.echo,
          position: state.souls.echo.position
            ? { ...state.souls.echo.position }
            : null,
        }
        : null,
      minions: Array.isArray(state.souls.minions)
        ? state.souls.minions.map((minion) => ({ ...minion }))
        : [],
      camera: state.souls.camera ? { ...state.souls.camera } : null,
      world: state.souls.world ?? null,
      viewportAspect: normalizeSoulsViewportAspect(state.souls.viewportAspect ?? 1),
      stamina: state.souls.stamina
        ? { ...state.souls.stamina }
        : createSoulsStaminaState(state.souls, { current: "max" }),
      stageFlow: state.souls.stageFlow
        ? { ...state.souls.stageFlow }
        : createStageFlowState("idle"),
      sigilIndicator: state.souls.sigilIndicator
        ? { ...state.souls.sigilIndicator }
        : {
          visible: false,
          angleDeg: 0,
          leftPercent: 50,
          topPercent: 50,
          distance: 0,
        },
    };
    const viewportAspect = normalizeSoulsViewportAspect(
      options.viewportAspect ?? souls.viewportAspect ?? 1
    );
    souls.viewportAspect = viewportAspect;
    const viewportCamera = buildSoulsCamera(
      base.snake[0],
      souls.stageType,
      viewportAspect
    );
    base.width = viewportCamera.width;
    base.height = viewportCamera.height;
    souls.camera = viewportCamera;
    if (state.isPaused) {
      return {
        ...state,
        base,
        souls,
      };
    }

    const defaultDeltaMs = Math.max(
      state.tickMs,
      1000 / Math.max(0.1, getSoulsSnakeSpeedCps(souls.floor, souls.stageType, souls))
    );
    const deltaMs = Math.max(0, options.deltaMs ?? defaultDeltaMs);
    const holdCurrentDirection = options.holdCurrentDirection === true;

    souls.countdownMsRemaining = 0;
    if (souls.stageFlow.phase === "message") {
      souls.stageFlow.msRemaining = Math.max(0, souls.stageFlow.msRemaining - deltaMs);
      if (souls.stageFlow.msRemaining <= 0) {
        souls.stageFlow = createStageFlowState("idle");
      }
    } else if (souls.stageFlow.phase === "countdown") {
      souls.stageFlow.msRemaining = Math.max(0, souls.stageFlow.msRemaining - deltaMs);
      souls.countdownMsRemaining = souls.stageFlow.msRemaining;
      if (souls.stageFlow.msRemaining <= 0) {
        souls.countdownMsRemaining = 0;
        souls.stageFlow = createStageFlowState("idle");
      }
    } else if (souls.stageFlow.phase === "reward" && !souls.reward) {
      souls.stageFlow = createStageFlowState("idle");
    }

    const staminaRuntime = updateSoulsStaminaState(
      souls,
      deltaMs,
      holdCurrentDirection
    );
    const runtimeEnemy = updateHunterBoostRuntime(
      state.enemy ? { ...state.enemy } : null,
      deltaMs
    );
    souls.snakeSpeedCps = getSoulsSnakeSpeedCps(
      souls.floor,
      souls.stageType,
      souls,
      {
        boostActive: staminaRuntime.boostActive,
        exhausted: staminaRuntime.exhausted,
      }
    );
    souls.enemySpeedCps = runtimeEnemy
      ? getSoulsEnemySpeedCps(runtimeEnemy, {
        snakeBaseCps: getSoulsEnemyReferenceBaseSpeedCps(
          souls.floor,
          souls.stageType
        ),
        snakeNormalCps: getSoulsEnemyReferenceNormalSpeedCps(
          souls.floor,
          souls.stageType
        ),
      })
      : 0;

    reduceSoulsCooldowns(souls, deltaMs);
    souls.hazards = normalizeHazards(souls.hazards, deltaMs);
    if (souls.enemyTeleportPreview) {
      souls.enemyTeleportPreview.msRemaining = Math.max(
        0,
        souls.enemyTeleportPreview.msRemaining - deltaMs
      );
    }
    souls.snakeMoveAccumulatorMs += deltaMs;
    souls.enemyMoveAccumulatorMs += deltaMs;

    const initialCamera = updateSoulsCameraAndWorld(
      base,
      souls,
      souls.stageType,
      viewportAspect
    );
    souls.camera = initialCamera.camera;
    let barriers = initialCamera.barriers;

    const effectiveSnakeSpeedCps = souls.snakeSpeedCps;
    const snakeIntervalMs = 1000 / Math.max(0.1, effectiveSnakeSpeedCps);
    const enemyIntervalMs = getSoulsEnemyIntervalMs(souls);
    const minionIntervalMs =
      Array.isArray(souls.minions) && souls.minions.length > 0
        ? 1000 / Math.max(0.1, getSoulsMinionSpeedCps(souls.floor, souls.stageType))
        : Infinity;
    const pursuitIntervalMs = Number.isFinite(enemyIntervalMs)
      ? enemyIntervalMs
      : minionIntervalMs;
    const shouldMoveSnake = souls.snakeMoveAccumulatorMs >= snakeIntervalMs;
    const shouldMoveEnemy = souls.enemyMoveAccumulatorMs >= pursuitIntervalMs;
    const readyTeleportPreview =
      souls.enemyTeleportPreview &&
        souls.enemyTeleportPreview.msRemaining <= 0
        ? { ...souls.enemyTeleportPreview }
        : null;
    if (readyTeleportPreview) {
      souls.enemyTeleportPreview = null;
    }

    let nextBase = {
      ...base,
      width: initialCamera.camera.width,
      height: initialCamera.camera.height,
      isGameOver: false,
      isPaused: false,
    };

    if (shouldMoveSnake) {
      souls.snakeMoveAccumulatorMs -= snakeIntervalMs;
    }
    if (shouldMoveEnemy) {
      souls.enemyMoveAccumulatorMs -= pursuitIntervalMs;
    }

    if (!shouldMoveSnake && !shouldMoveEnemy && !readyTeleportPreview) {
      souls.sigilIndicator = buildSoulsSigilIndicator(nextBase, souls);
      return {
        ...state,
        base: nextBase,
        barriers,
        souls,
      };
    }

    const collectRange = hasPower(souls, "ima") ? 1 : 0;
    let enemy = runtimeEnemy ? { ...runtimeEnemy } : null;
    let minions = souls.minions;
    if (shouldMoveSnake) {
      const { direction, nextHead, nextQueue } = getNextHead(base);

      const willEatFood =
        souls.objectiveType === "food" &&
        base.food &&
        isWithinCollectionRange(nextHead, base.food, collectRange);
      const willCollectSigil =
        souls.objectiveType === "sigil" &&
        souls.sigil &&
        isWithinCollectionRange(nextHead, souls.sigil, collectRange);

      const shouldGrow = willEatFood || willCollectSigil;
      const nextSnake = [nextHead, ...base.snake];
      if (!shouldGrow) {
        nextSnake.pop();
      }

      const collidedWithSelf = nextSnake
        .slice(1)
        .some((segment) => arePositionsEqual(segment, nextHead));

      if (collidedWithSelf) {
        const collidedBase = {
          ...base,
          snake: nextSnake,
          direction,
          inputQueue: nextQueue,
        };
        return createSoulsGameOver(state, collidedBase, souls);
      }

      nextBase = {
        ...base,
        snake: nextSnake,
        direction,
        inputQueue: nextQueue,
        score: base.score + (willEatFood || willCollectSigil ? 1 : 0),
        isGameOver: false,
        isPaused: false,
      };

      const cameraResult = updateSoulsCameraAndWorld(
        nextBase,
        souls,
        souls.stageType,
        viewportAspect
      );
      souls.camera = cameraResult.camera;
      barriers = cameraResult.barriers;
      nextBase.width = cameraResult.camera.width;
      nextBase.height = cameraResult.camera.height;
      const hitBarrier = containsPosition(barriers, nextHead);
      const hitEnemy =
        enemyOccupiesPosition(enemy, nextHead) ||
        minions.some((minion) => enemyOccupiesPosition(minion, nextHead));
      const hitHazard = containsPosition(souls.hazards, nextHead);

      if ((hitBarrier || hitEnemy || hitHazard) && !tryMitigateSoulsCollision(souls)) {
        return createSoulsGameOver(state, nextBase, souls);
      }

      if (
        souls.echo?.position &&
        isWithinCollectionRange(nextHead, souls.echo.position, collectRange)
      ) {
        const collected = SoulsProfile.collectEcho(souls.profile);
        souls.profile = collected.profile;
        souls.carriedRunes += collected.recoveredRunes;
        souls.echo = null;
      }

      if (willEatFood) {
        souls.objectiveProgress += 1;
        applyRuneGain(souls, SoulsData.getRuneReward("food"));
        nextBase.food = spawnSoulsFood(
          nextBase,
          souls,
          barriers,
          enemy,
          minions,
          souls.hazards,
          souls.sigil,
          souls.echo,
          rng,
          souls.enemyTeleportPreview
        );
        if (!nextBase.food) {
          return createSoulsGameOver(state, nextBase, souls);
        }
      }

      if (willCollectSigil) {
        souls.objectiveProgress += 1 + getPowerStack(souls, "voracidade");
        applyRuneGain(souls, SoulsData.getRuneReward("sigil"));
        souls.sigil = null;
        souls.sigilRespawnMsRemaining = getSoulsSigilRespawnMs(souls);
      }
    }

    if (souls.objectiveType === "sigil" && !souls.sigil) {
      souls.sigilRespawnMsRemaining = Math.max(
        0,
        souls.sigilRespawnMsRemaining - deltaMs
      );
      if (souls.sigilRespawnMsRemaining <= 0) {
        souls.sigil = spawnSoulsSigil(
          nextBase,
          souls,
          barriers,
          enemy,
          minions,
          souls.hazards,
          souls.echo,
          rng,
          souls.enemyTeleportPreview
        );
        souls.sigilRespawnMsRemaining = 0;
        if (!souls.sigil) {
          return createSoulsGameOver(state, nextBase, souls);
        }
      }
    }

    let consumedEnemyActionByTeleport = false;
    if (
      enemy &&
      readyTeleportPreview &&
      enemy.id === readyTeleportPreview.enemyId
    ) {
      enemy = applyEnemyTeleportAnchor(enemy, readyTeleportPreview);
      enemy.teleportCounter = 0;
      consumedEnemyActionByTeleport = true;
    }

    if (enemy && shouldMoveEnemy && !consumedEnemyActionByTeleport) {
      enemy = moveSoulsEnemy(enemy, souls, nextBase, barriers, souls.hazards, rng);

      const shouldHazardPulse =
        enemy.baseHazardEveryTicks > 0 &&
        enemy.hazardCounter >= enemy.baseHazardEveryTicks;
      if (shouldHazardPulse) {
        souls.hazards = addHazardPulse(nextBase, enemy, souls.hazards);
        enemy.hazardCounter = 0;
      }
    }

    if (enemy && SoulsWorld && souls.camera) {
      const blockedForReentry = buildStageBlockedSet(
        nextBase,
        barriers,
        enemy,
        minions,
        souls.hazards,
        souls.sigil,
        souls.echo
      );
      enemy = SoulsWorld.reenterEnemyAtEdge(
        souls.world,
        enemy,
        nextBase.snake[0],
        souls.camera,
        SOULS_REENTRY_COOLDOWN_MS,
        blockedForReentry,
        deltaMs
      );
    }

    if (shouldMoveEnemy) {
      souls.enemy = enemy;
      minions = moveSoulsMinions(
        minions,
        souls,
        nextBase,
        barriers,
        souls.hazards,
        rng,
        deltaMs
      );
      souls.enemy = null;
    }

    souls.minions = minions;

    const enemyHitAfterMove = enemyOccupiesPosition(enemy, nextBase.snake[0]);
    const minionHitAfterMove = minions.some((minion) =>
      enemyOccupiesPosition(minion, nextBase.snake[0])
    );
    const hazardHitAfterMove = containsPosition(souls.hazards, nextBase.snake[0]);
    if (
      (enemyHitAfterMove || minionHitAfterMove || hazardHitAfterMove) &&
      !tryMitigateSoulsCollision(souls)
    ) {
      return createSoulsGameOver(
        {
          ...state,
          enemy,
        },
        nextBase,
        souls
      );
    }

    const nextState = {
      ...state,
      base: nextBase,
      tickMs: state.tickMs,
      barriers: clonePositions(barriers),
      enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls,
    };

    souls.sigilIndicator = buildSoulsSigilIndicator(nextBase, souls);

    if (souls.objectiveProgress >= souls.objectiveTarget) {
      return handleSoulsStageCompletion(nextState, nextBase, souls, rng);
    }

    return {
      ...nextState,
      souls,
    };
  }

  function chooseSoulsReward(state, powerId, options = {}) {
    if (state.mode !== "souls") {
      return state;
    }

    if (!state.souls.reward) {
      return state;
    }

    if (!state.souls.reward.options.includes(powerId)) {
      return state;
    }

    const maxStacks = SoulsData.getPowerMaxStacks(powerId);
    const currentStacks = state.souls.powers[powerId] ?? 0;
    if (currentStacks >= maxStacks) {
      return state;
    }

    const nextFloor = state.souls.stageFlow?.nextFloor ?? state.souls.floor + 1;
    const completionLabel =
      state.souls.stageFlow?.message ??
      `Boss ${state.souls.bossName ?? ""} derrotado`.trim();
    const upgradedPowers = {
      ...state.souls.powers,
      [powerId]: currentStacks + 1,
    };
    const nextSouls = {
      ...state.souls,
      powers: upgradedPowers,
      reward: null,
      rewardRerolled: false,
      stamina: createSoulsStaminaState(
        {
          ...state.souls,
          powers: upgradedPowers,
        },
        { current: "max" }
      ),
      stageFlow: createStageFlowState("idle"),
      countdownMsRemaining: 0,
    };
    const rng = options.rng ?? Math.random;

    return transitionSoulsFloorInPlace(
      {
        ...state,
        isPaused: false,
        base: {
          ...state.base,
          isPaused: false,
        },
        souls: nextSouls,
      },
      {
        ...state.base,
        isPaused: false,
      },
      nextSouls,
      nextFloor,
      rng,
      {
        message: completionLabel,
      }
    );
  }

  function rerollSoulsReward(state, options = {}) {
    if (state.mode !== "souls" || !state.souls.reward) {
      return state;
    }

    if (state.souls.reward.rerolled) {
      return state;
    }

    if (state.souls.carriedRunes < SoulsData.REROLL_COST) {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const souls = {
      ...state.souls,
      carriedRunes: state.souls.carriedRunes - SoulsData.REROLL_COST,
    };

    const optionsList = rollPowerOptions(souls, rng);
    if (optionsList.length === 0) {
      return {
        ...state,
        souls: {
          ...souls,
          reward: null,
        },
      };
    }

    return {
      ...state,
      souls: {
        ...souls,
        reward: {
          ...state.souls.reward,
          options: optionsList,
          rerolled: true,
        },
      },
    };
  }

  function devSetSoulsFloor(state, floor, options = {}) {
    if (state.mode !== "souls") {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const numericFloor = Number(floor);
    const safeFloor = Number.isFinite(numericFloor)
      ? Math.max(1, Math.floor(numericFloor))
      : 1;

    const souls = {
      ...state.souls,
      profile: SoulsProfile.sanitizeProfile(state.souls.profile),
      reward: null,
      rewardRerolled: false,
      objectiveProgress: 0,
    };
    const base = {
      ...state.base,
      isGameOver: false,
      isPaused: false,
    };
    const staged = startNextSoulsFloor(
      {
        ...state,
        base,
        isGameOver: false,
        isPaused: false,
        souls,
      },
      base,
      souls,
      safeFloor,
      rng,
      {
        includeCountdown: options.includeCountdown === true,
        viewportAspect:
          options.viewportAspect ?? state.souls.viewportAspect ?? souls.viewportAspect ?? 1,
      }
    );

    const nextSouls = {
      ...staged.souls,
      reward: null,
      rewardRerolled: false,
    };

    return {
      ...staged,
      base: {
        ...staged.base,
        isGameOver: false,
        isPaused: false,
      },
      isGameOver: false,
      isPaused: false,
      souls: nextSouls,
      tickMs: getSoulsTickMs(
        nextSouls.floor,
        nextSouls.stageType,
        nextSouls
      ),
    };
  }

  function devSetSoulsBoss(state, bossSlot, options = {}) {
    if (state.mode !== "souls") {
      return state;
    }

    const token =
      typeof bossSlot === "string"
        ? bossSlot.toUpperCase()
        : Number.isFinite(Number(bossSlot))
          ? String(Math.floor(Number(bossSlot)))
          : "";

    let withinCycle = null;
    if (token === "FINAL") {
      withinCycle = 12;
    } else if (token === "1") {
      withinCycle = 3;
    } else if (token === "2") {
      withinCycle = 6;
    } else if (token === "3") {
      withinCycle = 9;
    }

    if (withinCycle === null) {
      return state;
    }

    const cycleFromOptions = Number(options.cycle);
    const cycle = Number.isFinite(cycleFromOptions)
      ? Math.max(1, Math.floor(cycleFromOptions))
      : SoulsData.getCycle(state.souls.floor);
    const targetFloor = (cycle - 1) * 12 + withinCycle;

    return devSetSoulsFloor(state, targetFloor, options);
  }

  function stepTraditionalState(state, options = {}) {
    return ShooterState.stepShooterState(state, options);
  }

  function stepModeState(state, options = {}) {
    if (state.mode === "levels") {
      return stepLevelsState(state, options);
    }

    if (state.mode === "souls") {
      const nextState = stepSoulsState(state, options);
      if (nextState.mode === "souls") {
        const tickMs = getSoulsTickMs(
          nextState.souls.floor,
          nextState.souls.stageType,
          nextState.souls
        );
        return {
          ...nextState,
          tickMs,
        };
      }
      return nextState;
    }

    return stepTraditionalState(state, options);
  }

  const api = Object.freeze({
    TRADITIONAL_TICK_MS,
    SHIELD_DURATION_MS,
    createModeState,
    stepModeState,
    queueModeDirection,
    toggleModePause,
    restartModeState,
    chooseSoulsReward,
    rerollSoulsReward,
    devSetSoulsFloor,
    devSetSoulsBoss,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SnakeModes = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
