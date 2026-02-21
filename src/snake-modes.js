(function defineSnakeModes(global) {
  "use strict";

  const SnakeLogic =
    global.SnakeLogic ||
    (typeof require !== "undefined" ? require("./snake-logic.js") : null);

  if (!SnakeLogic) {
    throw new Error("SnakeModes requires SnakeLogic.");
  }

  const TRADITIONAL_TICK_MS = 120;
  const SHIELD_DURATION_MS = 5000;
  const POWER_UP_TTL_TICKS = 60;

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

  function arePositionsEqual(a, b) {
    return SnakeLogic.arePositionsEqual(a, b);
  }

  function containsPosition(positions, target) {
    return positions.some((position) => arePositionsEqual(position, target));
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

  function getTickMs(level) {
    return Math.max(70, 130 - (level - 1) * 5);
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
    const width = options.width ?? 20;
    const height = options.height ?? 20;
    const rng = options.rng ?? Math.random;
    const base = SnakeLogic.createInitialState({ width, height, rng });

    return {
      mode: "traditional",
      base,
      level: null,
      levelProgress: 0,
      levelTarget: 0,
      tickMs: TRADITIONAL_TICK_MS,
      barriers: [],
      enemy: null,
      powerUp: null,
      shieldMsRemaining: 0,
      isGameOver: base.isGameOver,
      isPaused: base.isPaused,
    };
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
    };
  }

  function createModeState(options = {}) {
    const mode = options.mode === "levels" ? "levels" : "traditional";
    if (mode === "levels") {
      return createLevelsModeState(options);
    }
    return createTraditionalModeState(options);
  }

  function queueModeDirection(state, direction) {
    const nextBase = SnakeLogic.queueDirection(state.base, direction);
    return {
      ...state,
      base: nextBase,
    };
  }

  function toggleModePause(state) {
    const nextBase = SnakeLogic.togglePause(state.base);
    return {
      ...state,
      base: nextBase,
      isPaused: nextBase.isPaused,
    };
  }

  function restartModeState(state, options = {}) {
    const rng = options.rng ?? Math.random;
    return createModeState({
      mode: state.mode,
      width: state.base.width,
      height: state.base.height,
      rng,
    });
  }

  function getNextHead(base) {
    const nextDirection = base.pendingDirection ?? base.direction;
    const movement = SnakeLogic.DIRECTION_VECTORS[nextDirection];
    const head = base.snake[0];
    return {
      direction: nextDirection,
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
    const base = state.base;
    const { direction, nextHead } = getNextHead(base);

    if (isOutOfBounds(base, nextHead)) {
      const nextBase = {
        ...base,
        direction,
        pendingDirection: direction,
      };
      return createGameOverState(state, nextBase);
    }

    const willEatFood = base.food && arePositionsEqual(nextHead, base.food);
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
        pendingDirection: direction,
      };
      return createGameOverState(state, nextBase);
    }

    let nextBase = {
      ...base,
      snake: nextSnake,
      direction,
      pendingDirection: direction,
      score: base.score + (willEatFood ? 1 : 0),
      isGameOver: false,
      isPaused: false,
    };
    let isGameOver = false;
    let level = state.level;
    let levelProgress = state.levelProgress + (willEatFood ? 1 : 0);
    let levelTarget = state.levelTarget;
    let tickMs = state.tickMs;
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
      tickMs = getTickMs(level);
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

    const nextState = {
      ...state,
      base: {
        ...nextBase,
        isGameOver,
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
    };

    return nextState;
  }

  function stepTraditionalState(state, options = {}) {
    const rng = options.rng ?? Math.random;
    const nextBase = SnakeLogic.stepState(state.base, { rng });
    return {
      ...state,
      base: nextBase,
      isGameOver: nextBase.isGameOver,
      isPaused: nextBase.isPaused,
      tickMs: TRADITIONAL_TICK_MS,
      level: null,
      levelProgress: 0,
      levelTarget: 0,
      barriers: [],
      enemy: null,
      powerUp: null,
      shieldMsRemaining: 0,
    };
  }

  function stepModeState(state, options = {}) {
    if (state.mode === "levels") {
      return stepLevelsState(state, options);
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
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SnakeModes = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
