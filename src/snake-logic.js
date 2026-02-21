(function defineSnakeLogic(global) {
  "use strict";

  const DIRECTION_VECTORS = Object.freeze({
    UP: Object.freeze({ x: 0, y: -1 }),
    DOWN: Object.freeze({ x: 0, y: 1 }),
    LEFT: Object.freeze({ x: -1, y: 0 }),
    RIGHT: Object.freeze({ x: 1, y: 0 }),
  });

  const OPPOSITE_DIRECTION = Object.freeze({
    UP: "DOWN",
    DOWN: "UP",
    LEFT: "RIGHT",
    RIGHT: "LEFT",
  });

  function keyForPosition(position) {
    return `${position.x},${position.y}`;
  }

  function arePositionsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isValidDirection(direction) {
    return Object.prototype.hasOwnProperty.call(DIRECTION_VECTORS, direction);
  }

  function isOppositeDirection(current, next) {
    return OPPOSITE_DIRECTION[current] === next;
  }

  function directionFromInputKey(key) {
    const normalized = key.toLowerCase();
    if (normalized === "arrowup" || normalized === "w") return "UP";
    if (normalized === "arrowdown" || normalized === "s") return "DOWN";
    if (normalized === "arrowleft" || normalized === "a") return "LEFT";
    if (normalized === "arrowright" || normalized === "d") return "RIGHT";
    return null;
  }

  function placeFood(width, height, snake, rng = Math.random) {
    const occupied = new Set(snake.map(keyForPosition));
    const freeCells = [];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const candidate = { x, y };
        if (!occupied.has(keyForPosition(candidate))) {
          freeCells.push(candidate);
        }
      }
    }

    if (freeCells.length === 0) {
      return null;
    }

    const selectedIndex = Math.max(
      0,
      Math.min(freeCells.length - 1, Math.floor(rng() * freeCells.length))
    );

    return freeCells[selectedIndex];
  }

  function createInitialState(options = {}) {
    const width = options.width ?? 20;
    const height = options.height ?? 20;
    const rng = options.rng ?? Math.random;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const snake = [
      { x: centerX, y: centerY },
      { x: centerX - 1, y: centerY },
      { x: centerX - 2, y: centerY },
    ];

    return {
      width,
      height,
      snake,
      direction: "RIGHT",
      pendingDirection: "RIGHT",
      food: placeFood(width, height, snake, rng),
      score: 0,
      isGameOver: false,
      isPaused: false,
    };
  }

  function queueDirection(state, direction) {
    if (!isValidDirection(direction)) {
      return state;
    }

    if (direction === state.direction) {
      return state;
    }

    if (isOppositeDirection(state.direction, direction)) {
      return state;
    }

    return {
      ...state,
      pendingDirection: direction,
    };
  }

  function togglePause(state) {
    if (state.isGameOver) {
      return state;
    }

    return {
      ...state,
      isPaused: !state.isPaused,
    };
  }

  function stepState(state, options = {}) {
    if (state.isGameOver || state.isPaused) {
      return state;
    }

    const rng = options.rng ?? Math.random;
    const nextDirection = state.pendingDirection ?? state.direction;
    const movement = DIRECTION_VECTORS[nextDirection];
    const currentHead = state.snake[0];
    const nextHead = {
      x: currentHead.x + movement.x,
      y: currentHead.y + movement.y,
    };
    const hitBoundary =
      nextHead.x < 0 ||
      nextHead.x >= state.width ||
      nextHead.y < 0 ||
      nextHead.y >= state.height;

    if (hitBoundary) {
      return {
        ...state,
        direction: nextDirection,
        pendingDirection: nextDirection,
        isGameOver: true,
      };
    }

    const willGrow = state.food ? arePositionsEqual(nextHead, state.food) : false;
    const nextSnake = [nextHead, ...state.snake];

    if (!willGrow) {
      nextSnake.pop();
    }

    const collidedWithSelf = nextSnake
      .slice(1)
      .some((segment) => arePositionsEqual(segment, nextHead));

    if (collidedWithSelf) {
      return {
        ...state,
        snake: nextSnake,
        direction: nextDirection,
        pendingDirection: nextDirection,
        isGameOver: true,
      };
    }

    let nextFood = state.food;
    let nextScore = state.score;

    if (willGrow) {
      nextScore += 1;
      nextFood = placeFood(state.width, state.height, nextSnake, rng);
    }

    return {
      ...state,
      snake: nextSnake,
      direction: nextDirection,
      pendingDirection: nextDirection,
      food: nextFood,
      score: nextScore,
      isGameOver: nextFood === null ? true : state.isGameOver,
    };
  }

  const api = Object.freeze({
    DIRECTION_VECTORS,
    arePositionsEqual,
    createInitialState,
    directionFromInputKey,
    isOppositeDirection,
    isValidDirection,
    placeFood,
    queueDirection,
    stepState,
    togglePause,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SnakeLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
