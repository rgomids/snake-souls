"use strict";

/**
 * main.js — Bootstrap da aplicação Snake Souls.
 *
 * Responsabilidades (APENAS):
 *  - Importar módulos de jogo e GameApp
 *  - Consultar o DOM para obter todas as referências necessárias
 *  - Carregar estado inicial (perfil e configurações) do localStorage
 *  - Instanciar e inicializar o GameApp
 *
 * Sem lógica de gameplay, sem lógica de rendering, sem globals window.*.
 */

const SnakeModes     = require("./modes/snake-modes.js");
const SoulsProfile   = require("./profile/souls-profile.js");
const SoulsData      = require("./data/souls-data.js");
const SnakeLogic     = require("./core/snake-logic.js");
const DevCodes       = require("./dev/dev-codes.js");
const SoulsLoop      = require("./game/souls-loop.js");
const SoulsUiHelpers = require("./ui/souls-ui-helpers.js");
const GameApp        = require("./game/game-app.js");

// ── Helpers de carga de estado inicial ──────────────────────────────────────

function loadInitialProfile() {
  try {
    const raw = window.localStorage.getItem(SoulsData.STORAGE_KEY);
    if (!raw) return SoulsProfile.createDefaultProfile();
    const parsed = SoulsProfile.loadProfile(raw);
    return SoulsProfile.sanitizeProfile(parsed);
  } catch {
    return SoulsProfile.createDefaultProfile();
  }
}

function loadInitialUiSettings() {
  try {
    const raw = window.localStorage.getItem(GameApp.SETTINGS_KEY);
    if (!raw) return { mobileControl: "dpad" };
    const parsed = JSON.parse(raw);
    const mc = parsed.mobileControl;
    return { mobileControl: (mc === "swipe" || mc === "tap") ? mc : "dpad" };
  } catch {
    return { mobileControl: "dpad" };
  }
}

// ── Consulta de DOM ──────────────────────────────────────────────────────────

const qs   = (id) => document.getElementById(id);
const qsa  = (sel) => Array.from(document.querySelectorAll(sel));

const deps = {
  // Módulos de jogo
  SnakeModes,
  SoulsProfile,
  SoulsData,
  SnakeLogic,
  DevCodes,
  SoulsLoop,
  SoulsUiHelpers,

  // Contêiner principal (raiz HTML para data-* de tema/modo/tela)
  appEl:             document.querySelector(".app"),

  // Telas
  menuScreenEl:      qs("menu-screen"),
  gameScreenEl:      qs("game-screen"),

  // Canvas do board
  gridEl:            qs("grid"),

  // HUD básico
  scoreEl:           qs("score"),
  statusEl:          qs("status"),
  modeLabelEl:       qs("mode-label"),
  levelValueEl:      qs("level-value"),
  levelProgressEl:   qs("level-progress"),
  shieldTimeEl:      qs("shield-time"),

  // HUD Souls
  soulsFloorEl:      qs("souls-floor"),
  soulsCycleEl:      qs("souls-cycle"),
  soulsStageEl:      qs("souls-stage"),
  soulsObjectiveEl:  qs("souls-objective"),
  soulsCarriedEl:    qs("souls-carried"),
  soulsWalletEl:     qs("souls-wallet"),
  soulsArmorEl:      qs("souls-armor"),

  // Botões de controle do jogo
  pauseBtn:          qs("pause-btn"),
  restartBtn:        qs("restart-btn"),
  menuBtn:           qs("menu-btn"),
  startBtn:          qs("start-btn"),

  // HUD imersivo Souls
  floatingPauseEl:       qs("floating-pause-btn"),
  soulsRewardModalEl:    qs("souls-reward-modal"),
  soulsRewardOptionsEl:  qs("souls-reward-options"),
  soulsRerollBtn:        qs("souls-reroll-btn"),
  soulsDeathSummaryEl:   qs("souls-death-summary"),
  soulsDeathRunesEl:     qs("souls-death-runes"),
  soulsDeathEchoEl:      qs("souls-death-echo"),
  soulsCountdownEl:      qs("souls-countdown"),
  soulsStageMessageEl:   qs("souls-stage-message"),
  soulsSigilArrowEl:     qs("souls-sigil-arrow"),
  soulsSigilDistanceEl:  qs("souls-sigil-distance"),
  soulsStaminaEl:        qs("souls-stamina"),
  soulsStaminaFillEl:    qs("souls-stamina-fill"),

  // Sidebars
  bossIntelListEl:   qs("boss-intel-list"),
  soulsPowersListEl: qs("souls-powers-list"),

  // Painel dev
  devPanelEl:        qs("dev-panel"),
  devCodeInputEl:    qs("dev-code-input"),
  devCodeApplyEl:    qs("dev-code-apply"),
  devCodeFeedbackEl: qs("dev-code-feedback"),

  // Game over
  gameOverPanelEl:      qs("gameover-panel"),
  gameOverSummaryEl:    qs("gameover-summary"),
  gameOverModeEl:       qs("gameover-mode"),
  gameOverScoreEl:      qs("gameover-score"),
  gameOverLengthEl:     qs("gameover-length"),
  gameOverTimeEl:       qs("gameover-time"),
  gameOverExtraTitleEl: qs("gameover-extra-title"),
  gameOverExtraEl:      qs("gameover-extra"),
  gameOverRestartBtn:   qs("gameover-restart-btn"),
  gameOverMenuBtn:      qs("gameover-menu-btn"),

  // Menu — configurações
  settingsMenuEl:       qs("settings-menu"),
  menuSettingsOptionBtn: qs("menu-settings-option"),

  // Menu — lista de modos
  menuEasterEggStatusEl: qs("menu-easter-egg-status"),

  // Menu — painel Souls
  soulsMenuEl:       qs("souls-menu"),
  soulsSnakesEl:     qs("souls-snakes"),
  soulsWalletMenuEl: qs("souls-wallet-menu"),
  soulsClearsMenuEl: qs("souls-clears-menu"),
  soulsUnlockLabelEl: qs("souls-unlock-label"),
  soulsUnlockBtn:    qs("souls-unlock-btn"),

  // Footer / versão
  gameVersionEl:     qs("game-version"),

  // Instruções
  instructionsToggleBtn: qs("instructions-toggle-btn"),
  instructionsListEl:    qs("instructions-list"),

  // Área de gesto (canvas wrapper — usa .game-area como fallback)
  gameAreaEl:        document.querySelector(".game-area"),

  // Listas dinâmicas
  menuModeBtns:       qsa("[data-mode-option]"),
  touchBtns:          qsa("[data-direction]"),
  mobileControlInputs: qsa("input[name='mobile-control']"),

  // Estado inicial
  initialProfile:    loadInitialProfile(),
  initialUiSettings: loadInitialUiSettings(),
};

// ── Inicialização ────────────────────────────────────────────────────────────

const app = new GameApp(deps);
app.init();
