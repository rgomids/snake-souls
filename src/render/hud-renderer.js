"use strict";

/**
 * HudRenderer — atualiza os elementos DOM do HUD principal.
 *
 * SRP: única responsabilidade de refletir o estado de jogo no HUD.
 * DIP: recebe todos os elementos DOM e formatadores via construtor.
 *
 * Suporta os três modos: traditional, levels e souls.
 */
class HudRenderer {
  /**
   * @param {object}  deps
   * @param {HTMLElement} deps.modeLabelEl        Exibe o nome do modo
   * @param {HTMLElement} deps.levelValueEl       Nível atual (levels)
   * @param {HTMLElement} deps.levelProgressEl    Progresso do nível (levels)
   * @param {HTMLElement} deps.shieldTimeEl       Tempo de escudo (levels)
   * @param {HTMLElement} deps.soulsFloorEl       Andar (souls)
   * @param {HTMLElement} deps.soulsCycleEl       Ciclo (souls)
   * @param {HTMLElement} deps.soulsStageEl       Tipo de andar (souls)
   * @param {HTMLElement} deps.soulsObjectiveEl   Progresso do objetivo (souls)
   * @param {HTMLElement} deps.soulsCarriedEl     Runas carregadas (souls)
   * @param {HTMLElement} deps.soulsWalletEl      Runas na carteira (souls)
   * @param {HTMLElement} deps.soulsArmorEl       Cargas de armadura (souls)
   * @param {Function}    deps.formatModeLabel    (mode: string) → string
   * @param {Function}    deps.formatSoulsStage   (souls: object) → string
   * @param {Function}    deps.getWalletRunes      () → number  — fallback para quando não há modeState
   */
  constructor(deps) {
    this._el     = deps;
    this._fmtMode  = deps.formatModeLabel;
    this._fmtStage = deps.formatSoulsStage;
    this._wallet   = deps.getWalletRunes;
  }

  /**
   * Atualiza o HUD completo a partir do estado de jogo.
   * @param {object|null} modeState
   */
  render(modeState) {
    const el = this._el;

    if (!modeState) {
      el.modeLabelEl.textContent     = "-";
      el.levelValueEl.textContent    = "-";
      el.levelProgressEl.textContent = "-";
      el.shieldTimeEl.textContent    = "0.0s";
      el.soulsFloorEl.textContent    = "-";
      el.soulsCycleEl.textContent    = "-";
      el.soulsStageEl.textContent    = "-";
      el.soulsObjectiveEl.textContent = "-";
      el.soulsCarriedEl.textContent  = "0";
      el.soulsWalletEl.textContent   = String(this._wallet());
      el.soulsArmorEl.textContent    = "0";
      return;
    }

    el.modeLabelEl.textContent = this._fmtMode(modeState.mode);

    if (modeState.mode === "traditional" && modeState.shooter) {
      const sh    = modeState.shooter;
      const snake = modeState.base?.snake ?? [];
      const lives = snake.filter(s => s.type === "life").length;
      const regenQueue  = sh.weaponRegenQueue ?? [];
      const wRegenMs    = regenQueue[0] ?? 0;
      const waveLabel   = sh.wave.phase === "countdown"
        ? `Onda ${sh.wave.number} (em breve)`
        : `Onda ${sh.wave.number}`;
      el.levelValueEl.textContent    = waveLabel;
      el.levelProgressEl.textContent = `Vidas: ${lives}`;
      el.shieldTimeEl.textContent    = wRegenMs > 0
        ? `Arma: ${(wRegenMs / 1000).toFixed(1)}s`
        : "Arma: OK";
    } else if (modeState.mode === "levels") {
      el.levelValueEl.textContent    = String(modeState.level);
      el.levelProgressEl.textContent = `${modeState.levelProgress}/${modeState.levelTarget}`;
      el.shieldTimeEl.textContent    = `${(modeState.shieldMsRemaining / 1000).toFixed(1)}s`;
    } else {
      el.levelValueEl.textContent    = "-";
      el.levelProgressEl.textContent = "-";
      el.shieldTimeEl.textContent    = "0.0s";
    }

    if (modeState.mode === "souls") {
      const souls = modeState.souls;
      el.soulsFloorEl.textContent     = String(souls.floor);
      el.soulsCycleEl.textContent     = String(souls.cycle);
      el.soulsStageEl.textContent     = this._fmtStage(souls);
      el.soulsObjectiveEl.textContent = `${souls.objectiveProgress}/${souls.objectiveTarget}`;
      el.soulsCarriedEl.textContent   = String(souls.carriedRunes);
      el.soulsWalletEl.textContent    = String(souls.profile.walletRunes);
      el.soulsArmorEl.textContent     = String(souls.armorCharges);
    } else {
      el.soulsFloorEl.textContent     = "-";
      el.soulsCycleEl.textContent     = "-";
      el.soulsStageEl.textContent     = "-";
      el.soulsObjectiveEl.textContent = "-";
      el.soulsCarriedEl.textContent   = "0";
      el.soulsWalletEl.textContent    = String(this._wallet());
      el.soulsArmorEl.textContent     = "0";
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = HudRenderer;
}
