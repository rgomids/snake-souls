"use strict";

const IGameMode = require("../../i-game-mode.js");

/**
 * SoulsMode — orquestra todos os sistemas do modo Souls.
 *
 * Principios aplicados:
 *  - SRP: cada sistema (StaminaSystem, HazardSystem, EconomySystem, EnemyAiSystem,
 *          StageFactory, RewardSystem) tem uma única responsabilidade.
 *  - OCP: novos sistema de IA podem ser registrados via EnemyAiSystem.registerStrategy().
 *  - LSP: SoulsMode é substituível por IGameMode em qualquer uso.
 *  - ISP: IGameMode expõe apenas o subconjunto de métodos que os consumidores precisam.
 *  - DIP: todas as dependências complexas são injetadas no construtor.
 *
 * O estado pesado (souls.*) ainda segue o contrato do legado para que o
 * código de render/UI em main.js continue funcionando sem alterações.
 */
class SoulsMode extends IGameMode {
  /**
   * @param {object}  deps
   * @param {object}  deps.initialState      Estado inicial já criado por `buildSoulsModeState`
   * @param {Function} deps.stepFn           (state, opts?) → state  (stepSoulsState legado)
   * @param {Function} deps.createFn         (opts?) → state          (buildSoulsModeState legado)
   * @param {Function} deps.chooseFn         (state, powerId, opts?) → state  (chooseSoulsReward)
   * @param {Function} deps.rerollFn         (state, opts?) → state   (rerollSoulsReward)
   * @param {Function} deps.devSetFloorFn    (state, floor, opts?) → state  (devSetSoulsFloor)
   * @param {object}  [deps.options]         Opções que `createFn` aceita
   * @param {StageFactory}  [deps.stageFactory]
   * @param {RewardSystem}  [deps.rewardSystem]
   * @param {StaminaSystem} [deps.staminaSystem]
   * @param {HazardSystem}  [deps.hazardSystem]
   * @param {EconomySystem} [deps.economySystem]
   * @param {EnemyAiSystem} [deps.enemyAiSystem]
   */
  constructor(deps) {
    super();
    if (!deps?.initialState) throw new Error("SoulsMode: deps.initialState é obrigatório.");
    if (typeof deps?.stepFn !== "function") throw new Error("SoulsMode: deps.stepFn é obrigatório.");
    if (typeof deps?.createFn !== "function") throw new Error("SoulsMode: deps.createFn é obrigatório.");

    this._state          = deps.initialState;
    this._stepFn         = deps.stepFn;
    this._createFn       = deps.createFn;
    this._chooseFn       = deps.chooseFn ?? null;
    this._rerollFn       = deps.rerollFn ?? null;
    this._devSetFloorFn  = deps.devSetFloorFn ?? null;
    this._options        = deps.options ?? {};

    // Sistemas OOP (opcionais durante transição incremental)
    this._stageFactory   = deps.stageFactory ?? null;
    this._rewardSystem   = deps.rewardSystem ?? null;
    this._staminaSystem  = deps.staminaSystem ?? null;
    this._hazardSystem   = deps.hazardSystem ?? null;
    this._economySystem  = deps.economySystem ?? null;
    this._enemyAiSystem  = deps.enemyAiSystem ?? null;
  }

  // ── IGameMode interface ──────────────────────────────────────────────────────

  /** @returns {"souls"} */
  get id() { return "souls"; }

  /**
   * Avança um tick fixed-step do modo Souls.
   * @param {object} [input]
   * @param {number}  [input.deltaMs]
   * @param {boolean} [input.wantsBoost]
   * @param {Function}[input.rng]
   * @returns {SoulsMode} this
   */
  step(input = {}) {
    if (!this._state.isGameOver && !this._state.isPaused) {
      this._state = this._stepFn(this._state, {
        deltaMs: input.deltaMs,
        wantsBoost: input.wantsBoost,
        rng: input.rng,
      });
    }
    return this;
  }

  /**
   * Enfileira uma direção de input.
   * @param {string} direction
   */
  queueDirection(direction) {
    if (!this._state.isGameOver && !this._state.isPaused) {
      const queue = this._state.base.inputQueue ?? [];
      this._state = {
        ...this._state,
        base: {
          ...this._state.base,
          inputQueue: [...queue, direction],
        },
      };
    }
  }

  /** Alterna pausa (não funciona durante reward screen — está já isPaused). */
  togglePause() {
    if (this._state.isGameOver) return;
    // Em reward mode o jogo está pausado por design — não altera
    if (this._state.souls?.reward != null) return;
    const isPaused = !this._state.isPaused;
    this._state = {
      ...this._state,
      isPaused,
      base: { ...this._state.base, isPaused },
    };
  }

  /** Recria o estado inicial com as mesmas opções. */
  restart() {
    this._state = this._createFn(this._options);
  }

  /** @returns {object} Snapshot do estado atual. */
  getState() { return this._state; }

  /** @returns {boolean} */
  isGameOver() { return this._state.isGameOver === true; }

  /** @returns {boolean} */
  isPaused() { return this._state.isPaused === true; }

  // ── Souls-specific API ───────────────────────────────────────────────────────

  /**
   * Processa a escolha de um poder na reward screen.
   * @param {string}   powerId
   * @param {object}  [options]
   * @returns {SoulsMode} this
   */
  chooseReward(powerId, options = {}) {
    if (!this._chooseFn) throw new Error("SoulsMode: chooseFn não injetado.");
    this._state = this._chooseFn(this._state, powerId, options);
    return this;
  }

  /**
   * Faz reroll das opções de recompensa.
   * @param {object} [options]
   * @returns {SoulsMode} this
   */
  rerollReward(options = {}) {
    if (!this._rerollFn) throw new Error("SoulsMode: rerollFn não injetado.");
    this._state = this._rerollFn(this._state, options);
    return this;
  }

  /**
   * Salta para um andar específico (dev/cheat code).
   * @param {number} floor
   * @param {object} [options]
   * @returns {SoulsMode} this
   */
  devSetFloor(floor, options = {}) {
    if (!this._devSetFloorFn) throw new Error("SoulsMode: devSetFloorFn não injetado.");
    this._state = this._devSetFloorFn(this._state, floor, options);
    return this;
  }

  // ── Getters utilitários ──────────────────────────────────────────────────────

  get floor()        { return this._state.souls?.floor ?? 1; }
  get stageType()    { return this._state.souls?.stageType ?? "normal"; }
  get carriedRunes() { return this._state.souls?.carriedRunes ?? 0; }
  get reward()       { return this._state.souls?.reward ?? null; }
  get tickMs()       { return this._state.tickMs; }
  get profile()      { return this._state.souls?.profile ?? null; }

  /** Emite true se o jogo está na reward screen (isPaused pelo reward). */
  get isRewardPending() { return this._state.souls?.reward != null; }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SoulsMode;
}
