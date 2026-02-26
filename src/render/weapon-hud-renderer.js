"use strict";

/**
 * WeaponHudRenderer — renderiza cards de arma no HUD durante o jogo.
 *
 * SRP: única responsabilidade de refletir o estado das armas da cobra no DOM.
 * DIP: recebe o container DOM e as definições de armas via construtor.
 *
 * Cada carta exibe:
 *  - Ícone da arma (img)
 *  - Nome da arma
 *  - Barra de cooldown: cheia quando recém atacou, diminui até vazia (pronto)
 *  - Overlay escurecido que encolhe conforme o cooldown drena
 *
 * Visível apenas no modo "traditional" (shooter) com armas ativas na cobra.
 */
class WeaponHudRenderer {
  /**
   * @param {object}      deps
   * @param {HTMLElement} deps.containerEl  #weapon-hud
   * @param {object[]}    deps.weaponDefs   WeaponCatalog.ALL
   */
  constructor({ containerEl, weaponDefs }) {
    this._el   = containerEl;
    this._defs = weaponDefs ?? [];
    /** @type {Map<string, { cardEl: HTMLElement, fillEl: HTMLElement, overlayEl: HTMLElement }>} */
    this._cards = new Map();
  }

  /**
   * Atualiza os cards de arma a partir do estado de jogo.
   * @param {object|null} modeState
   */
  render(modeState) {
    const el = this._el;
    if (!el) return;

    // Só exibe no modo shooter com armas
    if (modeState?.mode !== "traditional" || !modeState.shooter) {
      el.classList.add("hidden");
      return;
    }

    const snake = modeState.base?.snake ?? [];
    const activeWeapons = snake.filter(s => s.type === "weapon" && !s.disabled);

    if (activeWeapons.length === 0) {
      el.classList.add("hidden");
      return;
    }

    el.classList.remove("hidden");

    // Remove cards de armas que não estão mais ativas
    const visibleIds = new Set(activeWeapons.map(s => s.weaponId));
    for (const [id, { cardEl }] of this._cards) {
      if (!visibleIds.has(id)) {
        cardEl.remove();
        this._cards.delete(id);
      }
    }

    // Atualiza ou cria cards na ordem das armas ativas
    for (const seg of activeWeapons) {
      const def = this._defs.find(w => w.id === seg.weaponId);
      if (!def) continue;

      let entry = this._cards.get(seg.weaponId);
      if (!entry) {
        entry = WeaponHudRenderer._createCard(def);
        this._cards.set(seg.weaponId, entry);
        el.appendChild(entry.cardEl);
      }

      // Calcula fração de cooldown restante (1 = acabou de atacar, 0 = pronto)
      const maxCd = def.cooldownMs ?? 1000;
      const remCd = seg.attackCooldownMs ?? 0;
      const cdPct  = Math.max(0, Math.min(1, remCd / maxCd));
      const isReady = cdPct <= 0;

      entry.cardEl.classList.toggle("weapon-card--ready",    isReady);
      entry.cardEl.classList.toggle("weapon-card--cooldown", !isReady);
      entry.cardEl.style.setProperty("--cd-pct", cdPct.toFixed(4));

      // Barra de progresso: vai de 100 % (pronto) para 0 % (acabou de atacar)
      entry.fillEl.style.width = `${Math.round((1 - cdPct) * 100)}%`;
    }
  }

  // ── Fábrica privada de card ──────────────────────────────────────────────

  /**
   * Cria os elementos DOM de um card de arma.
   * @param {object} def  Definição da arma (WeaponCatalog entry)
   * @returns {{ cardEl: HTMLElement, fillEl: HTMLElement, overlayEl: HTMLElement }}
   */
  static _createCard(def) {
    const cardEl = document.createElement("div");
    cardEl.className         = "weapon-card weapon-card--ready";
    cardEl.dataset.weaponId  = def.id;

    // Ícone
    const iconEl     = document.createElement("img");
    iconEl.className = "weapon-card__icon";
    iconEl.src       = def.icon ?? `resources/img/weapon/${def.id}.png`;
    iconEl.alt       = def.name;

    // Info (nome + barra)
    const infoEl     = document.createElement("div");
    infoEl.className = "weapon-card__info";

    const nameEl     = document.createElement("span");
    nameEl.className = "weapon-card__name";
    nameEl.textContent = def.name;

    const barTrack   = document.createElement("div");
    barTrack.className = "weapon-card__bar-track";

    const fillEl     = document.createElement("div");
    fillEl.className = "weapon-card__bar-fill";
    fillEl.style.width = "100%";

    barTrack.appendChild(fillEl);
    infoEl.appendChild(nameEl);
    infoEl.appendChild(barTrack);

    // Overlay escurecido de cooldown
    const overlayEl     = document.createElement("div");
    overlayEl.className = "weapon-card__cooldown-overlay";

    cardEl.appendChild(iconEl);
    cardEl.appendChild(infoEl);
    cardEl.appendChild(overlayEl);

    return { cardEl, fillEl, overlayEl };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = WeaponHudRenderer;
}
