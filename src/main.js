"use strict";

const { directionFromInputKey } = window.SnakeLogic;
const SoulsData = window.SoulsData;
const SoulsProfile = window.SoulsProfile;
const DevCodes = window.DevCodes;
const { calculateFixedSteps } = window.SoulsLoop;
const {
  buildRewardRenderKey = () => null,
  canSelectReward = () => false,
} = window.SoulsUiHelpers || {};
const {
  createModeState,
  devSetSoulsBoss,
  devSetSoulsFloor,
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
const SOULS_FIXED_STEP_MS = 1000 / 90;
const SOULS_MAX_STEPS_PER_FRAME = 4;
const SOULS_MAX_FRAME_DELTA_MS = 120;

const appElement = document.querySelector(".app");
const menuScreenElement = document.getElementById("menu-screen");
const gameScreenElement = document.getElementById("game-screen");

const menuModeButtons = Array.from(
  document.querySelectorAll("[data-mode-option]")
);
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
const soulsPowersListElement = document.getElementById("souls-powers-list");

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
const soulsStageMessageElement = document.getElementById("souls-stage-message");
const soulsSigilArrowElement = document.getElementById("souls-sigil-arrow");
const soulsSigilDistanceElement = document.getElementById("souls-sigil-distance");
const soulsStaminaElement = document.getElementById("souls-stamina");
const soulsStaminaFillElement = document.getElementById("souls-stamina-fill");
const floatingPauseButton = document.getElementById("floating-pause-btn");
const bossIntelListElement = document.getElementById("boss-intel-list");
const devPanelElement = document.getElementById("dev-panel");
const devCodeInputElement = document.getElementById("dev-code-input");
const devCodeApplyButton = document.getElementById("dev-code-apply");
const devCodeFeedbackElement = document.getElementById("dev-code-feedback");

const initialSoulsProfile = loadSoulsProfileFromStorage();

const appState = {
  screen: SCREEN_MENU,
  modeState: null,
  tickerId: null,
  soulsRafId: null,
  soulsLastTs: null,
  soulsAccumulatorMs: 0,
  soulsPendingDirection: null,
  pressedDirections: new Set(),
  rewardRenderKey: null,
  isDevPanelOpen: false,
  devFeedback: "Digite um código e pressione Enter ou clique em Executar.",
  devFeedbackType: "info",
  currentTickMs: null,
  soulsProfile: initialSoulsProfile,
  selectedSoulsSnakeId: initialSoulsProfile.selectedSnakeId,
  selectedMenuMode: "traditional",
};

const initiallySelectedMenuButton = menuModeButtons.find((button) =>
  button.classList.contains("active")
);
if (initiallySelectedMenuButton) {
  appState.selectedMenuMode = normalizeMenuMode(
    initiallySelectedMenuButton.dataset.modeOption
  );
}

const cells = [];
let gridWidth = 0;
let gridHeight = 0;
let cellClassCache = [];
let cellOpacityCache = [];

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

function normalizeMenuMode(mode) {
  if (mode === "levels" || mode === "souls") {
    return mode;
  }
  return "traditional";
}

function getSelectedMenuMode() {
  return normalizeMenuMode(appState.selectedMenuMode);
}

function setSelectedMenuMode(mode) {
  appState.selectedMenuMode = normalizeMenuMode(mode);
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

function setSoulsUiDataset(modeState) {
  const isImmersiveSouls =
    modeState &&
    modeState.mode === "souls" &&
    appState.screen !== SCREEN_MENU &&
    !modeState.isGameOver &&
    !modeState.isPaused &&
    !modeState.souls.reward;

  appElement.dataset.soulsUi = isImmersiveSouls ? "immersive" : "panel";
}

function getViewportAspectRatio() {
  const width = Math.max(1, window.innerWidth || 1);
  const height = Math.max(1, window.innerHeight || 1);
  return width / height;
}

function getSoulsViewportOrigin(modeState) {
  if (!modeState || modeState.mode !== "souls") {
    return { originX: 0, originY: 0 };
  }

  const camera = modeState.souls.camera ?? {
    centerX: modeState.base.snake[0]?.x ?? 0,
    centerY: modeState.base.snake[0]?.y ?? 0,
  };
  const originX = camera.centerX - Math.floor(modeState.base.width / 2);
  const originY = camera.centerY - Math.floor(modeState.base.height / 2);
  return { originX, originY };
}

function toRenderPosition(modeState, position, origin) {
  if (!position) return null;
  if (!modeState || modeState.mode !== "souls") {
    return position;
  }

  return {
    x: position.x - origin.originX,
    y: position.y - origin.originY,
  };
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
  cellClassCache = new Array(cells.length).fill("cell");
  cellOpacityCache = new Array(cells.length).fill("");
}

function indexForPosition(position) {
  return position.y * gridWidth + position.x;
}

function isInsideGrid(position) {
  if (!position) return false;
  return (
    position.x >= 0 &&
    position.x < gridWidth &&
    position.y >= 0 &&
    position.y < gridHeight
  );
}

function renderBoard(modeState) {
  if (!modeState || cells.length === 0) {
    return;
  }

  const nextClassMap = new Array(cells.length).fill("cell");
  const nextOpacityMap = new Array(cells.length).fill("");
  const soulsOrigin = getSoulsViewportOrigin(modeState);

  const appendClassAt = (index, className) => {
    nextClassMap[index] += ` ${className}`;
  };

  const paint = (worldPosition, className, extraClass = null, opacity = null) => {
    const renderPosition = toRenderPosition(modeState, worldPosition, soulsOrigin);
    if (!renderPosition) return;
    if (!isInsideGrid(renderPosition)) return;
    const index = indexForPosition(renderPosition);
    appendClassAt(index, className);
    if (extraClass) {
      appendClassAt(index, extraClass);
    }
    if (opacity !== null) {
      nextOpacityMap[index] = String(opacity);
    }
  };

  for (const barrier of modeState.barriers) {
    paint(barrier, "barrier");
  }

  if (modeState.mode === "souls") {
    for (const hazard of modeState.souls.hazards) {
      paint(hazard, "hazard");
    }

    // Fixed order: hazards first, then teleport telegraph, then entities.
    const telegraph = modeState.souls.enemyTeleportPreview;
    if (telegraph) {
      const width = telegraph.width ?? telegraph.size ?? 1;
      const height = telegraph.height ?? telegraph.size ?? 1;
      for (let dy = 0; dy < height; dy += 1) {
        for (let dx = 0; dx < width; dx += 1) {
          paint({ x: telegraph.x + dx, y: telegraph.y + dy }, "telegraph");
        }
      }
    }

    if (modeState.souls.sigil) {
      paint(modeState.souls.sigil, "sigil");
    }

    if (modeState.souls.echo?.position) {
      paint(modeState.souls.echo.position, "echo");
    }
  }

  if (modeState.base.food) {
    paint(modeState.base.food, "food");
  }

  if (modeState.powerUp) {
    paint(modeState.powerUp, "power-up");
  }

  if (modeState.enemy) {
    const enemyWidth = modeState.enemy.width ?? modeState.enemy.size ?? 1;
    const enemyHeight = modeState.enemy.height ?? modeState.enemy.size ?? 1;
    for (let dy = 0; dy < enemyHeight; dy += 1) {
      for (let dx = 0; dx < enemyWidth; dx += 1) {
        paint({ x: modeState.enemy.x + dx, y: modeState.enemy.y + dy }, "enemy");
      }
    }
  }

  if (modeState.mode === "souls" && Array.isArray(modeState.souls.minions)) {
    for (const minion of modeState.souls.minions) {
      paint(minion, "enemy", "minion");
    }
  }

  const variantClass =
    modeState.mode === "souls" ? `variant-${modeState.souls.selectedSnakeId}` : null;
  const snakeLength = modeState.base.snake.length;

  for (let i = 0; i < modeState.base.snake.length; i += 1) {
    const segment = toRenderPosition(modeState, modeState.base.snake[i], soulsOrigin);
    if (!isInsideGrid(segment)) continue;
    const index = indexForPosition(segment);
    appendClassAt(index, "snake");
    if (variantClass) {
      appendClassAt(index, variantClass);
    }

    if (i === 0) {
      appendClassAt(index, "head");
      nextOpacityMap[index] = "1";
    } else {
      const ratio = snakeLength > 1 ? i / (snakeLength - 1) : 1;
      const opacity = Math.max(0.25, 1 - ratio * 0.75);
      nextOpacityMap[index] = opacity.toFixed(3);
    }
  }

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const nextClass = nextClassMap[index];
    if (cellClassCache[index] !== nextClass) {
      cell.className = nextClass;
      cellClassCache[index] = nextClass;
    }

    const nextOpacity = nextOpacityMap[index];
    if (cellOpacityCache[index] !== nextOpacity) {
      cell.style.opacity = nextOpacity;
      cellOpacityCache[index] = nextOpacity;
    }
  }
}

function renderBossIntelSidebar() {
  if (!bossIntelListElement || !SoulsData?.BOSS_INTEL) {
    return;
  }

  bossIntelListElement.innerHTML = "";
  const bossKills = appState.soulsProfile.bossKills ?? {};
  const bosses = Object.values(SoulsData.BOSS_INTEL);

  for (const boss of bosses) {
    const kills = bossKills[boss.id] ?? 0;
    const unlocked = kills > 0;

    const card = document.createElement("article");
    card.className = `boss-intel-card ${unlocked ? "" : "locked"}`.trim();

    const title = document.createElement("div");
    title.className = "boss-intel-title";
    title.innerHTML = `<strong>${boss.name}</strong>`;

    const tag = document.createElement("span");
    tag.className = "boss-intel-tag";
    tag.textContent = unlocked ? `${kills} vitória(s)` : "Bloqueado";
    title.appendChild(tag);
    card.appendChild(title);

    const mechanic = document.createElement("div");
    mechanic.className = "boss-intel-detail";
    mechanic.textContent = unlocked
      ? `Mecânica: ${boss.mechanic}`
      : "Derrote este chefe para revelar os detalhes.";
    card.appendChild(mechanic);

    const size = document.createElement("div");
    size.className = "boss-intel-detail";
    size.textContent = unlocked ? `Tamanho: ${boss.size}` : "Tamanho: ???";
    card.appendChild(size);

    const reward = document.createElement("div");
    reward.className = "boss-intel-detail";
    reward.textContent = unlocked ? `Recompensa: ${boss.reward}` : "Recompensa: ???";
    card.appendChild(reward);

    bossIntelListElement.appendChild(card);
  }
}

function renderSoulsPowersSidebar(modeState) {
  if (!soulsPowersListElement || !SoulsData?.POWER_POOL) {
    return;
  }

  soulsPowersListElement.innerHTML = "";
  const powers = modeState?.mode === "souls" ? modeState.souls.powers ?? {} : {};
  const collected = [];

  for (const power of SoulsData.POWER_POOL) {
    const stack = powers[power.id] ?? 0;
    if (stack > 0) {
      collected.push({ power, stack });
    }
  }

  if (collected.length === 0) {
    const empty = document.createElement("p");
    empty.className = "sidebar-muted";
    empty.textContent =
      modeState?.mode === "souls"
        ? "Nenhum poder coletado nesta run."
        : "Inicie uma run Souls para ver os poderes coletados.";
    soulsPowersListElement.appendChild(empty);
    return;
  }

  for (const entry of collected) {
    const card = document.createElement("article");
    card.className = "power-card";

    const title = document.createElement("div");
    title.className = "power-card-title";
    title.innerHTML = `<strong>${entry.power.name}</strong>`;

    const stack = document.createElement("span");
    stack.className = "power-stack";
    stack.textContent = `${entry.stack}/${entry.power.maxStacks}`;
    title.appendChild(stack);
    card.appendChild(title);

    const detail = document.createElement("p");
    detail.className = "power-card-detail";
    detail.textContent = entry.power.description;
    card.appendChild(detail);

    soulsPowersListElement.appendChild(card);
  }
}

function setDevFeedback(message, type = "info") {
  appState.devFeedback = message;
  appState.devFeedbackType =
    type === "success" || type === "error" ? type : "info";
}

function renderDevPanel() {
  if (!devPanelElement || !devCodeFeedbackElement) {
    return;
  }

  devPanelElement.classList.toggle("hidden", !appState.isDevPanelOpen);
  devCodeFeedbackElement.textContent = appState.devFeedback;
  devCodeFeedbackElement.className = `dev-feedback ${appState.devFeedbackType}`;
}

function toggleDevPanel() {
  appState.isDevPanelOpen = !appState.isDevPanelOpen;
  if (appState.isDevPanelOpen && devCodeInputElement) {
    window.setTimeout(() => {
      devCodeInputElement.focus();
      devCodeInputElement.select();
    }, 0);
  }
}

function ensureSoulsModeForDev() {
  if (appState.modeState && appState.modeState.mode === "souls") {
    return;
  }

  appState.modeState = createModeState({
    mode: "souls",
    soulsProfile: appState.soulsProfile,
    soulsSnakeId: appState.selectedSoulsSnakeId,
    viewportAspect: getViewportAspectRatio(),
  });
  appState.rewardRenderKey = null;
  syncSoulsProfileFromModeState();
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
}

function pickRandomPowerOptions(powers) {
  const pool = [];
  for (const power of SoulsData.POWER_POOL) {
    const stack = powers[power.id] ?? 0;
    if (stack < power.maxStacks) {
      pool.push(power.id);
    }
  }

  if (pool.length === 0) {
    return [];
  }

  const options = [];
  const count = Math.min(3, pool.length);
  for (let i = 0; i < count; i += 1) {
    const index = Math.floor(Math.random() * pool.length);
    options.push(pool[index]);
    pool.splice(index, 1);
  }

  return options;
}

function setModeStateGameOver(isGameOver) {
  if (!appState.modeState) {
    return;
  }

  appState.modeState = {
    ...appState.modeState,
    isGameOver,
    isPaused: false,
    base: {
      ...appState.modeState.base,
      isGameOver,
      isPaused: false,
    },
  };
}

function runDevCodeCommand(parsed) {
  const command = parsed.command;
  const params = parsed.params ?? {};

  if (command === "SOULS_FLOOR") {
    ensureSoulsModeForDev();
    appState.modeState = devSetSoulsFloor(appState.modeState, params.floor, {
      viewportAspect: getViewportAspectRatio(),
    });
    appState.rewardRenderKey = null;
    syncSoulsProfileFromModeState();
    setScreen(SCREEN_PLAYING);
    return `Floor alterado para ${appState.modeState.souls.floor}.`;
  }

  if (command === "SOULS_BOSS") {
    ensureSoulsModeForDev();
    appState.modeState = devSetSoulsBoss(appState.modeState, params.bossSlot, {
      viewportAspect: getViewportAspectRatio(),
    });
    appState.rewardRenderKey = null;
    syncSoulsProfileFromModeState();
    setScreen(SCREEN_PLAYING);
    return `Boss carregado no floor ${appState.modeState.souls.floor}.`;
  }

  if (command === "SCREEN") {
    if ((params.screen === "PLAYING" || params.screen === "GAMEOVER") && !appState.modeState) {
      startGame(getSelectedMenuMode());
    }

    if (params.screen === "MENU") {
      setScreen(SCREEN_MENU);
      return "Tela alterada para MENU.";
    }

    if (params.screen === "GAMEOVER") {
      setModeStateGameOver(true);
      setScreen(SCREEN_GAMEOVER);
      return "Tela alterada para GAMEOVER.";
    }

    setModeStateGameOver(false);
    setScreen(SCREEN_PLAYING);
    return "Tela alterada para PLAYING.";
  }

  if (command === "RUNAS_CARREGADAS") {
    ensureSoulsModeForDev();
    appState.modeState = {
      ...appState.modeState,
      souls: {
        ...appState.modeState.souls,
        carriedRunes: params.runes,
      },
    };
    return `Runas carregadas definidas para ${params.runes}.`;
  }

  if (command === "RUNAS_CARTEIRA") {
    const nextProfile = SoulsProfile.sanitizeProfile({
      ...appState.soulsProfile,
      walletRunes: params.runes,
    });
    setSoulsProfile(nextProfile);
    if (appState.modeState?.mode === "souls") {
      appState.modeState = {
        ...appState.modeState,
        souls: {
          ...appState.modeState.souls,
          profile: nextProfile,
        },
      };
    }
    return `Runas da carteira definidas para ${params.runes}.`;
  }

  if (command === "DESBLOQUEAR_PROXIMA") {
    const result = SoulsProfile.forceUnlockNext(appState.soulsProfile);
    if (!result.ok) {
      throw new Error("Todas as cobras já estão desbloqueadas.");
    }

    setSoulsProfile(result.profile);
    if (appState.modeState?.mode === "souls") {
      appState.modeState = {
        ...appState.modeState,
        souls: {
          ...appState.modeState.souls,
          profile: result.profile,
          selectedSnakeId: result.profile.selectedSnakeId,
        },
      };
    }
    return `Cobra desbloqueada: ${SoulsData.getSnakeById(result.snakeId).name}.`;
  }

  if (command === "DESBLOQUEAR_TODAS") {
    const result = SoulsProfile.forceUnlockAll(appState.soulsProfile);
    setSoulsProfile(result.profile);
    if (appState.modeState?.mode === "souls") {
      appState.modeState = {
        ...appState.modeState,
        souls: {
          ...appState.modeState.souls,
          profile: result.profile,
        },
      };
    }
    return "Todas as cobras do Souls foram desbloqueadas.";
  }

  if (command === "RECOMPENSA_AGORA") {
    ensureSoulsModeForDev();
    if (appState.modeState.souls.reward) {
      return "A recompensa já está aberta.";
    }

    const options = pickRandomPowerOptions(appState.modeState.souls.powers);
    if (options.length === 0) {
      throw new Error("Todos os poderes já estão no stack máximo.");
    }

    appState.modeState = {
      ...appState.modeState,
      isPaused: true,
      base: {
        ...appState.modeState.base,
        isPaused: true,
      },
      souls: {
        ...appState.modeState.souls,
        reward: {
          options,
          rerolled: false,
          source: appState.modeState.souls.stageType,
        },
        rewardRerolled: false,
        stageFlow: {
          ...(appState.modeState.souls.stageFlow ?? {}),
          phase: "reward",
          message: "Boss derrotado",
          nextFloor: appState.modeState.souls.floor + 1,
          msRemaining: 0,
        },
      },
    };
    appState.rewardRenderKey = null;
    setScreen(SCREEN_PLAYING);
    return "Recompensa aberta com sucesso.";
  }

  if (command === "RESET_PERFIL_SOULS") {
    const resetProfile = SoulsProfile.createDefaultProfile();
    setSoulsProfile(resetProfile);
    if (appState.modeState?.mode === "souls") {
      appState.modeState = {
        ...appState.modeState,
        souls: {
          ...appState.modeState.souls,
          profile: resetProfile,
          selectedSnakeId: resetProfile.selectedSnakeId,
        },
      };
    }
    return "Perfil Souls resetado.";
  }

  throw new Error("Código não implementado.");
}

function applyDevCodeInput() {
  const parser = DevCodes?.parseDevCode;
  if (!parser) {
    setDevFeedback("Parser de códigos não disponível.", "error");
    render();
    return;
  }

  const value = devCodeInputElement?.value ?? "";
  const parsed = parser(value);
  if (!parsed.ok) {
    setDevFeedback(parsed.error, "error");
    render();
    return;
  }

  try {
    const message = runDevCodeCommand(parsed);
    setDevFeedback(message, "success");
  } catch (error) {
    setDevFeedback(error?.message ?? "Falha ao aplicar código.", "error");
  }

  render();
  ensureTickerState();
}

function isHoldingCurrentDirection() {
  if (!appState.modeState) {
    return false;
  }

  const currentDirection = appState.modeState.base.direction;
  return appState.pressedDirections.has(currentDirection);
}

function getLegacyTickMsForCurrentInput(modeState) {
  const holdCurrentDirection = isHoldingCurrentDirection();
  const slowFactor = SoulsData.GLOBAL_SNAKE_SLOW_FACTOR ?? 0.88;

  if (modeState.mode === "traditional") {
    const base = 120;
    return holdCurrentDirection ? base : Math.max(1, Math.round(base / slowFactor));
  }

  if (modeState.mode === "levels") {
    const level = modeState.level ?? 1;
    const base = Math.max(70, 130 - (level - 1) * 5);
    return holdCurrentDirection ? base : Math.max(1, Math.round(base / slowFactor));
  }

  return modeState.tickMs;
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

function renderSoulsStageMessage(modeState) {
  if (!soulsStageMessageElement) {
    return;
  }

  if (!modeState || modeState.mode !== "souls") {
    soulsStageMessageElement.classList.add("hidden");
    return;
  }

  const stageFlow = modeState.souls.stageFlow;
  if (!stageFlow || stageFlow.phase !== "message" || !stageFlow.message) {
    soulsStageMessageElement.classList.add("hidden");
    return;
  }

  soulsStageMessageElement.textContent = stageFlow.message;
  soulsStageMessageElement.classList.remove("hidden");
}

function renderSoulsSigilArrow(modeState) {
  if (!soulsSigilArrowElement) {
    return;
  }

  if (!modeState || modeState.mode !== "souls") {
    soulsSigilArrowElement.classList.add("hidden");
    delete soulsSigilArrowElement.dataset.target;
    return;
  }

  const indicator = modeState.souls.sigilIndicator;
  if (!indicator?.visible) {
    soulsSigilArrowElement.classList.add("hidden");
    delete soulsSigilArrowElement.dataset.target;
    return;
  }

  soulsSigilArrowElement.dataset.target =
    modeState.souls.objectiveType === "food" ? "food" : "sigil";
  soulsSigilArrowElement.style.left = `${indicator.leftPercent}%`;
  soulsSigilArrowElement.style.top = `${indicator.topPercent}%`;
  soulsSigilArrowElement.style.transform = `translate(-50%, -50%) rotate(${indicator.angleDeg}deg)`;
  if (soulsSigilDistanceElement) {
    soulsSigilDistanceElement.textContent = String(indicator.distance);
  }
  soulsSigilArrowElement.classList.remove("hidden");
}

function renderSoulsStamina(modeState) {
  if (!soulsStaminaElement || !soulsStaminaFillElement) {
    return;
  }

  const showBar =
    modeState &&
    modeState.mode === "souls" &&
    appElement.dataset.soulsUi === "immersive" &&
    !modeState.isGameOver &&
    !modeState.souls.reward;

  soulsStaminaElement.classList.toggle("hidden", !showBar);
  if (!showBar) {
    soulsStaminaFillElement.style.width = "0%";
    delete soulsStaminaElement.dataset.phase;
    return;
  }

  const stamina = modeState.souls.stamina;
  const max = Math.max(1, stamina?.max ?? 1);
  const current = Math.max(0, Math.min(max, stamina?.current ?? max));
  const percent = Math.round((current / max) * 100);

  soulsStaminaElement.dataset.phase = stamina?.phase ?? "ready";
  soulsStaminaFillElement.style.width = `${percent}%`;
}

function renderFloatingPause(modeState) {
  if (!floatingPauseButton) {
    return;
  }

  const showButton =
    modeState &&
    modeState.mode === "souls" &&
    appState.screen !== SCREEN_MENU &&
    !modeState.isGameOver &&
    !modeState.souls.reward &&
    appElement.dataset.soulsUi === "immersive";

  floatingPauseButton.classList.toggle("hidden", !showButton);
  if (!showButton) {
    return;
  }

  floatingPauseButton.textContent = modeState.isPaused ? "Resume" : "Pause";
}

function stopTicker() {
  if (appState.tickerId !== null) {
    window.clearInterval(appState.tickerId);
    appState.tickerId = null;
    appState.currentTickMs = null;
  }

  if (appState.soulsRafId !== null) {
    window.cancelAnimationFrame(appState.soulsRafId);
    appState.soulsRafId = null;
  }
  appState.soulsLastTs = null;
  appState.soulsAccumulatorMs = 0;
  appState.soulsPendingDirection = null;
  appState.pressedDirections.clear();
}

function shouldRunSoulsRaf(modeState) {
  if (!modeState || modeState.mode !== "souls") {
    return false;
  }

  if (appState.screen === SCREEN_MENU || modeState.isGameOver || modeState.souls.reward) {
    return false;
  }

  if (modeState.isPaused && modeState.souls.stageFlow?.phase === "idle") {
    return false;
  }

  return true;
}

function startTicker(tickMs) {
  if (appState.soulsRafId !== null) {
    window.cancelAnimationFrame(appState.soulsRafId);
    appState.soulsRafId = null;
    appState.soulsLastTs = null;
    appState.soulsAccumulatorMs = 0;
    appState.soulsPendingDirection = null;
  }
  if (appState.tickerId !== null) {
    window.clearInterval(appState.tickerId);
  }
  appState.currentTickMs = tickMs;
  appState.tickerId = window.setInterval(onTick, tickMs);
}

function shouldBlockSoulsStep() {
  const modeState = appState.modeState;
  if (!modeState || modeState.mode !== "souls") {
    return true;
  }
  return (
    appState.screen === SCREEN_MENU ||
    modeState.isGameOver ||
    modeState.isPaused ||
    Boolean(modeState.souls.reward)
  );
}

function runSoulsFrame(timestamp) {
  if (!appState.modeState || appState.modeState.mode !== "souls") {
    appState.soulsRafId = null;
    return;
  }

  if (appState.soulsLastTs === null) {
    appState.soulsLastTs = timestamp;
  }
  const frameDeltaMs = Math.min(
    SOULS_MAX_FRAME_DELTA_MS,
    Math.max(0, timestamp - appState.soulsLastTs)
  );
  appState.soulsLastTs = timestamp;

  const schedule = calculateFixedSteps({
    accumulatorMs: appState.soulsAccumulatorMs,
    deltaMs: frameDeltaMs,
    fixedStepMs: SOULS_FIXED_STEP_MS,
    maxStepsPerFrame: SOULS_MAX_STEPS_PER_FRAME,
    dropOverflow: true,
  });
  appState.soulsAccumulatorMs = schedule.accumulatorAfterMs;

  if (!shouldBlockSoulsStep()) {
    for (let i = 0; i < schedule.steps; i += 1) {
      if (appState.soulsPendingDirection) {
        appState.modeState = queueModeDirection(
          appState.modeState,
          appState.soulsPendingDirection
        );
        appState.soulsPendingDirection = null;
      }

      appState.modeState = stepModeState(appState.modeState, {
        deltaMs: SOULS_FIXED_STEP_MS,
        holdCurrentDirection: isHoldingCurrentDirection(),
        viewportAspect: getViewportAspectRatio(),
      });
      syncSoulsProfileFromModeState();

      if (appState.modeState.isGameOver) {
        setScreen(SCREEN_GAMEOVER);
        break;
      }
    }
  }

  render();
  if (shouldRunSoulsRaf(appState.modeState)) {
    appState.soulsRafId = window.requestAnimationFrame(runSoulsFrame);
  } else {
    appState.soulsRafId = null;
  }
}

function startSoulsTicker() {
  if (appState.tickerId !== null) {
    window.clearInterval(appState.tickerId);
    appState.tickerId = null;
    appState.currentTickMs = null;
  }

  if (appState.soulsRafId !== null || !shouldRunSoulsRaf(appState.modeState)) {
    return;
  }

  appState.soulsLastTs = null;
  appState.soulsAccumulatorMs = 0;
  appState.soulsRafId = window.requestAnimationFrame(runSoulsFrame);
}

function ensureTickerState() {
  if (!appState.modeState || appState.screen === SCREEN_MENU) {
    stopTicker();
    return;
  }

  if (appState.modeState.mode === "souls") {
    if (shouldRunSoulsRaf(appState.modeState)) {
      startSoulsTicker();
    } else if (appState.soulsRafId !== null) {
      window.cancelAnimationFrame(appState.soulsRafId);
      appState.soulsRafId = null;
      appState.soulsLastTs = null;
      appState.soulsAccumulatorMs = 0;
    }
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

  const desiredTickMs = getLegacyTickMsForCurrentInput(appState.modeState);
  if (appState.currentTickMs !== desiredTickMs || appState.tickerId === null) {
    startTicker(desiredTickMs);
  }
}

function handleSoulsRewardSelect(powerId) {
  if (!canSelectReward(appState.modeState)) {
    return;
  }

  const reward = appState.modeState.souls.reward;
  if (!reward.options.includes(powerId)) {
    return;
  }

  appState.modeState = chooseSoulsReward(appState.modeState, powerId);
  appState.rewardRenderKey = null;
  syncSoulsProfileFromModeState();
  setScreen(SCREEN_PLAYING);
  render();
  ensureTickerState();
}

function renderSoulsRewardModal() {
  const modeState = appState.modeState;
  const shouldShow =
    modeState &&
    modeState.mode === "souls" &&
    modeState.souls.reward &&
    appState.screen !== SCREEN_MENU;

  soulsRewardModalElement.classList.toggle("hidden", !shouldShow);

  if (!shouldShow) {
    soulsRerollButton.disabled = true;
    if (appState.rewardRenderKey !== null) {
      soulsRewardOptionsElement.innerHTML = "";
      appState.rewardRenderKey = null;
    }
    return;
  }

  const reward = modeState.souls.reward;
  const rewardKey = buildRewardRenderKey(reward, modeState.souls.powers);

  if (rewardKey !== appState.rewardRenderKey) {
    soulsRewardOptionsElement.innerHTML = "";

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

      let handled = false;
      const select = (event) => {
        if (event) {
          event.preventDefault();
        }
        if (handled) return;
        handled = true;
        handleSoulsRewardSelect(powerId);
      };

      button.addEventListener("pointerdown", select);
      button.addEventListener("click", select);
      soulsRewardOptionsElement.appendChild(button);
    }

    appState.rewardRenderKey = rewardKey;
  }

  const canReroll =
    !reward.rerolled && modeState.souls.carriedRunes >= SoulsData.REROLL_COST;
  soulsRerollButton.disabled = !canReroll;
}

function renderMenuModeOptions() {
  const selectedMode = getSelectedMenuMode();

  for (const button of menuModeButtons) {
    const mode = normalizeMenuMode(button.dataset.modeOption);
    const isActive = mode === selectedMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  }

  startButton.textContent = `Iniciar ${formatModeLabel(selectedMode)}`;
}

function renderSoulsMenu() {
  const isSoulsMode = getSelectedMenuMode() === "souls";
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
  setSoulsUiDataset(modeState);
  scoreElement.textContent = String(modeState ? modeState.base.score : 0);
  statusElement.textContent = getStatusText();

  if (modeState) {
    ensureGrid(modeState.base.width, modeState.base.height);
    renderBoard(modeState);
  }

  renderHud(modeState);
  renderSoulsDeathSummary(modeState);
  renderSoulsCountdown(modeState);
  renderSoulsStageMessage(modeState);
  renderSoulsSigilArrow(modeState);
  renderSoulsStamina(modeState);
  renderFloatingPause(modeState);
  renderButtons(modeState);
  renderSoulsRewardModal();
  renderMenuModeOptions();
  renderSoulsMenu();
  renderBossIntelSidebar();
  renderSoulsPowersSidebar(modeState);
  renderDevPanel();
}

function startGame(mode) {
  if (mode === "souls") {
    appState.modeState = createModeState({
      mode,
      soulsProfile: appState.soulsProfile,
      soulsSnakeId: appState.selectedSoulsSnakeId,
      viewportAspect: getViewportAspectRatio(),
    });
  } else {
    appState.modeState = createModeState({
      mode,
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
    });
  }

  appState.soulsPendingDirection = null;
  appState.pressedDirections.clear();
  appState.rewardRenderKey = null;
  syncSoulsProfileFromModeState();
  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  render();
  ensureTickerState();
}

function restartGame() {
  if (!appState.modeState) return;

  appState.modeState = restartModeState(appState.modeState, {
    viewportAspect: getViewportAspectRatio(),
  });
  appState.soulsPendingDirection = null;
  appState.pressedDirections.clear();
  appState.rewardRenderKey = null;
  syncSoulsProfileFromModeState();

  setScreen(SCREEN_PLAYING);
  ensureGrid(appState.modeState.base.width, appState.modeState.base.height);
  render();
  ensureTickerState();
}

function backToMenu() {
  syncSoulsProfileFromModeState();
  stopTicker();
  appState.rewardRenderKey = null;
  appState.modeState = null;
  setScreen(SCREEN_MENU);
  render();
}

function onTick() {
  if (!appState.modeState || appState.screen === SCREEN_MENU) {
    return;
  }

  appState.modeState = stepModeState(appState.modeState, {
    holdCurrentDirection: isHoldingCurrentDirection(),
    viewportAspect: getViewportAspectRatio(),
  });
  syncSoulsProfileFromModeState();

  if (appState.modeState.isGameOver) {
    setScreen(SCREEN_GAMEOVER);
  }

  render();
  ensureTickerState();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "F2") {
    event.preventDefault();
    toggleDevPanel();
    render();
    return;
  }

  if (document.activeElement === devCodeInputElement) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyDevCodeInput();
    }
    return;
  }

  if (appState.screen === SCREEN_MENU && event.key === "Enter") {
    event.preventDefault();
    startGame(getSelectedMenuMode());
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
    appState.pressedDirections.add(direction);
    if (appState.modeState.mode === "souls") {
      appState.soulsPendingDirection = direction;
    } else {
      appState.modeState = queueModeDirection(appState.modeState, direction);
      ensureTickerState();
    }
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

document.addEventListener("keyup", (event) => {
  const direction = directionFromInputKey(event.key);
  if (!direction) {
    return;
  }

  appState.pressedDirections.delete(direction);
  if (appState.modeState && appState.modeState.mode !== "souls") {
    ensureTickerState();
  }
});

window.addEventListener("blur", () => {
  appState.pressedDirections.clear();
  if (appState.modeState && appState.modeState.mode !== "souls") {
    ensureTickerState();
  }
});

startButton.addEventListener("click", () => {
  startGame(getSelectedMenuMode());
});

for (const button of menuModeButtons) {
  button.addEventListener("click", () => {
    setSelectedMenuMode(button.dataset.modeOption);
    render();
  });
}

pauseButton.addEventListener("click", () => {
  if (!appState.modeState) return;
  appState.modeState = toggleModePause(appState.modeState);
  render();
  ensureTickerState();
});

if (floatingPauseButton) {
  floatingPauseButton.addEventListener("click", () => {
    if (!appState.modeState) return;
    appState.modeState = toggleModePause(appState.modeState);
    render();
    ensureTickerState();
  });
}

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

if (devCodeApplyButton) {
  devCodeApplyButton.addEventListener("click", () => {
    applyDevCodeInput();
  });
}

if (themeToggle) {
  themeToggle.addEventListener("change", () => {
    const nextTheme = themeToggle.checked ? "dark" : "light";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
  });
}

for (const button of touchButtons) {
  const direction = button.dataset.direction;
  if (!direction) continue;

  const pressDirection = (event) => {
    if (event) {
      event.preventDefault();
    }
    if (!appState.modeState) return;
    if (appState.modeState.mode === "souls" && appState.modeState.souls.reward) {
      return;
    }

    appState.pressedDirections.add(direction);
    if (appState.modeState.mode === "souls") {
      appState.soulsPendingDirection = direction;
    } else {
      appState.modeState = queueModeDirection(appState.modeState, direction);
      ensureTickerState();
    }
  };

  const releaseDirection = () => {
    appState.pressedDirections.delete(direction);
    if (appState.modeState && appState.modeState.mode !== "souls") {
      ensureTickerState();
    }
  };

  button.addEventListener("pointerdown", pressDirection);
  button.addEventListener("pointerup", releaseDirection);
  button.addEventListener("pointercancel", releaseDirection);
  button.addEventListener("pointerleave", releaseDirection);

  // Fallback for non-pointer environments.
  button.addEventListener("click", (event) => {
    if (!window.PointerEvent) {
      pressDirection(event);
      releaseDirection();
    }
  });
}

applyTheme(getInitialTheme());
setScreen(SCREEN_MENU);
render();
