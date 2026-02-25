"use strict";

/**
 * BossIntelSidebar — renderiza a sidebar com inteligência de todos os bosses.
 *
 * SRP: única responsabilidade de criar/atualizar os cards de boss na sidebar.
 * DIP: dados e elementos injetados via construtor.
 */
class BossIntelSidebar {
  /**
   * @param {object}       deps
   * @param {HTMLElement}  deps.listEl        Elemento container (ul/div)
   * @param {Array}        deps.bossIntel     Array de definições de boss intel
   */
  constructor(deps) {
    if (!deps?.listEl) throw new Error("BossIntelSidebar: deps.listEl é obrigatório.");
    this._listEl     = deps.listEl;
    this._bossIntel  = deps.bossIntel ?? [];
  }

  /**
   * Renderiza os cards de boss com base no perfil atual.
   * @param {object} profile  Perfil Souls (`{ bossKills: { [id]: number } }`)
   */
  render(profile) {
    this._listEl.innerHTML = "";
    const bossKills = profile?.bossKills ?? {};

    for (const boss of this._bossIntel) {
      const kills   = bossKills[boss.id] ?? 0;
      const unlocked = kills > 0;

      const card = document.createElement("article");
      card.className = `boss-intel-card${unlocked ? "" : " locked"}`;

      const title = document.createElement("div");
      title.className = "boss-intel-title";
      title.innerHTML = `<strong>${boss.name}</strong>`;

      const tag = document.createElement("span");
      tag.className   = "boss-intel-tag";
      tag.textContent = unlocked ? `${kills} vitória(s)` : "Bloqueado";
      title.appendChild(tag);
      card.appendChild(title);

      const details = [
        { label: "Mecânica", value: unlocked ? `Mecânica: ${boss.mechanic}` : "Derrote este chefe para revelar os detalhes." },
        { label: "Tamanho",  value: unlocked ? `Tamanho: ${boss.size}`      : "Tamanho: ???" },
        { label: "Recompensa", value: unlocked ? `Recompensa: ${boss.reward}` : "Recompensa: ???" },
      ];

      for (const d of details) {
        const el = document.createElement("div");
        el.className   = "boss-intel-detail";
        el.textContent = d.value;
        card.appendChild(el);
      }

      this._listEl.appendChild(card);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * PowersSidebar — renderiza a sidebar com os poderes coletados na run atual.
 *
 * SRP: única responsabilidade de exibir os poderes ativos.
 * DIP: dados e elemento injetados via construtor.
 */
class PowersSidebar {
  /**
   * @param {object}       deps
   * @param {HTMLElement}  deps.listEl    Elemento container
   * @param {Array}        deps.powerPool Array de definições de poder
   */
  constructor(deps) {
    if (!deps?.listEl) throw new Error("PowersSidebar: deps.listEl é obrigatório.");
    this._listEl    = deps.listEl;
    this._powerPool = deps.powerPool ?? [];
  }

  /**
   * Renderiza os poderes coletados a partir do estado de jogo.
   * @param {object|null} modeState
   */
  render(modeState) {
    this._listEl.innerHTML = "";

    const powers    = modeState?.mode === "souls" ? (modeState.souls.powers ?? {}) : {};
    const collected = [];

    for (const power of this._powerPool) {
      const stack = powers[power.id] ?? 0;
      if (stack > 0) collected.push({ power, stack });
    }

    if (collected.length === 0) {
      const empty = document.createElement("p");
      empty.className   = "sidebar-muted";
      empty.textContent = modeState?.mode === "souls"
        ? "Nenhum poder coletado nesta run."
        : "Inicie uma run Souls para ver os poderes coletados.";
      this._listEl.appendChild(empty);
      return;
    }

    for (const entry of collected) {
      const card = document.createElement("article");
      card.className = "power-card";

      const title = document.createElement("div");
      title.className = "power-card-title";
      title.innerHTML = `<strong>${entry.power.name}</strong>`;

      const stackEl = document.createElement("span");
      stackEl.className   = "power-stack";
      stackEl.textContent = `${entry.stack}/${entry.power.maxStacks}`;
      title.appendChild(stackEl);
      card.appendChild(title);

      const detail = document.createElement("p");
      detail.className   = "power-card-detail";
      detail.textContent = entry.power.description;
      card.appendChild(detail);

      this._listEl.appendChild(card);
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BossIntelSidebar, PowersSidebar };
}
