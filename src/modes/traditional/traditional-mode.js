"use strict";

/**
 * TraditionalMode — modo Snake clássico sem modificadores.
 *
 * Princípio SRP: única responsabilidade de wrapping fino sobre SnakeLogic.
 * Princípio LSP: satisfaz plenamente o contrato de IGameMode.
 * Princípio DIP: depende de SnakeLogic injetado, nunca importado diretamente.
 *
 * @implements {import('../i-game-mode.js')}
 */

const IGameMode = (typeof require !== "undefined")
  ? require("../i-game-mode.js")
  : (typeof globalThis !== "undefined" ? globalThis.IGameMode : null);

const SnakeLogic = (typeof require !== "undefined")
  ? require("../../core/snake-logic.js")
  : (typeof globalThis !== "undefined" ? globalThis.SnakeLogic : null);

const GameConstants = (typeof require !== "undefined")
  ? require("../../data/constants.js")
  : (typeof globalThis !== "undefined" ? globalThis.GameConstants : null);

class TraditionalMode extends (IGameMode ?? Object) {
  /**
   * @param {{
   *   width?: number,
   *   height?: number,
   *   snakeLogic?: typeof SnakeLogic
   * }} [options]
   */
  constructor(options = {}) {
    super();
    this._logic = options.snakeLogic ?? SnakeLogic;
    this._width  = options.width  ?? 20;
    this._height = options.height ?? 20;
    this._state  = this._logic.createInitialState({ width: this._width, height: this._height });
  }

  // ── IGameMode ─────────────────────────────────────────────────────────────

  /** @override */
  get id() { return "traditional"; }

  /** @override */
  step() {
    if (this._state.isGameOver || this._state.isPaused) return;
    this._state = this._logic.stepState(this._state);
  }

  /** @override */
  queueDirection(direction) {
    this._state = this._logic.queueDirection(this._state, direction);
  }

  /** @override */
  togglePause() {
    this._state = this._logic.togglePause(this._state);
  }

  /** @override */
  restart() {
    this._state = this._logic.createInitialState({ width: this._width, height: this._height });
  }

  /** @override */
  getState() {
    return {
      mode: "traditional",
      snake:      this._state.snake,
      food:       this._state.food,
      direction:  this._state.direction,
      score:      this._state.score,
      isGameOver: this._state.isGameOver,
      isPaused:   this._state.isPaused,
      width:      this._state.width,
      height:     this._state.height,
    };
  }

  /** @override */
  get isGameOver() { return this._state.isGameOver; }

  /** @override */
  get isPaused()   { return this._state.isPaused;   }

  // ── Específico do modo ────────────────────────────────────────────────────

  /**
   * Tick (ms) padrão para o modo tradicional.
   * @returns {number}
   */
  static get defaultTickMs() {
    return GameConstants?.TRADITIONAL_TICK_MS ?? 200;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = TraditionalMode;
}
