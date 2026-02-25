"use strict";

/**
 * RewardModal — renderiza e controla o modal de escolha de poder.
 *
 * SRP: única responsabilidade de exibir e atualizar o modal de reward.
 * DIP: recebe elementos DOM, funções de dado e handler via construtor.
 *
 * Usa cache por `renderKey` para evitar re-criação desnecessária de
 * elementos DOM a cada frame.
 */
class RewardModal {
  /**
   * @param {object}       deps
   * @param {HTMLElement}  deps.modalEl            O elemento do modal
   * @param {HTMLElement}  deps.optionsEl          Contêiner de botões de opção
   * @param {HTMLElement}  deps.rerollBtn          Botão de reroll
   * @param {Function}     deps.getPowerById       (id: string) → { name, description, maxStacks } | null
   * @param {Function}     deps.buildRenderKey     (reward, powers) → string | null
   * @param {Function}     deps.onSelectPower      (powerId: string) → void
   * @param {Function}     deps.onReroll            () → void
   * @param {number}       deps.rerollCost         Custo de reroll em runas
   * @param {string}       deps.screenMenu         Constante SCREEN_MENU
   */
  constructor(deps) {
    if (!deps?.modalEl)    throw new Error("RewardModal: deps.modalEl é obrigatório.");
    if (!deps?.optionsEl)  throw new Error("RewardModal: deps.optionsEl é obrigatório.");
    if (!deps?.rerollBtn)  throw new Error("RewardModal: deps.rerollBtn é obrigatório.");

    this._d          = deps;
    this._renderKey  = null;
  }

  /**
   * Atualiza o modal a partir do estado de jogo.
   * @param {object|null} modeState
   * @param {string}      currentScreen
   */
  render(modeState, currentScreen) {
    const shouldShow = modeState?.mode === "souls"
      && modeState.souls.reward != null
      && currentScreen !== this._d.screenMenu;

    this._d.modalEl.classList.toggle("hidden", !shouldShow);

    if (!shouldShow) {
      this._d.rerollBtn.disabled = true;
      if (this._renderKey !== null) {
        this._d.optionsEl.innerHTML = "";
        this._renderKey = null;
      }
      return;
    }

    const reward   = modeState.souls.reward;
    const powers   = modeState.souls.powers ?? {};
    const newKey   = this._d.buildRenderKey(reward, powers);

    if (newKey !== this._renderKey) {
      this._d.optionsEl.innerHTML = "";

      for (const powerId of reward.options) {
        const power = this._d.getPowerById(powerId);
        const currentStack = powers[powerId] ?? 0;

        const btn = document.createElement("button");
        btn.type      = "button";
        btn.className = "souls-reward-option";
        btn.dataset.powerId = powerId;
        btn.innerHTML = [
          `<strong>${power?.name ?? powerId}</strong>`,
          `<small>${power?.description ?? ""}</small>`,
          `<small>Stack atual: ${currentStack}/${power?.maxStacks ?? 0}</small>`,
        ].join("");

        // Previne duplo-disparo em mobile (pointerdown + click)
        let handled = false;
        const select = (ev) => {
          if (ev) ev.preventDefault();
          if (handled) return;
          handled = true;
          this._d.onSelectPower(powerId);
        };
        btn.addEventListener("pointerdown", select);
        btn.addEventListener("click", select);
        this._d.optionsEl.appendChild(btn);
      }

      this._renderKey = newKey;
    }

    const canReroll = !reward.rerolled
      && (modeState.souls.carriedRunes ?? 0) >= this._d.rerollCost;
    this._d.rerollBtn.disabled = !canReroll;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = RewardModal;
}
