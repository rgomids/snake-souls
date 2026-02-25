"use strict";

const IGameMode = require("../../i-game-mode.js");

/**
 * LevelsMode — modo de jogo com progressão de níveis e barreiras.
 *
 * Delega todo o cálculo de estado para as funções funcionais legadas do
 * `snake-modes.js` (criação e step), injetadas no construtor (DIP).
 *
 * Isso mantém 100% de compatibilidade com os testes existentes enquanto
 * encapsula o ciclo de vida em uma classe `IGameMode`.
 */
class LevelsMode extends IGameMode {
  /**
   * @param {object}   deps
   * @param {object}   deps.initialState   Estado inicial já criado por `createLevelsModeState`
   * @param {Function} deps.stepFn         (state, options?) → state  (stepLevelsState)
   * @param {Function} deps.createFn       (options?) → state         (createLevelsModeState)
   * @param {object}  [deps.options]       Opções que `createFn` aceita (width, height, rng…)
   */
  constructor(deps) {
    super();
    if (!deps?.initialState) throw new Error("LevelsMode: deps.initialState é obrigatório.");
    if (typeof deps?.stepFn !== "function") throw new Error("LevelsMode: deps.stepFn é obrigatório.");
    if (typeof deps?.createFn !== "function") throw new Error("LevelsMode: deps.createFn é obrigatório.");

    this._state   = deps.initialState;
    this._stepFn  = deps.stepFn;
    this._createFn = deps.createFn;
    this._options  = deps.options ?? {};
  }

  // ── IGameMode interface ──────────────────────────────────────────────────────

  /** @returns {"levels"} */
  get id() { return "levels"; }

  /**
   * Avança um tick de jogo.
   * @param {object} [input]
   * @param {Function} [input.rng]
   * @param {boolean}  [input.holdCurrentDirection]
   * @returns {LevelsMode} this (mutação de estado interno)
   */
  step(input = {}) {
    if (!this._state.isGameOver && !this._state.isPaused) {
      this._state = this._stepFn(this._state, {
        rng: input.rng,
        holdCurrentDirection: input.holdCurrentDirection,
      });
    }
    return this;
  }

  /**
   * Enfileira uma direção na inputQueue do estado base.
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

  /** Alterna o estado de pausa. */
  togglePause() {
    if (this._state.isGameOver) return;
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

  /** @returns {object} Snapshot do estado atual (imutável por convenção). */
  getState() { return this._state; }

  /** @returns {boolean} */
  isGameOver() { return this._state.isGameOver === true; }

  /** @returns {boolean} */
  isPaused() { return this._state.isPaused === true; }

  // ── Getters extras ──────────────────────────────────────────────────────────

  /** Nível atual (1-indexed). */
  get level() { return this._state.level; }

  /** Progresso dentro do nível atual. */
  get levelProgress() { return this._state.levelProgress; }

  /** Alvo do nível atual. */
  get levelTarget() { return this._state.levelTarget; }

  /** Intervalo de tick em ms para o nível atual. */
  get tickMs() { return this._state.tickMs; }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = LevelsMode;
}
