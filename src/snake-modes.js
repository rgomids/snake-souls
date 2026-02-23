(function defineSnakeModes(global) {
  "use strict";

  const SnakeLogic =
    global.SnakeLogic ||
    (typeof require !== "undefined" ? require("./snake-logic.js") : null);
  const SoulsData =
    global.SoulsData ||
    (typeof require !== "undefined" ? require("./souls-data.js") : null);
  const SoulsProfile =
    global.SoulsProfile ||
    (typeof require !== "undefined" ? require("./souls-profile.js") : null);

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
  const ESPECTRO_TELEPORT_PREVIEW_MS =
    SoulsData?.ESPECTRO_TELEPORT_PREVIEW_MS ?? 1000;
  const ESPECTRO_TELEPORT_MAX_DISTANCE =
    SoulsData?.ESPECTRO_TELEPORT_MAX_DISTANCE ?? 3;

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
      souls: null,
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
      souls: null,
    };
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

  function getSoulsSnakeSpeedCps(floor, stageType, souls, options = {}) {
    const baseCps = getSoulsSnakeBaseSpeedCps(floor, stageType, souls);
    if (options.holdCurrentDirection) {
      return baseCps;
    }

    return clamp(baseCps * GLOBAL_SNAKE_SLOW_FACTOR, 2, 18);
  }

  function getSoulsEnemySpeedCps(enemy, snakeSpeedCps) {
    if (!enemy) return 0;

    const styleMultiplier =
      enemy.style === "patrol"
        ? 0.9
        : enemy.style === "phase"
        ? 0.95
        : enemy.style === "mixed"
        ? 1.1
        : 1;

    const cps =
      (snakeSpeedCps / Math.max(1, enemy.moveEveryTicks ?? 1)) * styleMultiplier;
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
    hazards,
    sigil,
    echo,
    enemyTeleportPreview
  ) {
    const blocked = occupiedKeysFromSnake(base);

    for (const barrier of barriers) {
      blocked.add(keyForPosition(barrier));
    }

    if (enemy) {
      for (const enemyCell of getEnemyCells(enemy)) {
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
    barriers,
    enemy,
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
      hazards,
      sigil,
      echo,
      enemyTeleportPreview
    );
    return pickRandomCell(base.width, base.height, blocked, rng);
  }

  function spawnSoulsSigil(
    base,
    barriers,
    enemy,
    hazards,
    echo,
    rng,
    enemyTeleportPreview = null
  ) {
    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
      hazards,
      null,
      echo,
      enemyTeleportPreview
    );
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }
    return pickRandomCell(base.width, base.height, blocked, rng);
  }

  function spawnSoulsEcho(
    base,
    barriers,
    enemy,
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
      hazards,
      sigil,
      null,
      enemyTeleportPreview
    );
    if (base.food) {
      blocked.add(keyForPosition(base.food));
    }

    const position = pickRandomCell(base.width, base.height, blocked, rng);
    if (!position) {
      return null;
    }

    return {
      runes: pendingEcho.runes,
      position,
    };
  }

  function spawnSoulsEnemy(base, barriers, floor, bossDefinition, rng) {
    if (!bossDefinition) {
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

    const width = bossDefinition.width ?? bossDefinition.size ?? 1;
    const height = bossDefinition.height ?? bossDefinition.size ?? 1;
    const candidates = [];
    for (let y = 0; y <= base.height - height; y += 1) {
      for (let x = 0; x <= base.width - width; x += 1) {
        let canUse = true;
        for (let dy = 0; dy < height; dy += 1) {
          for (let dx = 0; dx < width; dx += 1) {
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

    if (candidates.length === 0) {
      return null;
    }

    const chosenIndex = clampIndex(
      Math.floor(rng() * candidates.length),
      candidates.length
    );
    const position = candidates[chosenIndex];

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
    };
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
    const arena = SoulsData.getArenaSize(
      floor,
      stage.stageType,
      snakeDefinition,
      rng
    );

    const base = SnakeLogic.createInitialState({
      width: arena.width,
      height: arena.height,
      rng,
    });

    const barriers = generateSoulsBarriers(base, floor, stage.stageType, rng);
    const hazards = [];
    const enemy = spawnSoulsEnemy(
      base,
      barriers,
      floor,
      stage.bossDefinition,
      rng
    );

    let food = null;
    let sigil = null;

    if (stage.stageType === "normal") {
      food = spawnSoulsFood(base, barriers, enemy, hazards, null, null, rng);
    } else {
      sigil = spawnSoulsSigil(base, barriers, enemy, hazards, null, rng);
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
    const enemyBaseSnakeSpeedCps = getSoulsSnakeBaseSpeedCps(
      floor,
      stage.stageType,
      state.souls
    );
    const tickMs = Math.max(SoulsData.MIN_TICK_MS, Math.round(1000 / snakeSpeedCps));

    const echo =
      floor === 1 && stage.stageType === "normal"
        ? spawnSoulsEcho(
            base,
            barriers,
            enemy,
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
      tickMs,
      snakeSpeedCps,
      enemySpeedCps: getSoulsEnemySpeedCps(enemy, enemyBaseSnakeSpeedCps),
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
      armorCharges: getSoulsArmorPerStage(state.souls),
      countdownMsRemaining:
        options.includeCountdown === true ? SOULS_COUNTDOWN_MS : 0,
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

    const rng = options.rng ?? Math.random;
    const sourceProfile = options.soulsProfile ?? SoulsProfile.createDefaultProfile();
    const sanitizedProfile = SoulsProfile.sanitizeProfile(sourceProfile);
    const requestedSnakeId = options.soulsSnakeId ?? sanitizedProfile.selectedSnakeId;
    const selectedSnakeId = sanitizedProfile.unlockedSnakeIds.includes(requestedSnakeId)
      ? requestedSnakeId
      : SoulsData.DEFAULT_SNAKE_ID;
    const profile = SoulsProfile.selectSnake(sanitizedProfile, selectedSnakeId);

    const state = {
      mode: "souls",
      base: SnakeLogic.createInitialState({ width: 20, height: 20, rng }),
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
        snakeSpeedCps: 0,
        enemySpeedCps: 0,
        snakeMoveAccumulatorMs: 0,
        enemyMoveAccumulatorMs: 0,
        armorCharges: 0,
        ghostCooldownMs: 0,
        directionLockMsRemaining: 0,
        lastDeathRunes: 0,
        lastDeathEcho: 0,
        countdownMsRemaining: 0,
      },
    };

    const stageState = createSoulsStageState(state, 1, rng, {
      includeCountdown: false,
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
    state.souls.snakeSpeedCps = stageState.snakeSpeedCps;
    state.souls.enemySpeedCps = stageState.enemySpeedCps;
    state.souls.snakeMoveAccumulatorMs = stageState.snakeMoveAccumulatorMs;
    state.souls.enemyMoveAccumulatorMs = stageState.enemyMoveAccumulatorMs;
    state.souls.armorCharges = stageState.armorCharges;
    state.souls.countdownMsRemaining = stageState.countdownMsRemaining;

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
    const changed = nextBase.pendingDirection !== state.base.pendingDirection;

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
      if (
        candidate.x < 0 ||
        candidate.x >= base.width ||
        candidate.y < 0 ||
        candidate.y >= base.height
      ) {
        continue;
      }

      if (containsPosition(next, candidate)) {
        continue;
      }

      next.push({ ...candidate, ttlMs: HAZARD_TTL_MS });
    }

    return next;
  }

  function rotateDirectionClockwise(direction) {
    if (direction === "UP") return "RIGHT";
    if (direction === "RIGHT") return "DOWN";
    if (direction === "DOWN") return "LEFT";
    return "UP";
  }

  function canEnemyMoveTo(base, candidate, enemy, barriers, hazards) {
    const nextEnemy = {
      ...enemy,
      x: candidate.x,
      y: candidate.y,
    };

    for (const enemyCell of getEnemyCells(nextEnemy)) {
      if (isOutOfBounds(base, enemyCell)) {
        return false;
      }

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
    }

    return true;
  }

  function listTeleportAnchorsForEnemy(
    enemy,
    base,
    barriers,
    hazards,
    sigil,
    echo,
    enemyTeleportPreview = null
  ) {
    const blocked = makeBlockedSet(
      base,
      barriers,
      enemy,
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
    for (let y = 0; y <= base.height - footprint.height; y += 1) {
      for (let x = 0; x <= base.width - footprint.width; x += 1) {
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
    hazards,
    sigil,
    echo,
    rng,
    options = {}
  ) {
    const candidates = listTeleportAnchorsForEnemy(
      enemy,
      base,
      barriers,
      hazards,
      sigil,
      echo,
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
    hazards,
    sigil,
    echo,
    rng,
    options = {}
  ) {
    const anchor = pickTeleportAnchorForEnemy(
      enemy,
      base,
      barriers,
      hazards,
      sigil,
      echo,
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
            hazards,
            souls.sigil,
            souls.echo,
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
          hazards,
          souls.sigil,
          souls.echo,
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

    const carcereiroAggro =
      enemy.id === "carcereiro" && getEnemyDistanceToPosition(nextEnemy, head) <= 3;

    if (enemy.style === "patrol" && !carcereiroAggro) {
      let direction = enemy.direction;
      for (let i = 0; i < 4; i += 1) {
        const vector = SnakeLogic.DIRECTION_VECTORS[direction];
        const candidate = {
          x: nextEnemy.x + vector.x,
          y: nextEnemy.y + vector.y,
        };
        if (canEnemyMoveTo(base, candidate, nextEnemy, barriers, hazards)) {
          nextEnemy.x = candidate.x;
          nextEnemy.y = candidate.y;
          nextEnemy.direction = direction;
          return nextEnemy;
        }
        direction = rotateDirectionClockwise(direction);
      }
      return nextEnemy;
    }

    let directions = orderedEnemyDirections(nextEnemy, head);
    if (enemy.style === "mixed" && nextEnemy.patternCounter % 3 === 0) {
      directions = ["LEFT", "UP", "RIGHT", "DOWN"];
    }

    for (const direction of directions) {
      const vector = SnakeLogic.DIRECTION_VECTORS[direction];
      const candidate = {
        x: nextEnemy.x + vector.x,
        y: nextEnemy.y + vector.y,
      };
      if (!canEnemyMoveTo(base, candidate, nextEnemy, barriers, hazards)) {
        continue;
      }

      nextEnemy.x = candidate.x;
      nextEnemy.y = candidate.y;
      nextEnemy.direction = direction;
      return nextEnemy;
    }

    return nextEnemy;
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

  function handleSoulsStageCompletion(state, nextBase, souls, rng) {
    if (souls.stageType === "normal") {
      return startNextSoulsFloor(state, nextBase, souls, souls.floor + 1, rng);
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
      return startNextSoulsFloor(state, nextBase, souls, souls.floor + 1, rng);
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
        snakeSpeedCps: stageState.snakeSpeedCps,
        enemySpeedCps: stageState.enemySpeedCps,
        snakeMoveAccumulatorMs: stageState.snakeMoveAccumulatorMs,
        enemyMoveAccumulatorMs: stageState.enemyMoveAccumulatorMs,
        armorCharges: stageState.armorCharges,
        countdownMsRemaining: stageState.countdownMsRemaining,
      },
    };
  }

  function stepSoulsState(state, options = {}) {
    if (state.isGameOver || state.isPaused || state.souls.reward) {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const base = state.base;
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
    };
    souls.snakeSpeedCps = getSoulsSnakeSpeedCps(
      souls.floor,
      souls.stageType,
      souls
    );
    souls.enemySpeedCps = state.enemy
      ? getSoulsEnemySpeedCps(
          state.enemy,
          getSoulsSnakeBaseSpeedCps(souls.floor, souls.stageType, souls)
        )
      : 0;
    const defaultDeltaMs = Math.max(
      state.tickMs,
      1000 / Math.max(0.1, souls.snakeSpeedCps)
    );
    const deltaMs = Math.max(0, options.deltaMs ?? defaultDeltaMs);
    const holdCurrentDirection = options.holdCurrentDirection === true;

    if (souls.countdownMsRemaining > 0) {
      souls.countdownMsRemaining = Math.max(
        0,
        souls.countdownMsRemaining - deltaMs
      );

      return {
        ...state,
        souls,
      };
    }

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

    const effectiveSnakeSpeedCps = getSoulsSnakeSpeedCps(
      souls.floor,
      souls.stageType,
      souls,
      { holdCurrentDirection }
    );
    const snakeIntervalMs = 1000 / Math.max(0.1, effectiveSnakeSpeedCps);
    const enemyIntervalMs = getSoulsEnemyIntervalMs(souls);
    const shouldMoveSnake = souls.snakeMoveAccumulatorMs >= snakeIntervalMs;
    const shouldMoveEnemy = souls.enemyMoveAccumulatorMs >= enemyIntervalMs;
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
      isGameOver: false,
      isPaused: false,
    };

    if (shouldMoveSnake) {
      souls.snakeMoveAccumulatorMs -= snakeIntervalMs;
    }
    if (shouldMoveEnemy) {
      souls.enemyMoveAccumulatorMs -= enemyIntervalMs;
    }

    if (!shouldMoveSnake && !shouldMoveEnemy && !readyTeleportPreview) {
      return {
        ...state,
        souls,
      };
    }

    const collectRange = hasPower(souls, "ima") ? 1 : 0;
    if (shouldMoveSnake) {
      const { direction, nextHead } = getNextHead(base);
      if (isOutOfBounds(base, nextHead)) {
        const outBase = {
          ...base,
          direction,
          pendingDirection: direction,
        };
        return createSoulsGameOver(state, outBase, souls);
      }

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
          pendingDirection: direction,
        };
        return createSoulsGameOver(state, collidedBase, souls);
      }

      nextBase = {
        ...base,
        snake: nextSnake,
        direction,
        pendingDirection: direction,
        score: base.score + (willEatFood || willCollectSigil ? 1 : 0),
        isGameOver: false,
        isPaused: false,
      };

      const hitBarrier = containsPosition(state.barriers, nextHead);
      const hitEnemy = enemyOccupiesPosition(state.enemy, nextHead);
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
          state.barriers,
          state.enemy,
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
          state.barriers,
          state.enemy,
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

    let enemy = state.enemy ? { ...state.enemy } : null;
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
      enemy = moveSoulsEnemy(enemy, souls, nextBase, state.barriers, souls.hazards, rng);

      const shouldHazardPulse =
        enemy.baseHazardEveryTicks > 0 &&
        enemy.hazardCounter >= enemy.baseHazardEveryTicks;
      if (shouldHazardPulse) {
        souls.hazards = addHazardPulse(nextBase, enemy, souls.hazards);
        enemy.hazardCounter = 0;
      }
    }

    const enemyHitAfterMove = enemyOccupiesPosition(enemy, nextBase.snake[0]);
    const hazardHitAfterMove = containsPosition(souls.hazards, nextBase.snake[0]);
    if ((enemyHitAfterMove || hazardHitAfterMove) && !tryMitigateSoulsCollision(souls)) {
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
      barriers: clonePositions(state.barriers),
      enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls,
    };

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

    const rng = options.rng ?? Math.random;
    const nextSouls = {
      ...state.souls,
      powers: {
        ...state.souls.powers,
        [powerId]: currentStacks + 1,
      },
      reward: null,
      rewardRerolled: false,
    };

    const baseState = {
      ...state,
      isPaused: false,
      base: {
        ...state.base,
        isPaused: false,
      },
      souls: nextSouls,
    };

    const advanced = startNextSoulsFloor(
      baseState,
      baseState.base,
      nextSouls,
      nextSouls.floor + 1,
      rng
    );

    return {
      ...advanced,
      tickMs: getSoulsTickMs(
        advanced.souls.floor,
        advanced.souls.stageType,
        advanced.souls
      ),
    };
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
      { includeCountdown: options.includeCountdown === true }
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
    const rng = options.rng ?? Math.random;
    const nextBase = SnakeLogic.stepState(state.base, { rng });
    const holdCurrentDirection = options.holdCurrentDirection === true;
    return {
      ...state,
      base: nextBase,
      isGameOver: nextBase.isGameOver,
      isPaused: nextBase.isPaused,
      tickMs: holdCurrentDirection
        ? TRADITIONAL_BASE_TICK_MS
        : TRADITIONAL_TICK_MS,
      level: null,
      levelProgress: 0,
      levelTarget: 0,
      barriers: [],
      enemy: null,
      powerUp: null,
      shieldMsRemaining: 0,
      souls: null,
    };
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
