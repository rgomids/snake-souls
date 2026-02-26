"use strict";

/**
 * GameApp — Composition Root do Snake Souls.
 *
 * Responsabilidades:
 *  - Instanciar e conectar todos os subsistemas (renderers, loop, inputs, UI)
 *  - Gerenciar o ciclo de vida: menu → start → playing → gameover → restart
 *  - Encaminhar inputs do usuário para a lógica correta
 *  - Sincronizar estado de jogo com renderers e persistência
 *
 * Princípio DIP: todos os módulos de lógica e referências DOM são injetados
 *   via construtor — não há import/require de módulos de domínio aqui.
 * Princípio SRP: não contém lógica de gameplay nem rendering de canvas.
 */

const AudioManager       = require("../audio/audio-manager.js");
const BoardRenderer      = require("../render/board-renderer.js");
const HudRenderer        = require("../render/hud-renderer.js");
const SoulsHudRenderer   = require("../render/souls-hud-renderer.js");
const WeaponHudRenderer  = require("../render/weapon-hud-renderer.js");
const ScreenManager    = require("../ui/screen-manager.js");
const RewardModal      = require("../ui/reward-modal.js");
const { BossIntelSidebar, PowersSidebar } = require("../ui/sidebars.js");
const DevPanel         = require("../dev/dev-panel.js");
const GameLoop         = require("./game-loop.js");
const KonamiTracker    = require("../input/konami-tracker.js");

class GameApp {
  // ── Constants ──────────────────────────────────────────────────────────────
  static GRID_WIDTH            = 20;
  static GRID_HEIGHT           = 20;
  static SETTINGS_KEY          = "snake-settings-v1";
  static GAME_VERSION          = "v0.15.0";
  static SCREEN_MENU           = "menu";
  static SCREEN_PLAYING        = "playing";
  static SCREEN_GAMEOVER       = "gameover";
  static SOULS_FIXED_STEP_MS   = 1000 / 90;
  static SOULS_MAX_STEPS       = 4;
  static SOULS_MAX_FRAME_DELTA = 120;

  /**
   * @param {object} deps
   *
   * ── Módulos de jogo (IIFEs com module.exports) ──
   * @param {object} deps.SnakeModes      { createModeState, stepModeState, ... }
   * @param {object} deps.SoulsProfile    funções de perfil
   * @param {object} deps.SoulsData       constantes + lookups de dados
   * @param {object} deps.SnakeLogic      { directionFromInputKey, ... }
   * @param {object} deps.DevCodes        { parseDevCode }
   * @param {object} deps.SoulsLoop       { calculateFixedSteps }
   * @param {object} deps.SoulsUiHelpers  { buildRewardRenderKey, canSelectReward }
   *
   * ── Elementos DOM ──
   * @param {HTMLElement}       deps.appEl
   * @param {HTMLElement}       deps.menuScreenEl
   * @param {HTMLElement}       deps.gameScreenEl
   * @param {HTMLCanvasElement} deps.gridEl
   * @param {HTMLElement}       deps.scoreEl
   * @param {HTMLElement}       deps.statusEl
   * @param {HTMLElement}       deps.modeLabelEl
   * @param {HTMLElement}       deps.levelValueEl
   * @param {HTMLElement}       deps.levelProgressEl
   * @param {HTMLElement}       deps.shieldTimeEl
   * @param {HTMLElement}       deps.soulsFloorEl
   * @param {HTMLElement}       deps.soulsCycleEl
   * @param {HTMLElement}       deps.soulsStageEl
   * @param {HTMLElement}       deps.soulsObjectiveEl
   * @param {HTMLElement}       deps.soulsCarriedEl
   * @param {HTMLElement}       deps.soulsWalletEl
   * @param {HTMLElement}       deps.soulsArmorEl
   * @param {HTMLElement}       deps.pauseBtn
   * @param {HTMLElement}       deps.restartBtn
   * @param {HTMLElement}       deps.menuBtn
   * @param {HTMLElement}       deps.startBtn
   * @param {HTMLElement}       deps.floatingPauseEl
   * @param {HTMLElement}       deps.soulsRewardModalEl
   * @param {HTMLElement}       deps.soulsRewardOptionsEl
   * @param {HTMLElement}       deps.soulsRerollBtn
   * @param {HTMLElement}       deps.soulsDeathSummaryEl
   * @param {HTMLElement}       deps.soulsDeathRunesEl
   * @param {HTMLElement}       deps.soulsDeathEchoEl
   * @param {HTMLElement}       deps.soulsCountdownEl
   * @param {HTMLElement}       deps.soulsStageMessageEl
   * @param {HTMLElement}       deps.soulsSigilArrowEl
   * @param {HTMLElement}       deps.soulsSigilDistanceEl
   * @param {HTMLElement}       deps.soulsStaminaEl
   * @param {HTMLElement}       deps.soulsStaminaFillEl
   * @param {HTMLElement}       deps.bossIntelListEl
   * @param {HTMLElement}       deps.soulsPowersListEl
   * @param {HTMLElement}       deps.devPanelEl
   * @param {HTMLInputElement}  deps.devCodeInputEl
   * @param {HTMLElement}       deps.devCodeApplyEl
   * @param {HTMLElement}       deps.devCodeFeedbackEl
   * @param {HTMLElement}       deps.gameOverPanelEl
   * @param {HTMLElement}       deps.gameOverSummaryEl
   * @param {HTMLElement}       deps.gameOverModeEl
   * @param {HTMLElement}       deps.gameOverScoreEl
   * @param {HTMLElement}       deps.gameOverLengthEl
   * @param {HTMLElement}       deps.gameOverTimeEl
   * @param {HTMLElement}       deps.gameOverExtraTitleEl
   * @param {HTMLElement}       deps.gameOverExtraEl
   * @param {HTMLElement}       deps.gameOverRestartBtn
   * @param {HTMLElement}       deps.gameOverMenuBtn
   * @param {HTMLElement}       deps.settingsMenuEl
   * @param {HTMLElement}       deps.menuSettingsOptionBtn
   * @param {HTMLElement}       deps.menuEasterEggStatusEl
   * @param {HTMLElement}       deps.soulsMenuEl
   * @param {HTMLElement}       deps.soulsSnakesEl
   * @param {HTMLElement}       deps.soulsWalletMenuEl
   * @param {HTMLElement}       deps.soulsClearsMenuEl
   * @param {HTMLElement}       deps.soulsUnlockLabelEl
   * @param {HTMLElement}       deps.soulsUnlockBtn
   * @param {HTMLElement}       deps.gameVersionEl
   * @param {HTMLElement}       deps.instructionsToggleBtn
   * @param {HTMLElement}       deps.instructionsListEl
   * @param {HTMLElement}       deps.gameAreaEl
   * @param {HTMLElement[]}     deps.menuModeBtns
   * @param {HTMLElement[]}     deps.touchBtns
   * @param {HTMLInputElement[]} deps.mobileControlInputs
   *
   * ── Estado inicial ──
   * @param {object} deps.initialProfile
   * @param {object} deps.initialUiSettings
   */
  constructor(deps) {
    // ── Módulos de jogo ───────────────────────────────────────────────────────
    this._SM  = deps.SnakeModes;
    this._SP  = deps.SoulsProfile;
    this._SD  = deps.SoulsData;
    this._SLG = deps.SnakeLogic;
    this._DC  = deps.DevCodes;
    this._SL  = deps.SoulsLoop;
    this._SUH = deps.SoulsUiHelpers ?? {};

    // ── Referências DOM (acesso via this._d.<key>) ────────────────────────────
    this._d = deps;

    // ── Cache de cores CSS ────────────────────────────────────────────────────
    this._colorCache = null;

    // ── Subsistemas OOP ───────────────────────────────────────────────────────
    this._boardRenderer = new BoardRenderer({
      canvas:   deps.gridEl,
      getColor: (name) => this._getColor(name),
    });

    this._hudRenderer = new HudRenderer({
      modeLabelEl:      deps.modeLabelEl,
      levelValueEl:     deps.levelValueEl,
      levelProgressEl:  deps.levelProgressEl,
      shieldTimeEl:     deps.shieldTimeEl,
      soulsFloorEl:     deps.soulsFloorEl,
      soulsCycleEl:     deps.soulsCycleEl,
      soulsStageEl:     deps.soulsStageEl,
      soulsObjectiveEl: deps.soulsObjectiveEl,
      soulsCarriedEl:   deps.soulsCarriedEl,
      soulsWalletEl:    deps.soulsWalletEl,
      soulsArmorEl:     deps.soulsArmorEl,
      formatModeLabel:  (m) => this._formatModeLabel(m),
      formatSoulsStage: (s) => this._formatSoulsStage(s),
      getWalletRunes:   () => this._profile?.walletRunes ?? 0,
    });

    this._weaponHud = new WeaponHudRenderer({
      containerEl: deps.weaponHudEl,
      weaponDefs:  deps.weaponDefs ?? [],
    });

    this._soulsHud = new SoulsHudRenderer({
      countdownEl:     deps.soulsCountdownEl,
      stageMessageEl:  deps.soulsStageMessageEl,
      sigilArrowEl:    deps.soulsSigilArrowEl,
      sigilDistanceEl: deps.soulsSigilDistanceEl,
      staminaEl:       deps.soulsStaminaEl,
      staminaFillEl:   deps.soulsStaminaFillEl,
      deathSummaryEl:  deps.soulsDeathSummaryEl,
      deathRunesEl:    deps.soulsDeathRunesEl,
      deathEchoEl:     deps.soulsDeathEchoEl,
      floatingPauseEl: deps.floatingPauseEl,
      isSoulsImmersive: () => this._isImmersiveSouls(),
      getCurrentScreen: () => this._screen,
      screenMenuId:    GameApp.SCREEN_MENU,
    });

    this._screenMgr = new ScreenManager({
      appEl:        deps.appEl,
      menuScreenEl: deps.menuScreenEl,
      gameScreenEl: deps.gameScreenEl,
    });

    this._rewardModal = new RewardModal({
      modalEl:        deps.soulsRewardModalEl,
      optionsEl:      deps.soulsRewardOptionsEl,
      rerollBtn:      deps.soulsRerollBtn,
      getPowerById:   (id) => this._SD.getPowerById(id),
      buildRenderKey: (r, p) => (this._SUH.buildRewardRenderKey ?? (() => null))(r, p),
      onSelectPower:  (id) => this._handleRewardSelect(id),
      onReroll:       () => this._handleReroll(),
      rerollCost:     this._SD.REROLL_COST ?? 30,
      screenMenu:     GameApp.SCREEN_MENU,
    });

    this._bossIntel = new BossIntelSidebar({
      listEl:    deps.bossIntelListEl,
      bossIntel: Object.values(this._SD.BOSS_INTEL ?? {}),
    });

    this._powersSidebar = new PowersSidebar({
      listEl:    deps.soulsPowersListEl,
      powerPool: this._SD.POWER_POOL ?? [],
    });

    this._devPanel = new DevPanel({
      panelEl:    deps.devPanelEl,
      inputEl:    deps.devCodeInputEl,
      feedbackEl: deps.devCodeFeedbackEl,
      parseCommand: (raw) => {
        const r = this._DC?.parseDevCode?.(raw);
        return r?.ok ? r : null;
      },
      executeCommand: (parsed) => this._executeDevCommand(parsed),
    });

    this._gameLoop = new GameLoop({
      stepFn:              (dt) => this._onStep(dt),
      renderFn:            (opts) => this._renderAll(opts),
      calculateFixedSteps: (opts) => (this._SL?.calculateFixedSteps ?? GameLoop._defaultCalcFixed)(opts),
      shouldRunRaf:        () => this._shouldRunSoulsRaf(),
      fixedStepMs:         GameApp.SOULS_FIXED_STEP_MS,
      maxStepsPerFrame:    GameApp.SOULS_MAX_STEPS,
      maxFrameDeltaMs:     GameApp.SOULS_MAX_FRAME_DELTA,
    });

    this._konamiTracker = new KonamiTracker();

    // ── Estado da aplicação ───────────────────────────────────────────────────
    this._screen                    = GameApp.SCREEN_MENU;
    this._modeState                 = null;
    this._profile                   = deps.initialProfile ?? this._SP.createDefaultProfile();
    this._uiSettings                = deps.initialUiSettings ?? { mobileControl: "dpad" };
    this._selectedMenuMode          = "traditional";
    this._legacyModesUnlocked       = false;
    this._isSettingsOpen            = false;
    this._mobileInstructionsExpanded = false;
    this._pressedDirections         = new Set();
    this._runStartedMs              = 0;
    this._runEndedMs                = null;
    this._soulsInterpState          = null;
    this._gestureSession            = null;

    // ── Áudio ────────────────────────────────────────────────────────────────────
    this._audio = new AudioManager();
  }

  // ── Inicialização ───────────────────────────────────────────────────────────

  /** Aplica tema, registra eventos DOM e exibe menu inicial. */
  init() {
    this._applyTheme();
    this._attachEvents();
    this._audio.init();
    this._setScreen(GameApp.SCREEN_MENU);
    this._renderAll();
    // O browser bloqueia audio.play() antes da primeira interação do usuário.
    // Registramos um listener de captura de uso único que dispara o BGM do menu
    // assim que houver qualquer interação (click ou tecla), garantindo que a
    // política de autoplay seja respeitada.
    const unlockAudio = () => {
      document.removeEventListener("click",   unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
      if (this._screen === GameApp.SCREEN_MENU) {
        this._audio.playBgm(AudioManager.BGM_MENU);
      }
    };
    document.addEventListener("click",   unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
  }

  // ── Ciclo de vida ───────────────────────────────────────────────────────────

  /** Inicia um novo jogo.  @param {"traditional"|"levels"|"souls"} mode */
  startGame(mode) {
    this._resetMenuSession();
    this._isSettingsOpen = false;

    this._modeState = mode === "souls"
      ? this._SM.createModeState({
          mode,
          soulsProfile:   this._profile,
          soulsSnakeId:   this._profile.selectedSnakeId,
          viewportAspect: this._getViewportAspectRatio(),
        })
      : mode === "traditional"
        ? this._SM.createModeState({ mode, viewportAspect: this._getViewportAspectRatio() })
        : this._SM.createModeState({ mode, width: GameApp.GRID_WIDTH, height: GameApp.GRID_HEIGHT });

    this._pressedDirections.clear();
    this._soulsInterpState = null;
    this._gameLoop.resetRafTiming();
    this._runStartedMs = Date.now();
    this._runEndedMs   = null;
    this._syncProfileFromModeState();
    this._setScreen(GameApp.SCREEN_PLAYING);
    this._audio.playBgm(AudioManager.BGM_MUSIC);
    this._boardRenderer.ensureSize(this._modeState.base.width, this._modeState.base.height,
      this._computeCellPx(this._modeState.base.width, this._modeState.base.height));
    this._renderAll();
    this._ensureLoop();
  }

  /** Reinicia o jogo atual sem voltar ao menu. */
  restartGame() {
    if (!this._modeState) return;
    this._modeState = this._SM.restartModeState(this._modeState, {
      viewportAspect: this._getViewportAspectRatio(),
    });
    this._pressedDirections.clear();
    this._soulsInterpState = null;
    this._gameLoop.resetRafTiming();
    this._runStartedMs = Date.now();
    this._runEndedMs   = null;
    this._syncProfileFromModeState();
    this._setScreen(GameApp.SCREEN_PLAYING);
    this._audio.playBgm(AudioManager.BGM_MUSIC);
    this._boardRenderer.ensureSize(this._modeState.base.width, this._modeState.base.height,
      this._computeCellPx(this._modeState.base.width, this._modeState.base.height));
    this._renderAll();
    this._ensureLoop();
  }

  /** Para o jogo e retorna ao menu principal. */
  goToMenu() {
    this._syncProfileFromModeState();
    this._gameLoop.stop();
    this._resetMenuSession({ forceSoulsSelection: true });
    this._runStartedMs     = 0;
    this._runEndedMs       = null;
    this._modeState        = null;
    this._soulsInterpState = null;
    this._setScreen(GameApp.SCREEN_MENU);
    this._audio.playBgm(AudioManager.BGM_MENU);
    this._renderAll();
  }

  // ── Loop de jogo ────────────────────────────────────────────────────────────

  /** Avança um passo de lógica. Chamado pelo GameLoop. @param {number} fixedStepMs */
  _onStep(fixedStepMs) {
    if (!this._modeState) return;
    if (this._modeState.isGameOver || this._modeState.isPaused) return;
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) return;

    // Captura posições da cobra ANTES do passo — necessário para interpolação correta.
    // Sem isso, prev e cur apontam para os mesmos dados após stepModeState.
    const prevBody = this._modeState.base?.snake?.map(p => ({ x: p.x, y: p.y })) ?? null;

    const prevState       = this._modeState;
    const prevScore       = prevState.base?.score ?? 0;
    const prevHadReward   = prevState.mode === "souls" && prevState.souls?.reward != null;
    // Captura IDs de swings e inimigos existentes para detectar novos após o passo
    const prevSwingIds    = new Set((prevState.shooter?.swings   ?? []).map(s => s.id));
    const prevEnemyIds    = new Set((prevState.shooter?.enemies  ?? []).map(e => e.id));
    this._modeState = this._SM.stepModeState(this._modeState, {
      deltaMs:              fixedStepMs,
      holdCurrentDirection: this._isHoldingCurrentDirection(),
      viewportAspect:       this._getViewportAspectRatio(),
    });
    // Anexa prevBody ao novo estado para que BoardRenderer possa lerp por segmento.
    if (prevBody) this._modeState = { ...this._modeState, prevBody };
    this._soulsInterpState = prevState;
    this._syncProfileFromModeState();

    // ── Eventos de áudio ────────────────────────────────────────────────────
    const newScore = this._modeState.base?.score ?? 0;
    if (newScore > prevScore) {
      this._audio.playSfx(AudioManager.SFX_POWERUP);
    }
    // Dispara SFX de ataque para cada swing novo criado neste passo
    for (const sw of (this._modeState.shooter?.swings ?? [])) {
      if (!prevSwingIds.has(sw.id) && sw.attackSound) {
        this._audio.playSfxPath(sw.attackSound);
      }
    }
    // Dispara SFX de spawn uma vez por tipo de inimigo recém-spawnado neste passo
    const spawnedSoundsSeen = new Set();
    for (const en of (this._modeState.shooter?.enemies ?? [])) {
      if (!prevEnemyIds.has(en.id) && en.spawnSound && !spawnedSoundsSeen.has(en.catalogId)) {
        spawnedSoundsSeen.add(en.catalogId);
        // Cada som toca de forma independente e assíncrona
        Promise.resolve().then(() => this._audio.playSfxPath(en.spawnSound));
      }
    }
    const nowHasReward = this._modeState.mode === "souls" && this._modeState.souls?.reward != null;
    if (!prevHadReward && nowHasReward) {
      this._audio.playBgm(AudioManager.BGM_SKILL_SELECTION);
    }

    if (this._modeState.isGameOver) {
      if (!this._runEndedMs) {
        this._runEndedMs = Date.now();
        this._audio.stopBgm();
        this._audio.playSfx(AudioManager.SFX_DEATH);
      }
      this._setScreen(GameApp.SCREEN_GAMEOVER);
      this._gameLoop.stop();
    }
  }

  /** Renderiza todos os subsistemas visuais. Chamado pelo GameLoop. */
  _renderAll(opts = {}) {
    const alpha    = (typeof opts === "object" ? (opts.alpha    ?? 0)  : 0);
    const deltaMs  = (typeof opts === "object" ? (opts.deltaMs  ?? 16) : 16);

    // Score e status
    if (this._d.scoreEl)  this._d.scoreEl.textContent  = String(this._modeState?.base?.score ?? 0);
    if (this._d.statusEl) this._d.statusEl.textContent = this._getStatusText();

    // Datasets no root
    this._screenMgr.updateModeDataset(this._modeState);
    this._screenMgr.updateSoulsUiDataset(this._modeState);
    this._screenMgr.updateMobileControlDataset(this._normalizeMobileControl(this._uiSettings.mobileControl));

    // Canvas
    if (this._modeState) {
      this._boardRenderer.ensureSize(this._modeState.base.width, this._modeState.base.height,
        this._computeCellPx(this._modeState.base.width, this._modeState.base.height));
      this._boardRenderer.render(this._modeState, {
        interpolation: this._soulsInterpState
          ? { fromState: this._soulsInterpState, alpha }
          : null,
        deltaMs,
      });
    }

    // HUD
    this._hudRenderer.render(this._modeState);
    this._soulsHud.render(this._modeState);
    this._weaponHud.render(this._modeState);

    // Modal de recompensa
    this._rewardModal.render(this._modeState, this._screen);

    // Sidebars
    this._bossIntel.render(this._profile);
    this._powersSidebar.render(this._modeState);

    // Dev panel
    this._devPanel.render();

    // Renders DOM locais
    this._renderButtons(this._modeState);
    this._renderMenuModeOptions();
    this._renderMenuSettingsPanel();
    this._renderVersionLabel();
    this._renderInstructionsPanel();
    this._renderGameOverPanel(this._modeState);
    this._renderSoulsMenu();
  }

  _shouldRunSoulsRaf() {
    if (!this._modeState) return false;
    const mode = this._modeState.mode;
    if (mode !== "souls" && mode !== "traditional") return false;
    if (this._screen === GameApp.SCREEN_MENU) return false;
    if (this._modeState.isGameOver || this._modeState.isPaused) return false;
    if (this._modeState.souls?.reward) return false;
    return true;
  }

  _ensureLoop() {
    if (!this._modeState || this._screen === GameApp.SCREEN_MENU) { this._gameLoop.stop(); return; }
    if (this._modeState.isGameOver || this._modeState.isPaused)   { this._gameLoop.stop(); return; }
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) { this._gameLoop.stop(); return; }

    if (this._modeState.mode === "souls" || this._modeState.mode === "traditional") {
      this._gameLoop.startRaf();
    } else {
      this._gameLoop.startTick(this._getTickMs(this._modeState));
    }
  }

  _getTickMs(modeState) {
    if (!modeState) return 130;
    const slow    = this._SD.GLOBAL_SNAKE_SLOW_FACTOR ?? 0.88;
    const holding = this._isHoldingCurrentDirection();
    if (modeState.mode === "traditional") {
      const base = 120;
      return holding ? base : Math.max(1, Math.round(base / slow));
    }
    if (modeState.mode === "levels") {
      const base = Math.max(70, 130 - ((modeState.level ?? 1) - 1) * 5);
      return holding ? base : Math.max(1, Math.round(base / slow));
    }
    return modeState.tickMs ?? 130;
  }

  // ── Eventos de input ─────────────────────────────────────────────────────────

  _attachEvents() {
    // Teclado
    document.addEventListener("keydown", (e) => this._onKeyDown(e));
    document.addEventListener("keyup",   (e) => this._onKeyUp(e));

    // Janela
    window.addEventListener("blur", () => {
      this._pressedDirections.clear();
      this._gestureSession = null;
      this._gameLoop.resetRafTiming();
      // RAF loops (souls, traditional) self-resume; tick loops (levels) need restart.
      const isRafMode = this._modeState?.mode === "souls" || this._modeState?.mode === "traditional";
      if (!isRafMode) this._ensureLoop();
    });
    window.addEventListener("focus", () => this._gameLoop.resetRafTiming());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") this._gameLoop.resetRafTiming();
    });
    window.addEventListener("resize", () => this._renderAll());

    // Botões de controle
    this._d.startBtn?.addEventListener("click", () => this.startGame(this._getSelectedMenuMode()));

    this._d.pauseBtn?.addEventListener("pointerdown", (e) => this._togglePause(e));
    this._d.pauseBtn?.addEventListener("click", () => { if (!window.PointerEvent) this._togglePause(); });

    this._d.restartBtn?.addEventListener("click", () => this.restartGame());
    this._d.menuBtn?.addEventListener("click",    () => this.goToMenu());
    this._d.gameOverRestartBtn?.addEventListener("click", () => this.restartGame());
    this._d.gameOverMenuBtn?.addEventListener("click",    () => this.goToMenu());

    if (this._d.floatingPauseEl) {
      this._d.floatingPauseEl.addEventListener("pointerdown", (e) => this._togglePause(e));
      this._d.floatingPauseEl.addEventListener("click", () => { if (!window.PointerEvent) this._togglePause(); });
    }

    // Botões de modo no menu
    for (const btn of (this._d.menuModeBtns ?? [])) {
      btn.addEventListener("click", () => {
        const mode = this._normalizeMenuMode(btn.dataset.modeOption);
        if (this._isMenuModeAvailable(mode)) {
          this._setSelectedMenuMode(mode);
          this._renderAll();
        }
      });
    }

    // Souls — unlock e reroll
    this._d.soulsUnlockBtn?.addEventListener("click",   () => this._handleSoulsUnlock());
    this._d.soulsRerollBtn?.addEventListener("click",   () => this._handleReroll());

    // Dev panel
    this._d.devCodeApplyEl?.addEventListener("click", () => {
      this._devPanel.submitCommand();
      this._renderAll();
      this._ensureLoop();
    });
    this._d.devCodeInputEl?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._devPanel.submitCommand();
        this._renderAll();
        this._ensureLoop();
      }
    });

    // Configurações
    this._d.menuSettingsOptionBtn?.addEventListener("click", () => {
      this._isSettingsOpen = !this._isSettingsOpen;
      this._renderAll();
    });
    for (const input of (this._d.mobileControlInputs ?? [])) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this._setUiSettings({ mobileControl: input.value });
        this._gestureSession = null;
        this._renderAll();
      });
    }

    // Instruções (accordion mobile)
    this._d.instructionsToggleBtn?.addEventListener("click", () => {
      this._mobileInstructionsExpanded = !this._mobileInstructionsExpanded;
      this._renderAll();
    });

    // D-pad tátil
    for (const btn of (this._d.touchBtns ?? [])) {
      const dir = btn.dataset.direction;
      if (!dir) continue;
      const press = (e) => {
        if (e) e.preventDefault();
        this._pressedDirections.add(dir);
        const eff = this._resolveEffectiveDirection(this._pressedDirections);
        if (eff) this._queueDirectionForMode(eff);
      };
      const release = () => {
        this._pressedDirections.delete(dir);
        const eff = this._resolveEffectiveDirection(this._pressedDirections);
        if (eff) this._queueDirectionForMode(eff);
      };
      btn.addEventListener("pointerdown",  press);
      btn.addEventListener("pointerup",    release);
      btn.addEventListener("pointercancel", release);
      btn.addEventListener("pointerleave", release);
      btn.addEventListener("click", (e) => { if (!window.PointerEvent) { press(e); release(); } });
    }

    // Gestos na área de jogo
    const area = this._d.gameAreaEl;
    if (area) {
      area.addEventListener("pointerdown", (e) => {
        if (!this._shouldUseGestureControls()) return;
        if (e.target.closest("button")) return;
        this._gestureSession = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, consumed: false };
      });

      area.addEventListener("pointermove", (e) => {
        const s = this._gestureSession;
        if (!s || s.pointerId !== e.pointerId || s.consumed) return;
        if (!this._shouldUseGestureControls()) return;
        if (this._uiSettings.mobileControl !== "swipe") return;
        const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
        if (Math.hypot(dx, dy) < 24) return;
        const dir = this._getDirectionFromDelta(dx, dy);
        this._queueDirectionForMode(dir);
        this._releaseDirectionForMode(dir);
        s.consumed = true;
      });

      area.addEventListener("pointerup", (e) => {
        const s = this._gestureSession;
        if (!s || s.pointerId !== e.pointerId) return;
        if (this._shouldUseGestureControls() && !s.consumed) {
          const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
          const dist  = Math.hypot(dx, dy);
          const isTap   = this._uiSettings.mobileControl === "tap";
          const isSwipe = this._uiSettings.mobileControl === "swipe";
          if ((isTap && dist >= 8) || (isSwipe && dist >= 24)) {
            const dir = this._getDirectionFromDelta(dx, dy);
            this._queueDirectionForMode(dir);
            this._releaseDirectionForMode(dir);
          }
        }
        this._gestureSession = null;
      });

      area.addEventListener("pointercancel", () => { this._gestureSession = null; });
    }
  }

  _onKeyDown(e) {
    const { key } = e;

    if (key === "F2") {
      e.preventDefault();
      this._devPanel.toggle();
      this._renderAll();
      return;
    }

    if (document.activeElement === this._d.devCodeInputEl) return;

    if (this._screen === GameApp.SCREEN_MENU && this._konamiTracker.consumeKey(key)) {
      this._legacyModesUnlocked = true;
      this._renderAll();
      return;
    }

    if (this._screen === GameApp.SCREEN_MENU && key === "Enter") {
      e.preventDefault();
      this.startGame(this._getSelectedMenuMode());
      return;
    }

    if (!this._modeState) return;
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) return;

    const dir = this._SLG.directionFromInputKey(key);
    if (dir) {
      e.preventDefault();
      this._pressedDirections.add(dir);
      const eff = this._resolveEffectiveDirection(this._pressedDirections);
      if (eff) this._queueDirectionForMode(eff);
      if (this._modeState.mode !== "souls") {
        this._gameLoop.setTickMs(this._getTickMs(this._modeState));
      }
      return;
    }

    const lk = key.toLowerCase();
    if ((lk === " " || lk === "p") && !this._modeState.isGameOver) {
      e.preventDefault();
      this._togglePause();
      return;
    }

    if (lk === "r" && this._screen !== GameApp.SCREEN_MENU) {
      e.preventDefault();
      this.restartGame();
    }
  }

  _onKeyUp(e) {
    const dir = this._SLG.directionFromInputKey(e.key);
    if (!dir) return;
    this._pressedDirections.delete(dir);
    const eff = this._resolveEffectiveDirection(this._pressedDirections);
    if (eff) this._queueDirectionForMode(eff);
    if (this._modeState?.mode !== "souls") {
      this._gameLoop.setTickMs(this._getTickMs(this._modeState));
    }
  }

  _queueDirectionForMode(dir) {
    if (!this._modeState) return;
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) return;
    this._modeState = this._SM.queueModeDirection(this._modeState, dir);
  }

  _releaseDirectionForMode(dir) {
    this._pressedDirections.delete(dir);
    const eff = this._resolveEffectiveDirection(this._pressedDirections);
    if (eff) this._queueDirectionForMode(eff);
  }

  _togglePause(event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (!this._modeState) return;
    if (this._modeState.isGameOver) return;
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) return;
    this._modeState = this._SM.toggleModePause(this._modeState);
    this._renderAll();
    this._ensureLoop();
  }

  _resolveEffectiveDirection(pressed) {
    const up = pressed.has("UP"), down = pressed.has("DOWN");
    const left = pressed.has("LEFT"), right = pressed.has("RIGHT");
    if (up && left)    return "UP_LEFT";
    if (up && right)   return "UP_RIGHT";
    if (down && left)  return "DOWN_LEFT";
    if (down && right) return "DOWN_RIGHT";
    if (up)    return "UP";
    if (down)  return "DOWN";
    if (left)  return "LEFT";
    if (right) return "RIGHT";
    return null;
  }

  _getDirectionFromDelta(dx, dy) {
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 0.5;
    if (absX > 0 && absY > 0) {
      const ratio = absX / absY;
      if (ratio > 1 - threshold && ratio < 1 + threshold) {
        if (dx > 0) return dy > 0 ? "DOWN_RIGHT" : "UP_RIGHT";
        return dy > 0 ? "DOWN_LEFT" : "UP_LEFT";
      }
    }
    if (absX >= absY) return dx >= 0 ? "RIGHT" : "LEFT";
    return dy >= 0 ? "DOWN" : "UP";
  }

  _shouldUseGestureControls() {
    if (!this._modeState) return false;
    if (this._screen === GameApp.SCREEN_MENU) return false;
    if (this._modeState.isGameOver || this._modeState.isPaused) return false;
    if (!this._isMobileViewport()) return false;
    return this._uiSettings.mobileControl !== "dpad";
  }

  _isHoldingCurrentDirection() {
    if (!this._modeState) return false;
    return this._pressedDirections.has(this._modeState.base?.direction);
  }

  // ── Renders DOM locais ───────────────────────────────────────────────────────

  _renderButtons(modeState) {
    const hasGame    = Boolean(modeState);
    const isMenu     = this._screen === GameApp.SCREEN_MENU;
    const isGameOver = hasGame && modeState.isGameOver;
    const waitReward = hasGame && modeState.mode === "souls" && Boolean(modeState.souls?.reward);

    if (this._d.pauseBtn) {
      this._d.pauseBtn.disabled    = !hasGame || isMenu || isGameOver || waitReward;
      this._d.pauseBtn.textContent = hasGame && modeState.isPaused ? "Retomar" : "Pausar";
    }
    if (this._d.restartBtn) this._d.restartBtn.disabled = !hasGame || isMenu;
    if (this._d.menuBtn)    this._d.menuBtn.disabled    = isMenu;
    if (this._d.startBtn)   this._d.startBtn.disabled   = false;
  }

  _renderMenuModeOptions() {
    const selected = this._getSelectedMenuMode();
    for (const btn of (this._d.menuModeBtns ?? [])) {
      const mode   = this._normalizeMenuMode(btn.dataset.modeOption);
      const isLeg  = this._isLegacyMode(mode);
      const hidden = isLeg && !this._legacyModesUnlocked;
      const active = mode === selected;
      btn.classList.toggle("hidden", hidden);
      btn.classList.toggle("legacy-mode", isLeg);
      btn.setAttribute("aria-hidden",  hidden ? "true" : "false");
      btn.classList.toggle("active",   active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
    if (this._d.menuEasterEggStatusEl) {
      this._d.menuEasterEggStatusEl.classList.toggle("hidden", !this._legacyModesUnlocked);
    }
    if (this._d.startBtn && (this._d.menuModeBtns?.length ?? 0) > 0) {
      this._d.startBtn.textContent = `Iniciar ${this._formatModeLabel(selected)}`;
    }
  }

  _renderMenuSettingsPanel() {
    if (!this._d.settingsMenuEl) return;
    this._d.settingsMenuEl.classList.toggle("hidden", !this._isSettingsOpen);
    if (this._d.menuSettingsOptionBtn) {
      this._d.menuSettingsOptionBtn.classList.toggle("active", this._isSettingsOpen);
      this._d.menuSettingsOptionBtn.setAttribute("aria-pressed", this._isSettingsOpen ? "true" : "false");
    }
    const mc = this._normalizeMobileControl(this._uiSettings.mobileControl);
    for (const input of (this._d.mobileControlInputs ?? [])) {
      input.checked = input.value === mc;
    }
  }

  _renderVersionLabel() {
    if (this._d.gameVersionEl) this._d.gameVersionEl.textContent = GameApp.GAME_VERSION;
  }

  _renderInstructionsPanel() {
    const btn  = this._d.instructionsToggleBtn;
    const list = this._d.instructionsListEl;
    if (!btn || !list) return;
    const mobile    = this._isMobileViewport();
    const collapsed = mobile && !this._mobileInstructionsExpanded;
    list.classList.toggle("hidden", collapsed);
    btn.classList.toggle("hidden", !mobile);
    btn.textContent = collapsed ? "Expandir" : "Minimizar";
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    const panel = btn.closest(".instructions-panel");
    if (panel) panel.classList.toggle("mobile-collapsed", collapsed);
  }

  _renderGameOverPanel(modeState) {
    const el = this._d.gameOverPanelEl;
    if (!el) return;
    const isOver = Boolean(modeState?.isGameOver);
    el.classList.toggle("hidden", !isOver);
    if (!isOver) return;
    if (!this._runEndedMs) this._runEndedMs = Date.now();

    if (this._d.gameOverModeEl)      this._d.gameOverModeEl.textContent      = this._formatModeLabel(modeState.mode);
    if (this._d.gameOverScoreEl)     this._d.gameOverScoreEl.textContent     = String(modeState.base.score);
    if (this._d.gameOverLengthEl)    this._d.gameOverLengthEl.textContent    = String(modeState.base.snake.length);
    if (this._d.gameOverTimeEl)      this._d.gameOverTimeEl.textContent      = this._formatDurationMs(this._getCurrentRunDurationMs());

    if (modeState.mode === "souls") {
      if (this._d.gameOverSummaryEl)    this._d.gameOverSummaryEl.textContent    = "Você foi derrotado. Reorganize sua build e tente novamente.";
      if (this._d.gameOverExtraTitleEl) this._d.gameOverExtraTitleEl.textContent = "Andar alcançado";
      if (this._d.gameOverExtraEl)      this._d.gameOverExtraEl.textContent      = `${modeState.souls.floor} (ciclo ${modeState.souls.cycle})`;
    } else if (modeState.mode === "levels") {
      if (this._d.gameOverSummaryEl)    this._d.gameOverSummaryEl.textContent    = "Fim de partida. Você pode reiniciar para buscar um nível maior.";
      if (this._d.gameOverExtraTitleEl) this._d.gameOverExtraTitleEl.textContent = "Nível alcançado";
      if (this._d.gameOverExtraEl)      this._d.gameOverExtraEl.textContent      = String(modeState.level);
    } else {
      if (this._d.gameOverSummaryEl)    this._d.gameOverSummaryEl.textContent    = "Fim de partida. Prepare-se melhor para a próxima onda.";
      if (this._d.gameOverExtraTitleEl) this._d.gameOverExtraTitleEl.textContent = "Onda alcançada";
      if (this._d.gameOverExtraEl)      this._d.gameOverExtraEl.textContent      = String(modeState.shooter?.wave?.number ?? 1);
    }
  }

  _renderSoulsMenu() {
    if (!this._d.soulsMenuEl) return;
    const isSouls = this._getSelectedMenuMode() === "souls";
    this._d.soulsMenuEl.classList.toggle("hidden", !isSouls);
    if (!isSouls) return;

    const profile = this._profile;
    if (this._d.soulsWalletMenuEl) this._d.soulsWalletMenuEl.textContent = String(profile.walletRunes);
    if (this._d.soulsClearsMenuEl) this._d.soulsClearsMenuEl.textContent = String(profile.finalBossClears);

    if (this._d.soulsSnakesEl) {
      this._d.soulsSnakesEl.innerHTML = "";
      const descriptions = {
        basica:  "Neutra.",
        veloz:   "+velocidade, trava 1 tick após virar.",
        tanque:  "+armadura, objetivo maior.",
        vidente: "+controle de sigilo, arena normal menor.",
      };
      for (const snake of (this._SD.SNAKES ?? [])) {
        const unlocked = profile.unlockedSnakeIds?.includes(snake.id);
        const selected = profile.selectedSnakeId === snake.id;

        const card     = document.createElement("div");
        card.className = `snake-card${selected ? " active" : ""}${unlocked ? "" : " locked"}`.trim();

        const titleEl      = document.createElement("div");
        titleEl.className  = "snake-card-title";
        titleEl.innerHTML  = `<span>${snake.name}</span>`;
        const dot          = document.createElement("span");
        dot.className      = "snake-color-dot";
        dot.style.background = snake.color;
        titleEl.appendChild(dot);
        card.appendChild(titleEl);

        const detail      = document.createElement("small");
        detail.textContent = descriptions[snake.id] ?? snake.description ?? "";
        card.appendChild(detail);

        const btn      = document.createElement("button");
        btn.type       = "button";
        if (!unlocked) {
          btn.textContent = "Bloqueada"; btn.disabled = true;
        } else if (selected) {
          btn.textContent = "Selecionada"; btn.disabled = true;
        } else {
          btn.textContent = "Selecionar";
          btn.addEventListener("click", () => {
            this._setProfile(this._SP.selectSnake(profile, snake.id));
            this._renderAll();
          });
        }
        card.appendChild(btn);
        this._d.soulsSnakesEl.appendChild(card);
      }
    }

    const nextUnlock = this._SP.getNextUnlock(profile);
    if (!nextUnlock) {
      if (this._d.soulsUnlockLabelEl) this._d.soulsUnlockLabelEl.textContent = "Todas as cobras já foram desbloqueadas.";
      if (this._d.soulsUnlockBtn)     this._d.soulsUnlockBtn.disabled = true;
      return;
    }
    const needed     = nextUnlock.index + 1;
    const canByElig  = profile.eligibleUnlocks >= needed;
    const canByRunes = profile.walletRunes >= nextUnlock.cost;
    if (this._d.soulsUnlockLabelEl) {
      this._d.soulsUnlockLabelEl.textContent =
        `Próxima: ${this._SD.getSnakeById(nextUnlock.snakeId)?.name ?? nextUnlock.snakeId} ` +
        `(custo ${nextUnlock.cost}, requisito boss final ${needed}).`;
    }
    if (this._d.soulsUnlockBtn) this._d.soulsUnlockBtn.disabled = !(canByElig && canByRunes);
  }

  // ── Perfil ───────────────────────────────────────────────────────────────────

  _setProfile(profile) {
    const safe = this._SP.sanitizeProfile(profile);
    this._profile = safe;
    try {
      window.localStorage.setItem(this._SD.STORAGE_KEY, this._SP.saveProfile(safe));
    } catch { /* ignore */ }
  }

  _syncProfileFromModeState() {
    if (!this._modeState || this._modeState.mode !== "souls") return;
    const updated = this._SP.selectSnake(
      this._modeState.souls.profile,
      this._modeState.souls.selectedSnakeId
    );
    this._setProfile(updated);
  }

  // ── Configurações de UI ──────────────────────────────────────────────────────

  _normalizeMobileControl(v) {
    return (v === "swipe" || v === "tap") ? v : "dpad";
  }

  _setUiSettings(partial) {
    this._uiSettings = { ...this._uiSettings, ...partial };
    this._uiSettings.mobileControl = this._normalizeMobileControl(this._uiSettings.mobileControl);
    try {
      window.localStorage.setItem(GameApp.SETTINGS_KEY, JSON.stringify({
        mobileControl: this._uiSettings.mobileControl,
      }));
    } catch { /* ignore */ }
  }

  // ── Comandos dev ─────────────────────────────────────────────────────────────

  _executeDevCommand(parsed) {
    const { command, params = {} } = parsed;

    const ensureSouls = () => {
      if (this._modeState?.mode === "souls") return;
      this._modeState = this._SM.createModeState({
        mode: "souls",
        soulsProfile: this._profile,
        soulsSnakeId: this._profile.selectedSnakeId,
        viewportAspect: this._getViewportAspectRatio(),
      });
      this._syncProfileFromModeState();
      this._boardRenderer.ensureSize(this._modeState.base.width, this._modeState.base.height,
        this._computeCellPx(this._modeState.base.width, this._modeState.base.height));
    };

    if (command === "SOULS_FLOOR") {
      ensureSouls();
      this._modeState = this._SM.devSetSoulsFloor(this._modeState, params.floor, { viewportAspect: this._getViewportAspectRatio() });
      this._syncProfileFromModeState();
      this._setScreen(GameApp.SCREEN_PLAYING);
      return `Floor alterado para ${this._modeState.souls.floor}.`;
    }

    if (command === "SOULS_BOSS") {
      ensureSouls();
      this._modeState = this._SM.devSetSoulsBoss(this._modeState, params.bossSlot, { viewportAspect: this._getViewportAspectRatio() });
      this._syncProfileFromModeState();
      this._setScreen(GameApp.SCREEN_PLAYING);
      return `Boss carregado no floor ${this._modeState.souls.floor}.`;
    }

    if (command === "SCREEN") {
      if ((params.screen === "PLAYING" || params.screen === "GAMEOVER") && !this._modeState) {
        this.startGame(this._getSelectedMenuMode());
      }
      if (params.screen === "MENU")     { this._setScreen(GameApp.SCREEN_MENU);     return "Tela alterada para MENU."; }
      if (params.screen === "GAMEOVER") { this._setModeStateGameOver(true);  this._setScreen(GameApp.SCREEN_GAMEOVER); return "Tela alterada para GAMEOVER."; }
      this._setModeStateGameOver(false); this._setScreen(GameApp.SCREEN_PLAYING);    return "Tela alterada para PLAYING.";
    }

    if (command === "RUNAS_CARREGADAS") {
      ensureSouls();
      this._modeState = { ...this._modeState, souls: { ...this._modeState.souls, carriedRunes: params.runes } };
      return `Runas carregadas definidas para ${params.runes}.`;
    }

    if (command === "RUNAS_CARTEIRA") {
      const p = this._SP.sanitizeProfile({ ...this._profile, walletRunes: params.runes });
      this._setProfile(p);
      if (this._modeState?.mode === "souls") {
        this._modeState = { ...this._modeState, souls: { ...this._modeState.souls, profile: p } };
      }
      return `Runas da carteira definidas para ${params.runes}.`;
    }

    if (command === "DESBLOQUEAR_PROXIMA") {
      const r = this._SP.forceUnlockNext(this._profile);
      if (!r.ok) throw new Error("Todas as cobras já estão desbloqueadas.");
      this._setProfile(r.profile);
      if (this._modeState?.mode === "souls") {
        this._modeState = { ...this._modeState, souls: { ...this._modeState.souls, profile: r.profile, selectedSnakeId: r.profile.selectedSnakeId } };
      }
      return `Cobra desbloqueada: ${this._SD.getSnakeById(r.snakeId)?.name ?? r.snakeId}.`;
    }

    if (command === "DESBLOQUEAR_TODAS") {
      const r = this._SP.forceUnlockAll(this._profile);
      this._setProfile(r.profile);
      if (this._modeState?.mode === "souls") {
        this._modeState = { ...this._modeState, souls: { ...this._modeState.souls, profile: r.profile } };
      }
      return "Todas as cobras do Souls foram desbloqueadas.";
    }

    if (command === "RECOMPENSA_AGORA") {
      ensureSouls();
      if (this._modeState.souls.reward) return "A recompensa já está aberta.";
      const options = this._pickRandomPowerOptions(this._modeState.souls.powers);
      if (!options.length) throw new Error("Todos os poderes já estão no stack máximo.");
      this._modeState = {
        ...this._modeState,
        isPaused: true,
        base: { ...this._modeState.base, isPaused: true },
        souls: {
          ...this._modeState.souls,
          reward: { options, rerolled: false, source: this._modeState.souls.stageType },
          stageFlow: { ...(this._modeState.souls.stageFlow ?? {}), phase: "reward", message: "Boss derrotado", nextFloor: this._modeState.souls.floor + 1, msRemaining: 0 },
        },
      };
      this._setScreen(GameApp.SCREEN_PLAYING);
      return "Recompensa aberta com sucesso.";
    }

    if (command === "RESET_PERFIL_SOULS") {
      const p = this._SP.createDefaultProfile();
      this._setProfile(p);
      if (this._modeState?.mode === "souls") {
        this._modeState = { ...this._modeState, souls: { ...this._modeState.souls, profile: p, selectedSnakeId: p.selectedSnakeId } };
      }
      return "Perfil Souls resetado.";
    }

    throw new Error("Código não implementado.");
  }

  _pickRandomPowerOptions(powers) {
    const pool = (this._SD.POWER_POOL ?? []).filter(p => (powers[p.id] ?? 0) < (p.maxStacks ?? 1));
    if (!pool.length) return [];
    const copy = pool.slice(), opts = [];
    const count = Math.min(3, copy.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      opts.push(copy[idx].id);
      copy.splice(idx, 1);
    }
    return opts;
  }

  _setModeStateGameOver(isGameOver) {
    if (!this._modeState) return;
    if (isGameOver && !this._runEndedMs) this._runEndedMs = Date.now();
    if (!isGameOver) this._runEndedMs = null;
    this._modeState = {
      ...this._modeState,
      isGameOver,
      isPaused: false,
      base: { ...this._modeState.base, isGameOver, isPaused: false },
    };
  }

  // ── Handlers de eventos Souls ─────────────────────────────────────────────

  _handleRewardSelect(powerId) {
    const canSelect = this._SUH.canSelectReward ?? (() => false);
    if (!canSelect(this._modeState)) return;
    if (!this._modeState.souls?.reward?.options?.includes(powerId)) return;
    this._modeState = this._SM.chooseSoulsReward(this._modeState, powerId);
    this._syncProfileFromModeState();
    this._setScreen(GameApp.SCREEN_PLAYING);
    this._audio.playBgm(AudioManager.BGM_MUSIC);
    this._renderAll();
    this._ensureLoop();
  }

  _handleReroll() {
    if (!this._modeState || this._modeState.mode !== "souls") return;
    this._modeState = this._SM.rerollSoulsReward(this._modeState);
    this._syncProfileFromModeState();
    this._renderAll();
  }

  _handleSoulsUnlock() {
    const nextUnlock = this._SP.getNextUnlock(this._profile);
    if (!nextUnlock) return;
    const result = this._SP.purchaseSnake(this._profile, nextUnlock.snakeId);
    if (!result.ok) return;
    this._setProfile(result.profile);
    this._renderAll();
  }

  // ── Helpers internos ─────────────────────────────────────────────────────────

  _setScreen(screen) {
    this._screen = screen;
    this._screenMgr.setScreen(screen);
  }

  _applyTheme() {
    document.documentElement.setAttribute("data-theme", "dark");
    this._colorCache = null;
  }

  _getColor(name) {
    if (!this._colorCache) this._colorCache = new Map();
    if (!this._colorCache.has(name)) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      this._colorCache.set(name, v);
    }
    return this._colorCache.get(name);
  }

  _isLegacyMode(mode)          { return mode === "levels"; }
  _isMenuModeAvailable(mode)   { return mode === "souls" || mode === "traditional" || (this._legacyModesUnlocked && this._isLegacyMode(mode)); }
  _normalizeMenuMode(mode)     { return (mode === "traditional" || mode === "levels" || mode === "souls") ? mode : "traditional"; }
  _getSelectedMenuMode()       { const n = this._normalizeMenuMode(this._selectedMenuMode); return this._isMenuModeAvailable(n) ? n : "traditional"; }
  _setSelectedMenuMode(mode)   { const n = this._normalizeMenuMode(mode); this._selectedMenuMode = this._isMenuModeAvailable(n) ? n : "traditional"; }

  _resetMenuSession(options = {}) {
    this._legacyModesUnlocked = false;
    this._konamiTracker.reset();
    if (options.forceSoulsSelection || this._isLegacyMode(this._selectedMenuMode)) {
      this._selectedMenuMode = "traditional";
    }
  }

  _isImmersiveSouls() {
    if (!this._modeState || this._screen === GameApp.SCREEN_MENU) return false;
    if (this._modeState.isGameOver || this._modeState.isPaused) return false;
    if (this._modeState.mode === "souls") return !this._modeState.souls?.reward;
    if (this._modeState.mode === "traditional" && this._modeState.shooter) return true;
    return false;
  }

  /**
   * Calcula o tamanho de célula em pixels físicos para o canvas.
   * Em modos imersivos (souls/shooter) usa a resolução real da tela × DPR
   * para que o canvas fique nativo e não seja escalado com blur.
   * @param {number} gridW  Células horizontais
   * @param {number} gridH  Células verticais
   * @returns {number}
   */
  _computeCellPx(gridW, gridH) {
    if (!this._isImmersiveSouls()) return BoardRenderer.CELL_PX;
    const dpr = (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1) || 1;
    const sw  = (typeof window !== "undefined" ? window.innerWidth  : 0) * dpr;
    const sh  = (typeof window !== "undefined" ? window.innerHeight : 0) * dpr;
    if (!sw || !sh) return BoardRenderer.CELL_PX;
    return Math.max(1, Math.round(Math.min(sw / gridW, sh / gridH)));
  }

  _formatModeLabel(mode)    { if (mode === "levels") return "Níveis"; if (mode === "souls") return "Souls"; return "Shooter"; }
  _formatSoulsStage(souls)  { if (!souls) return "-"; if (souls.stageType === "normal") return "Normal"; if (souls.stageType === "boss") return `Boss ${souls.bossName ?? ""}`.trim(); return `Boss Final ${souls.bossName ?? ""}`.trim(); }

  _getStatusText() {
    if (!this._modeState) return "Pronto";
    if (this._modeState.mode === "souls" && this._modeState.souls?.reward) return "Escolha recompensa";
    if (this._modeState.isGameOver) return "Fim de jogo";
    if (this._modeState.isPaused)   return "Pausado";
    return "Em jogo";
  }

  _isMobileViewport() {
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return coarse || window.innerWidth <= 960;
  }

  _getViewportAspectRatio() {
    return Math.max(1, window.innerWidth || 1) / Math.max(1, window.innerHeight || 1);
  }

  _formatDurationMs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60), s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  _getCurrentRunDurationMs() {
    if (!this._runStartedMs) return 0;
    return Math.max(0, (this._runEndedMs ?? Date.now()) - this._runStartedMs);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = GameApp;
}
