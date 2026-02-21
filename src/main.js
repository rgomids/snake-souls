"use strict";

const { directionFromInputKey } = window.SnakeLogic;
const {
  createModeState,
  queueModeDirection,
  restartModeState,
  stepModeState,
  toggleModePause,
} = window.SnakeModes;

const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const THEME_KEY = "snake-theme";

const SCREEN_MENU = "menu";
const SCREEN_PLAYING = "playing";
const SCREEN_GAMEOVER = "gameover";

const appElement = document.querySelector(".app");
const menuScreenElement = document.getElementById("menu-screen");
const gameScreenElement = document.getElementById("game-screen");

const modeSelect = document.getElementById("mode-select");
const startButton = document.getElementById("start-btn");
const menuButton = document.getElementById("menu-btn");

const gridElement = document.getElementById("grid");
const scoreElement = document.getElementById("score");
const statusElement = document.getElementById("status");
const modeLabelElement = document.getElementById("mode-label");
const levelValueElement = document.getElementById("level-value");
const levelProgressElement = document.getElementById("level-progress");
const shieldTimeElement = document.getElementById("shield-time");

const pauseButton = document.getElementById("pause-btn");
const restartButton = document.getElementById("restart-btn");
const themeToggle = document.getElementById("theme-toggle");
const touchButtons = Array.from(document.querySelectorAll("[data-direction]"));

const appState = {
  screen: SCREEN_MENU,
  modeState: null,
  tickerId: null,
  currentTickMs: null,
};

const cells = [];
let gridWidth = 0;
let gridHeight = 0;

function getSavedTheme() {
  try {
    return window.localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors (private mode or blocked storage)
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeToggle) {
    themeToggle.checked = theme === "dark";
  }
}

function getInitialTheme() {
  const savedTheme = getSavedTheme();
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}

function formatModeLabel(mode) {
  if (mode === "levels") {
    return "Levels";
  }
  return "Traditional";
}

function getStatusText() {
  if (!appState.modeState) {
    return "Ready";
  }

  if (appState.modeState.isGameOver) {
    return "Game over";
  }

  if (appState.modeState.isPaused) {
    return "Paused";
  }

  return "Running";
}

function setScreen(screen) {
  appState.screen = screen;
  appElement.dataset.screen = screen;

  const isMenu = screen === SCREEN_MENU;
  menuScreenElement.classList.toggle("hidden", !isMenu);
  gameScreenElement.classList.toggle("hidden", isMenu);
}

function setModeDataset() {
  if (!appState.modeState) {
    appElement.dataset.mode = "menu";
    return;
  }
  appElement.dataset.mode = appState.modeState.mode;
}

function ensureGrid(width, height) {
  if (gridWidth === width && gridHeight === height && cells.length > 0) {
    return;
  }

  gridWidth = width;
  gridHeight = height;
  gridElement.style.setProperty("--grid-width", String(width));
  gridElement.style.setProperty("--grid-height", String(height));
  gridElement.innerHTML = "";
  cells.length = 0;

  const fragment = document.createDocumentFragment();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cells.push(cell);
      fragment.appendChild(cell);
    }
  }

  gridElement.appendChild(fragment);
}

function indexForPosition(position) {
  return position.y * gridWidth + position.x;
}

function paintCell(position, className) {
  if (!position) return;
  const cell = cells[indexForPosition(position)];
  if (!cell) return;
  cell.classList.add(className);
}

function resetGridStyles() {
  for (const cell of cells) {
    cell.className = "cell";
  }
}

function renderBoard(modeState) {
  resetGridStyles();

  for (const barrier of modeState.barriers) {
    paintCell(barrier, "barrier");
  }

  if (modeState.base.food) {
    paintCell(modeState.base.food, "food");
  }

  if (modeState.powerUp) {
    paintCell(modeState.powerUp, "power-up");
  }

  if (modeState.enemy) {
    paintCell(modeState.enemy, "enemy");
  }

  for (let i = 0; i < modeState.base.snake.length; i += 1) {
    const segment = modeState.base.snake[i];
    paintCell(segment, "snake");
    if (i === 0) {
      paintCell(segment, "head");
    }
  }
}

function renderHud(modeState) {
  if (!modeState) {
    modeLabelElement.textContent = "-";
    levelValueElement.textContent = "-";
    levelProgressElement.textContent = "-";
    shieldTimeElement.textContent = "0.0s";
    return;
  }

  modeLabelElement.textContent = formatModeLabel(modeState.mode);

  if (modeState.mode === "levels") {
    levelValueElement.textContent = String(modeState.level);
    levelProgressElement.textContent = `${modeState.levelProgress}/${modeState.levelTarget}`;
    shieldTimeElement.textContent = `${(modeState.shieldMsRemaining / 1000).toFixed(
      1
    )}s`;
  } else {
    levelValueElement.textContent = "-";
    levelProgressElement.textContent = "-";
    shieldTimeElement.textContent = "0.0s";
  }
}

function renderButtons(modeState) {
  const hasGame = Boolean(modeState);
  const isMenu = appState.screen === SCREEN_MENU;
  const isGameOver = hasGame && modeState.isGameOver;

  pauseButton.disabled = !hasGame || isMenu || isGameOver;
  pauseButton.textContent = hasGame && modeState.isPaused ? "Resume" : "Pause";
  restartButton.disabled = !hasGame || isMenu;
  menuButton.disabled = isMenu;
  startButton.disabled = false;
}

function render() {
  setModeDataset();

  const modeState = appState.modeState;
  scoreElement.textContent = String(modeState ? modeState.base.score : 0);
  statusElement.textContent = getStatusText();

  if (modeState) {
    ensureGrid(modeState.base.width, modeState.base.height);
    renderBoard(modeState);
  }

  renderHud(modeState);
  renderButtons(modeState);
}

function stopTicker() {
  if (appState.tickerId !== null) {
    window.clearInterval(appState.tickerId);
    appState.tickerId = null;
    appState.currentTickMs = null;
  }
}

function startTicker(tickMs) {
  stopTicker();
  appState.currentTickMs = tickMs;
  appState.tickerId = window.setInterval(onTick, tickMs);
}

function startGame(mode) {
  appState.modeState = createModeState({
    mode,
    width: GRID_WIDTH,
    height: GRID_HEIGHT,
  });
  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  startTicker(appState.modeState.tickMs);
  render();
}

function restartGame() {
  if (!appState.modeState) return;

  appState.modeState = restartModeState(appState.modeState);
  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  startTicker(appState.modeState.tickMs);
  render();
}

function backToMenu() {
  stopTicker();
  appState.modeState = null;
  setScreen(SCREEN_MENU);
  render();
}

function onTick() {
  if (!appState.modeState || appState.screen === SCREEN_MENU) {
    return;
  }

  const previousTickMs = appState.modeState.tickMs;
  appState.modeState = stepModeState(appState.modeState);

  if (appState.modeState.isGameOver) {
    setScreen(SCREEN_GAMEOVER);
    stopTicker();
  } else if (appState.modeState.tickMs !== previousTickMs) {
    startTicker(appState.modeState.tickMs);
  }

  render();
}

document.addEventListener("keydown", (event) => {
  if (appState.screen === SCREEN_MENU && event.key === "Enter") {
    event.preventDefault();
    startGame(modeSelect.value);
    return;
  }

  if (!appState.modeState) {
    return;
  }

  const direction = directionFromInputKey(event.key);
  if (direction) {
    event.preventDefault();
    appState.modeState = queueModeDirection(appState.modeState, direction);
    return;
  }

  const key = event.key.toLowerCase();
  if ((key === " " || key === "p") && !appState.modeState.isGameOver) {
    event.preventDefault();
    appState.modeState = toggleModePause(appState.modeState);
    render();
    return;
  }

  if (key === "r" && appState.screen !== SCREEN_MENU) {
    event.preventDefault();
    restartGame();
  }
});

startButton.addEventListener("click", () => {
  startGame(modeSelect.value);
});

pauseButton.addEventListener("click", () => {
  if (!appState.modeState) return;
  appState.modeState = toggleModePause(appState.modeState);
  render();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

menuButton.addEventListener("click", () => {
  backToMenu();
});

if (themeToggle) {
  themeToggle.addEventListener("change", () => {
    const nextTheme = themeToggle.checked ? "dark" : "light";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  });
}

for (const button of touchButtons) {
  button.addEventListener("click", () => {
    if (!appState.modeState) return;
    const direction = button.dataset.direction;
    appState.modeState = queueModeDirection(appState.modeState, direction);
  });
}

applyTheme(getInitialTheme());
setScreen(SCREEN_MENU);
render();
