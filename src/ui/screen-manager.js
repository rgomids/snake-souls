"use strict";

/**
 * ScreenManager — gerencia transições entre telas do jogo.
 *
 * SRP: única responsabilidade de refletir a tela ativa no DOM
 *      (dataset + visibilidade de painéis).
 * DIP: todos os elementos DOM são injetados via construtor.
 */
class ScreenManager {
  static MENU     = "menu";
  static PLAYING  = "playing";
  static GAMEOVER = "gameover";

  /**
   * @param {object}       deps
   * @param {HTMLElement}  deps.appEl          Elemento raiz — recebe `dataset.screen`
   * @param {HTMLElement}  deps.menuScreenEl   Painel de menu
   * @param {HTMLElement}  deps.gameScreenEl   Painel de jogo
   * @param {Function}     [deps.onScreenChange]  (screen: string) → void
   */
  constructor(deps) {
    if (!deps?.appEl)        throw new Error("ScreenManager: deps.appEl é obrigatório.");
    if (!deps?.menuScreenEl) throw new Error("ScreenManager: deps.menuScreenEl é obrigatório.");
    if (!deps?.gameScreenEl) throw new Error("ScreenManager: deps.gameScreenEl é obrigatório.");

    this._app     = deps.appEl;
    this._menuEl  = deps.menuScreenEl;
    this._gameEl  = deps.gameScreenEl;
    this._onchange = deps.onScreenChange ?? null;
    this._current  = ScreenManager.MENU;
  }

  /**
   * Transita para a tela solicitada.
   * @param {string} screen  "menu" | "playing" | "gameover"
   */
  setScreen(screen) {
    this._current = screen;
    this._app.dataset.screen = screen;

    const isMenu = screen === ScreenManager.MENU;
    this._menuEl.classList.toggle("hidden", !isMenu);
    this._gameEl.classList.toggle("hidden", isMenu);

    if (this._onchange) this._onchange(screen);
  }

  /** @returns {string} Tela atual */
  get current() { return this._current; }

  /** @returns {boolean} */
  isMenu()     { return this._current === ScreenManager.MENU; }
  isPlaying()  { return this._current === ScreenManager.PLAYING; }
  isGameOver() { return this._current === ScreenManager.GAMEOVER; }

  /**
   * Atualiza o dataset de modo (`data-mode`) no elemento raiz.
   * @param {object|null} modeState
   */
  updateModeDataset(modeState) {
    this._app.dataset.mode = modeState?.mode ?? "menu";
  }

  /**
   * Atualiza o dataset de soulsUi entre `"immersive"` e `"panel"`.
   * @param {object|null} modeState
   */
  updateSoulsUiDataset(modeState) {
    const isImmersive = modeState?.mode === "souls"
      && !this.isMenu()
      && !modeState.isGameOver
      && !modeState.isPaused
      && !modeState.souls?.reward;
    this._app.dataset.soulsUi = isImmersive ? "immersive" : "panel";
  }

  /**
   * Atualiza o dataset de mobile-control.
   * @param {string} value
   */
  updateMobileControlDataset(value) {
    this._app.dataset.mobileControl = value;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ScreenManager;
}
