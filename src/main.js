"use strict";

const { directionFromInputKey } = window.SnakeLogic;
const SoulsData = window.SoulsData;
const SoulsProfile = window.SoulsProfile;
const {
  createModeState,
  chooseSoulsReward,
  queueModeDirection,
  rerollSoulsReward,
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

const soulsMenuElement = document.getElementById("souls-menu");
const soulsSnakesElement = document.getElementById("souls-snakes");
const soulsWalletMenuElement = document.getElementById("souls-wallet-menu");
const soulsClearsMenuElement = document.getElementById("souls-clears-menu");
const soulsUnlockLabelElement = document.getElementById("souls-unlock-label");
const soulsUnlockButton = document.getElementById("souls-unlock-btn");

const gridElement = document.getElementById("grid");
const scoreElement = document.getElementById("score");
const statusElement = document.getElementById("status");
const modeLabelElement = document.getElementById("mode-label");
const levelValueElement = document.getElementById("level-value");
const levelProgressElement = document.getElementById("level-progress");
const shieldTimeElement = document.getElementById("shield-time");

const soulsFloorElement = document.getElementById("souls-floor");
const soulsCycleElement = document.getElementById("souls-cycle");
const soulsStageElement = document.getElementById("souls-stage");
const soulsObjectiveElement = document.getElementById("souls-objective");
const soulsCarriedElement = document.getElementById("souls-carried");
const soulsWalletElement = document.getElementById("souls-wallet");
const soulsArmorElement = document.getElementById("souls-armor");

const pauseButton = document.getElementById("pause-btn");
const restartButton = document.getElementById("restart-btn");
const themeToggle = document.getElementById("theme-toggle");
const touchButtons = Array.from(document.querySelectorAll("[data-direction]"));

const soulsRewardModalElement = document.getElementById("souls-reward-modal");
const soulsRewardOptionsElement = document.getElementById("souls-reward-options");
const soulsRerollButton = document.getElementById("souls-reroll-btn");

const soulsDeathSummaryElement = document.getElementById("souls-death-summary");
const soulsDeathRunesElement = document.getElementById("souls-death-runes");
const soulsDeathEchoElement = document.getElementById("souls-death-echo");
const soulsCountdownElement = document.getElementById("souls-countdown");

const initialSoulsProfile = loadSoulsProfileFromStorage();

const appState = {
  screen: SCREEN_MENU,
  modeState: null,
  tickerId: null,
  currentTickMs: null,
  soulsProfile: initialSoulsProfile,
  selectedSoulsSnakeId: initialSoulsProfile.selectedSnakeId,
};

const cells = [];
let gridWidth = 0;
let gridHeight = 0;

function loadSoulsProfileFromStorage() {
  try {
    const raw = window.localStorage.getItem(SoulsData.STORAGE_KEY);
    return SoulsProfile.loadProfile(raw);
  } catch {
    return SoulsProfile.createDefaultProfile();
  }
}

function saveSoulsProfile(profile) {
  try {
    const payload = SoulsProfile.saveProfile(profile);
    window.localStorage.setItem(SoulsData.STORAGE_KEY, payload);
  } catch {
    // Ignore storage errors
  }
}

function setSoulsProfile(profile) {
  const safeProfile = SoulsProfile.sanitizeProfile(profile);
  appState.soulsProfile = safeProfile;
  appState.selectedSoulsSnakeId = safeProfile.selectedSnakeId;
  saveSoulsProfile(safeProfile);
}

function syncSoulsProfileFromModeState() {
  if (!appState.modeState || appState.modeState.mode !== "souls") {
    return;
  }

  const profile = SoulsProfile.selectSnake(
    appState.modeState.souls.profile,
    appState.modeState.souls.selectedSnakeId
  );
  setSoulsProfile(profile);
}

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
    // Ignore storage errors
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
  if (mode === "levels") return "Levels";
  if (mode === "souls") return "Souls";
  return "Traditional";
}

function formatSoulsStage(souls) {
  if (!souls) return "-";
  if (souls.stageType === "normal") return "Normal";
  if (souls.stageType === "boss") return `Boss ${souls.bossName ?? ""}`.trim();
  return `Boss Final ${souls.bossName ?? ""}`.trim();
}

function getStatusText() {
  if (!appState.modeState) {
    return "Ready";
  }

  if (appState.modeState.mode === "souls" && appState.modeState.souls.reward) {
    return "Escolha recompensa";
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

  if (modeState.mode === "souls") {
    for (const hazard of modeState.souls.hazards) {
      paintCell(hazard, "hazard");
    }

    if (modeState.souls.sigil) {
      paintCell(modeState.souls.sigil, "sigil");
    }

    if (modeState.souls.echo?.position) {
      paintCell(modeState.souls.echo.position, "echo");
    }
  }

  if (modeState.base.food) {
    paintCell(modeState.base.food, "food");
  }

  if (modeState.powerUp) {
    paintCell(modeState.powerUp, "power-up");
  }

  if (modeState.enemy) {
    const enemySize = modeState.enemy.size ?? 1;
    for (let dy = 0; dy < enemySize; dy += 1) {
      for (let dx = 0; dx < enemySize; dx += 1) {
        paintCell({ x: modeState.enemy.x + dx, y: modeState.enemy.y + dy }, "enemy");
      }
    }
  }

  const variantClass =
    modeState.mode === "souls" ? `variant-${modeState.souls.selectedSnakeId}` : null;

  for (let i = 0; i < modeState.base.snake.length; i += 1) {
    const segment = modeState.base.snake[i];
    const cell = cells[indexForPosition(segment)];
    if (!cell) continue;

    cell.classList.add("snake");
    if (variantClass) {
      cell.classList.add(variantClass);
    }

    if (i === 0) {
      cell.classList.add("head");
    }
  }
}

function renderHud(modeState) {
  if (!modeState) {
    modeLabelElement.textContent = "-";
    levelValueElement.textContent = "-";
    levelProgressElement.textContent = "-";
    shieldTimeElement.textContent = "0.0s";
    soulsFloorElement.textContent = "-";
    soulsCycleElement.textContent = "-";
    soulsStageElement.textContent = "-";
    soulsObjectiveElement.textContent = "-";
    soulsCarriedElement.textContent = "0";
    soulsWalletElement.textContent = String(appState.soulsProfile.walletRunes);
    soulsArmorElement.textContent = "0";
    return;
  }

  modeLabelElement.textContent = formatModeLabel(modeState.mode);

  if (modeState.mode === "levels") {
    levelValueElement.textContent = String(modeState.level);
    levelProgressElement.textContent = `${modeState.levelProgress}/${modeState.levelTarget}`;
    shieldTimeElement.textContent = `${(modeState.shieldMsRemaining / 1000).toFixed(1)}s`;
  } else {
    levelValueElement.textContent = "-";
    levelProgressElement.textContent = "-";
    shieldTimeElement.textContent = "0.0s";
  }

  if (modeState.mode === "souls") {
    const souls = modeState.souls;
    soulsFloorElement.textContent = String(souls.floor);
    soulsCycleElement.textContent = String(souls.cycle);
    soulsStageElement.textContent = formatSoulsStage(souls);
    soulsObjectiveElement.textContent = `${souls.objectiveProgress}/${souls.objectiveTarget}`;
    soulsCarriedElement.textContent = String(souls.carriedRunes);
    soulsWalletElement.textContent = String(souls.profile.walletRunes);
    soulsArmorElement.textContent = String(souls.armorCharges);
  } else {
    soulsFloorElement.textContent = "-";
    soulsCycleElement.textContent = "-";
    soulsStageElement.textContent = "-";
    soulsObjectiveElement.textContent = "-";
    soulsCarriedElement.textContent = "0";
    soulsWalletElement.textContent = String(appState.soulsProfile.walletRunes);
    soulsArmorElement.textContent = "0";
  }
}

function renderSoulsDeathSummary(modeState) {
  if (!modeState || modeState.mode !== "souls" || !modeState.isGameOver) {
    soulsDeathSummaryElement.classList.add("hidden");
    soulsDeathRunesElement.textContent = "0";
    soulsDeathEchoElement.textContent = "0";
    return;
  }

  soulsDeathSummaryElement.classList.remove("hidden");
  soulsDeathRunesElement.textContent = String(modeState.souls.lastDeathRunes);
  soulsDeathEchoElement.textContent = String(modeState.souls.lastDeathEcho);
}

function renderSoulsCountdown(modeState) {
  if (
    !modeState ||
    modeState.mode !== "souls" ||
    !modeState.souls.countdownMsRemaining ||
    modeState.souls.countdownMsRemaining <= 0
  ) {
    soulsCountdownElement.classList.add("hidden");
    return;
  }

  const value = Math.max(
    1,
    Math.min(3, Math.ceil(modeState.souls.countdownMsRemaining / 1000))
  );
  soulsCountdownElement.textContent = String(value);
  soulsCountdownElement.classList.remove("hidden");
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

function ensureTickerState() {
  if (!appState.modeState || appState.screen === SCREEN_MENU) {
    stopTicker();
    return;
  }

  const shouldStop =
    appState.modeState.isGameOver ||
    appState.modeState.isPaused ||
    (appState.modeState.mode === "souls" && appState.modeState.souls.reward);

  if (shouldStop) {
    stopTicker();
    return;
  }

  if (appState.currentTickMs !== appState.modeState.tickMs || appState.tickerId === null) {
    startTicker(appState.modeState.tickMs);
  }
}

function renderSoulsRewardModal() {
  const modeState = appState.modeState;
  const shouldShow =
    modeState &&
    modeState.mode === "souls" &&
    modeState.souls.reward &&
    appState.screen !== SCREEN_MENU;

  soulsRewardModalElement.classList.toggle("hidden", !shouldShow);
  soulsRewardOptionsElement.innerHTML = "";

  if (!shouldShow) {
    soulsRerollButton.disabled = true;
    return;
  }

  const reward = modeState.souls.reward;
  for (const powerId of reward.options) {
    const power = SoulsData.getPowerById(powerId);
    const currentStack = modeState.souls.powers[powerId] ?? 0;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "souls-reward-option";
    button.dataset.powerId = powerId;
    button.innerHTML = `<strong>${power?.name ?? powerId}</strong><small>${
      power?.description ?? ""
    }</small><small>Stack atual: ${currentStack}/${power?.maxStacks ?? 0}</small>`;

    button.addEventListener("click", () => {
      appState.modeState = chooseSoulsReward(appState.modeState, powerId);
      syncSoulsProfileFromModeState();
      setScreen(SCREEN_PLAYING);
      render();
      ensureTickerState();
    });

    soulsRewardOptionsElement.appendChild(button);
  }

  const canReroll =
    !reward.rerolled && modeState.souls.carriedRunes >= SoulsData.REROLL_COST;
  soulsRerollButton.disabled = !canReroll;
}

function renderSoulsMenu() {
  const isSoulsMode = modeSelect.value === "souls";
  soulsMenuElement.classList.toggle("hidden", !isSoulsMode);

  if (!isSoulsMode) {
    return;
  }

  const profile = appState.soulsProfile;
  soulsWalletMenuElement.textContent = String(profile.walletRunes);
  soulsClearsMenuElement.textContent = String(profile.finalBossClears);

  soulsSnakesElement.innerHTML = "";
  for (const snake of SoulsData.SNAKES) {
    const unlocked = profile.unlockedSnakeIds.includes(snake.id);
    const selected = appState.selectedSoulsSnakeId === snake.id;

    const card = document.createElement("div");
    card.className = `snake-card ${selected ? "active" : ""} ${
      unlocked ? "" : "locked"
    }`.trim();

    const title = document.createElement("div");
    title.className = "snake-card-title";
    title.innerHTML = `<span>${snake.name}</span>`;

    const dot = document.createElement("span");
    dot.className = "snake-color-dot";
    dot.style.background = snake.color;
    title.appendChild(dot);
    card.appendChild(title);

    const detail = document.createElement("small");
    if (snake.id === "basica") {
      detail.textContent = "Neutra.";
    } else if (snake.id === "veloz") {
      detail.textContent = "+velocidade, trava 1 tick após virar.";
    } else if (snake.id === "tanque") {
      detail.textContent = "+armadura, objetivo maior.";
    } else {
      detail.textContent = "+controle de sigilo, arena normal menor.";
    }
    card.appendChild(detail);

    const button = document.createElement("button");
    button.type = "button";

    if (!unlocked) {
      button.textContent = "Bloqueada";
      button.disabled = true;
    } else if (selected) {
      button.textContent = "Selecionada";
      button.disabled = true;
    } else {
      button.textContent = "Selecionar";
      button.addEventListener("click", () => {
        const updated = SoulsProfile.selectSnake(appState.soulsProfile, snake.id);
        setSoulsProfile(updated);
        render();
      });
    }

    card.appendChild(button);
    soulsSnakesElement.appendChild(card);
  }

  const nextUnlock = SoulsProfile.getNextUnlock(profile);
  if (!nextUnlock) {
    soulsUnlockLabelElement.textContent = "Todas as cobras já foram desbloqueadas.";
    soulsUnlockButton.disabled = true;
    return;
  }

  const requiredEligibility = nextUnlock.index + 1;
  const canByEligibility = profile.eligibleUnlocks >= requiredEligibility;
  const canByRunes = profile.walletRunes >= nextUnlock.cost;

  soulsUnlockLabelElement.textContent =
    `Próxima: ${SoulsData.getSnakeById(nextUnlock.snakeId).name} ` +
    `(custo ${nextUnlock.cost}, requisito boss final ${requiredEligibility}).`;

  soulsUnlockButton.disabled = !(canByEligibility && canByRunes);
}

function renderButtons(modeState) {
  const hasGame = Boolean(modeState);
  const isMenu = appState.screen === SCREEN_MENU;
  const isGameOver = hasGame && modeState.isGameOver;
  const waitingReward =
    hasGame && modeState.mode === "souls" && Boolean(modeState.souls.reward);

  pauseButton.disabled = !hasGame || isMenu || isGameOver || waitingReward;
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
  renderSoulsDeathSummary(modeState);
  renderSoulsCountdown(modeState);
  renderButtons(modeState);
  renderSoulsRewardModal();
  renderSoulsMenu();
}

function startGame(mode) {
  if (mode === "souls") {
    appState.modeState = createModeState({
      mode,
      soulsProfile: appState.soulsProfile,
      soulsSnakeId: appState.selectedSoulsSnakeId,
    });
  } else {
    appState.modeState = createModeState({
      mode,
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
    });
  }

  syncSoulsProfileFromModeState();
  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  render();
  ensureTickerState();
}

function restartGame() {
  if (!appState.modeState) return;

  appState.modeState = restartModeState(appState.modeState);
  syncSoulsProfileFromModeState();

  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  render();
  ensureTickerState();
}

function backToMenu() {
  syncSoulsProfileFromModeState();
  stopTicker();
  appState.modeState = null;
  setScreen(SCREEN_MENU);
  render();
}

function onTick() {
  if (!appState.modeState || appState.screen === SCREEN_MENU) {
    return;
  }

  appState.modeState = stepModeState(appState.modeState);
  syncSoulsProfileFromModeState();

  if (appState.modeState.isGameOver) {
    setScreen(SCREEN_GAMEOVER);
  }

  render();
  ensureTickerState();
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

  if (appState.modeState.mode === "souls" && appState.modeState.souls.reward) {
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
    ensureTickerState();
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

modeSelect.addEventListener("change", () => {
  render();
});

pauseButton.addEventListener("click", () => {
  if (!appState.modeState) return;
  appState.modeState = toggleModePause(appState.modeState);
  render();
  ensureTickerState();
});

restartButton.addEventListener("click", () => {
  restartGame();
});

menuButton.addEventListener("click", () => {
  backToMenu();
});

soulsUnlockButton.addEventListener("click", () => {
  const nextUnlock = SoulsProfile.getNextUnlock(appState.soulsProfile);
  if (!nextUnlock) return;

  const purchase = SoulsProfile.purchaseSnake(
    appState.soulsProfile,
    nextUnlock.snakeId
  );

  if (!purchase.ok) {
    return;
  }

  setSoulsProfile(purchase.profile);
  render();
});

soulsRerollButton.addEventListener("click", () => {
  if (!appState.modeState || appState.modeState.mode !== "souls") {
    return;
  }

  appState.modeState = rerollSoulsReward(appState.modeState);
  syncSoulsProfileFromModeState();
  render();
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
    if (appState.modeState.mode === "souls" && appState.modeState.souls.reward) {
      return;
    }

    const direction = button.dataset.direction;
    appState.modeState = queueModeDirection(appState.modeState, direction);
  });
}

applyTheme(getInitialTheme());
setScreen(SCREEN_MENU);
render();
