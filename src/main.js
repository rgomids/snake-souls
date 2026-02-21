"use strict";

const {
  createInitialState,
  directionFromInputKey,
  queueDirection,
  stepState,
  togglePause,
} = window.SnakeLogic;

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const TICK_MS = 120;

const gridElement = document.getElementById("grid");
const scoreElement = document.getElementById("score");
const statusElement = document.getElementById("status");
const pauseButton = document.getElementById("pause-btn");
const restartButton = document.getElementById("restart-btn");
const touchButtons = Array.from(document.querySelectorAll("[data-direction]"));

let state = createInitialState({ width: GRID_WIDTH, height: GRID_HEIGHT });
const cells = [];

function indexForPosition(position) {
  return position.y * state.width + position.x;
}

function buildGrid() {
  gridElement.style.setProperty("--grid-width", String(state.width));
  gridElement.style.setProperty("--grid-height", String(state.height));
  gridElement.innerHTML = "";
  cells.length = 0;

  const fragment = document.createDocumentFragment();
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cells.push(cell);
      fragment.appendChild(cell);
    }
  }

  gridElement.appendChild(fragment);
}

function resetCellStyles() {
  for (const cell of cells) {
    cell.className = "cell";
  }
}

function updateStatusText() {
  if (state.isGameOver) {
    statusElement.textContent = "Game over";
    return;
  }

  if (state.isPaused) {
    statusElement.textContent = "Paused";
    return;
  }

  statusElement.textContent = "Running";
}

function render() {
  resetCellStyles();

  for (let i = 0; i < state.snake.length; i += 1) {
    const segment = state.snake[i];
    const segmentCell = cells[indexForPosition(segment)];
    if (!segmentCell) continue;
    segmentCell.classList.add("snake");
    if (i === 0) {
      segmentCell.classList.add("head");
    }
  }

  if (state.food) {
    const foodCell = cells[indexForPosition(state.food)];
    if (foodCell) {
      foodCell.classList.add("food");
    }
  }

  scoreElement.textContent = String(state.score);
  updateStatusText();
  pauseButton.disabled = state.isGameOver;
  pauseButton.textContent = state.isPaused ? "Resume" : "Pause";
}

function restartGame() {
  state = createInitialState({ width: GRID_WIDTH, height: GRID_HEIGHT });
  render();
}

function tick() {
  state = stepState(state);
  render();
}

document.addEventListener("keydown", (event) => {
  const direction = directionFromInputKey(event.key);
  if (direction) {
    event.preventDefault();
    state = queueDirection(state, direction);
    return;
  }

  const key = event.key.toLowerCase();
  if (key === " " || key === "p") {
    event.preventDefault();
    state = togglePause(state);
    render();
    return;
  }

  if (key === "r") {
    event.preventDefault();
    restartGame();
  }
});

pauseButton.addEventListener("click", () => {
  state = togglePause(state);
  render();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

for (const button of touchButtons) {
  button.addEventListener("click", () => {
    const direction = button.dataset.direction;
    state = queueDirection(state, direction);
  });
}

buildGrid();
render();
window.setInterval(tick, TICK_MS);
