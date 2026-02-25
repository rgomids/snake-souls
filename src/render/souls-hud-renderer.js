"use strict";

/**
 * SoulsHudRenderer — atualiza os overlays DOM específicos do modo Souls.
 *
 * Responsabilidades (SRP): countdown, mensagem de andar, seta de sigil,
 * barra de stamina, summary de morte e botão de pausa flutuante.
 * DIP: todos os elementos são injetados pelo chamador.
 */
class SoulsHudRenderer {
  /**
   * @param {object}  deps
   * @param {HTMLElement|null} deps.countdownEl        #souls-countdown
   * @param {HTMLElement|null} deps.stageMessageEl     #souls-stage-message
   * @param {HTMLElement|null} deps.sigilArrowEl       #souls-sigil-arrow
   * @param {HTMLElement|null} deps.sigilDistanceEl    elemento de distância dentro da seta
   * @param {HTMLElement|null} deps.staminaEl          #souls-stamina
   * @param {HTMLElement|null} deps.staminaFillEl      #souls-stamina-fill
   * @param {HTMLElement|null} deps.deathSummaryEl     #souls-death-summary
   * @param {HTMLElement|null} deps.deathRunesEl       #souls-death-runes
   * @param {HTMLElement|null} deps.deathEchoEl        #souls-death-echo
   * @param {HTMLElement|null} deps.floatingPauseEl    botão de pausa flutuante
   * @param {Function}         deps.isSoulsImmersive   () → boolean  — UI está em modo imersivo?
   * @param {Function}         deps.getCurrentScreen   () → string
   * @param {string}           deps.screenMenuId       constante SCREEN_MENU
   */
  constructor(deps) {
    this._d = deps;
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Atualiza todos os overlays Souls em uma única chamada.
   * @param {object|null} modeState
   */
  render(modeState) {
    this.renderCountdown(modeState);
    this.renderStageMessage(modeState);
    this.renderSigilArrow(modeState);
    this.renderStamina(modeState);
    this.renderDeathSummary(modeState);
    this.renderFloatingPause(modeState);
  }

  /**
   * Countdown 3-2-1 no início de cada andar Souls.
   * @param {object|null} modeState
   */
  renderCountdown(modeState) {
    const el = this._d.countdownEl;
    if (!el) return;

    const ms = modeState?.mode === "souls" ? (modeState.souls.countdownMsRemaining ?? 0) : 0;
    if (ms <= 0) { el.classList.add("hidden"); return; }

    el.textContent = String(Math.max(1, Math.min(3, Math.ceil(ms / 1000))));
    el.classList.remove("hidden");
  }

  /**
   * Mensagem transitória (ex: "Andar 4 concluído").
   * @param {object|null} modeState
   */
  renderStageMessage(modeState) {
    const el = this._d.stageMessageEl;
    if (!el) return;

    if (modeState?.mode !== "souls") { el.classList.add("hidden"); return; }

    const flow = modeState.souls.stageFlow;
    if (!flow || flow.phase !== "message" || !flow.message) {
      el.classList.add("hidden");
      return;
    }

    el.textContent = flow.message;
    el.classList.remove("hidden");
  }

  /**
   * Seta indicadora de sigil/food fora da tela.
   * @param {object|null} modeState
   */
  renderSigilArrow(modeState) {
    const el = this._d.sigilArrowEl;
    if (!el) return;

    if (modeState?.mode !== "souls") {
      el.classList.add("hidden");
      delete el.dataset.target;
      return;
    }

    const indicator = modeState.souls.sigilIndicator;
    if (!indicator?.visible) {
      el.classList.add("hidden");
      delete el.dataset.target;
      return;
    }

    el.dataset.target = modeState.souls.objectiveType === "food" ? "food" : "sigil";
    el.style.left      = `${indicator.leftPercent}%`;
    el.style.top       = `${indicator.topPercent}%`;
    el.style.transform = `translate(-50%, -50%) rotate(${indicator.angleDeg}deg)`;

    if (this._d.sigilDistanceEl) {
      this._d.sigilDistanceEl.textContent = String(indicator.distance);
    }
    el.classList.remove("hidden");
  }

  /**
   * Barra de stamina (visível apenas em modo imersivo).
   * @param {object|null} modeState
   */
  renderStamina(modeState) {
    const el     = this._d.staminaEl;
    const fillEl = this._d.staminaFillEl;
    if (!el || !fillEl) return;

    const show = modeState?.mode === "souls"
      && this._d.isSoulsImmersive()
      && !modeState.isGameOver
      && !modeState.souls.reward;

    el.classList.toggle("hidden", !show);
    if (!show) {
      fillEl.style.width = "0%";
      delete el.dataset.phase;
      return;
    }

    const stamina = modeState.souls.stamina;
    const max     = Math.max(1, stamina?.max ?? 1);
    const current = Math.max(0, Math.min(max, stamina?.current ?? max));
    el.dataset.phase      = stamina?.phase ?? "ready";
    fillEl.style.width    = `${Math.round((current / max) * 100)}%`;
  }

  /**
   * Resumo de morte (runas perdidas + eco).
   * @param {object|null} modeState
   */
  renderDeathSummary(modeState) {
    const el        = this._d.deathSummaryEl;
    const runesEl   = this._d.deathRunesEl;
    const echoEl    = this._d.deathEchoEl;
    if (!el) return;

    if (!modeState || modeState.mode !== "souls" || !modeState.isGameOver) {
      el.classList.add("hidden");
      if (runesEl) runesEl.textContent = "0";
      if (echoEl)  echoEl.textContent  = "0";
      return;
    }

    el.classList.remove("hidden");
    if (runesEl) runesEl.textContent = String(modeState.souls.lastDeathRunes ?? 0);
    if (echoEl)  echoEl.textContent  = String(modeState.souls.lastDeathEcho  ?? 0);
  }

  /**
   * Botão de pausa flutuante (visível apenas em Souls imersivo, em jogo).
   * @param {object|null} modeState
   */
  renderFloatingPause(modeState) {
    const el = this._d.floatingPauseEl;
    if (!el) return;

    const show = modeState?.mode === "souls"
      && this._d.getCurrentScreen() !== this._d.screenMenuId
      && !modeState.isGameOver
      && !modeState.souls.reward
      && this._d.isSoulsImmersive();

    el.classList.toggle("hidden", !show);
    if (show) {
      el.textContent = modeState.isPaused ? "Retomar" : "Pausar";
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SoulsHudRenderer;
}
