"use strict";

/**
 * RewardSystem — Gerencia opções de poder após vitória de boss.
 *
 * Responsabilidades (SRP):
 *  - Calcular poderes disponíveis dado o estado atual do jogador
 *  - Sortear up-to-3 opções aleatórias sem repetição
 *  - Processar a escolha de um poder (delega transição de andar via callback)
 *  - Processar REROLL gastando runas
 *
 * DIP: a transição de andar é injetada como `transitionFn` — sem acoplamento
 * direto a StageFactory ou ao legado `transitionSoulsFloorInPlace`.
 */

class RewardSystem {
  /**
   * @param {object}   deps
   * @param {object}   deps.powerPool          Array de definições de poder (POWER_POOL)
   * @param {number}   deps.rerollCost         Custo de reroll em runas
   * @param {Function} deps.transitionFn       (state, base, souls, nextFloor, rng, opts) → state
   * @param {Function} deps.createStaminaState (souls, opts) → stamina
   * @param {Function} deps.createStageFlowState (phase, params?) → StageFlow
   * @param {Function} deps.applyRuneGainFn    (souls, amount) → void (muta souls)
   * @param {Function} deps.getRuneRewardFn    (type) → number
   * @param {Function} [deps.clampIndex]       (idx, len) → idx — default Math implementation
   */
  constructor(deps) {
    this._pool          = deps.powerPool;
    this._rerollCost    = deps.rerollCost;
    this._transition    = deps.transitionFn;
    this._newStamina    = deps.createStaminaState;
    this._newFlow       = deps.createStageFlowState;
    this._applyRune     = deps.applyRuneGainFn;
    this._getReward     = deps.getRuneRewardFn;
    this._clampIndex    = deps.clampIndex ?? ((i, len) => Math.max(0, Math.min(len - 1, i)));
  }

  // ── helpers internos ────────────────────────────────────────────────────────

  /** Retorna ids de poderes que ainda têm stacks disponíveis. */
  _getAvailableIds(souls) {
    const available = [];
    for (const power of this._pool) {
      const current = souls.powers?.[power.id] ?? 0;
      if (current < power.maxStacks) {
        available.push(power.id);
      }
    }
    return available;
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Retorna até 3 opções de poder aleatórias disponíveis.
   * @param {object}   souls
   * @param {Function} rng
   * @returns {string[]} Array de power ids (0-3 itens)
   */
  rollOptions(souls, rng) {
    const available = this._getAvailableIds(souls);
    if (available.length === 0) return [];

    const pool = [...available];
    const options = [];
    const count = Math.min(3, pool.length);

    for (let i = 0; i < count; i += 1) {
      const idx = this._clampIndex(Math.floor(rng() * pool.length), pool.length);
      options.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return options;
  }

  /**
   * Processa a escolha de um poder após vitória de boss.
   * Equivale a `chooseSoulsReward(state, powerId, options)`.
   *
   * @param {object}   state
   * @param {string}   powerId
   * @param {object}  [options]
   * @param {Function} [options.rng=Math.random]
   * @returns {object} Novo estado completo do jogo
   */
  choose(state, powerId, options = {}) {
    if (state.mode !== "souls") return state;
    const souls = state.souls;
    if (!souls.reward?.options?.includes(powerId)) return state;

    const power = this._pool.find(p => p.id === powerId);
    const maxStacks = power?.maxStacks ?? 1;
    const currentStacks = souls.powers?.[powerId] ?? 0;
    if (currentStacks >= maxStacks) return state;

    const nextFloor = souls.stageFlow?.nextFloor ?? souls.floor + 1;
    const completionLabel = souls.stageFlow?.message ?? `Boss ${souls.bossName ?? ""}`.trim();

    const upgradedPowers = { ...souls.powers, [powerId]: currentStacks + 1 };
    const nextSouls = {
      ...souls,
      powers: upgradedPowers,
      reward: null,
      rewardRerolled: false,
      stamina: this._newStamina({ ...souls, powers: upgradedPowers }, { current: "max" }),
      stageFlow: this._newFlow("idle"),
      countdownMsRemaining: 0,
    };

    const rng = options.rng ?? Math.random;
    return this._transition(
      { ...state, isPaused: false, base: { ...state.base, isPaused: false }, souls: nextSouls },
      { ...state.base, isPaused: false },
      nextSouls,
      nextFloor,
      rng,
      { message: completionLabel }
    );
  }

  /**
   * Re-sorteia as opções de recompensa gastando runas (1 reroll por reward).
   * Equivale a `rerollSoulsReward(state, options)`.
   *
   * @param {object}   state
   * @param {object}  [options]
   * @param {Function} [options.rng=Math.random]
   * @returns {object} Novo estado completo do jogo
   */
  reroll(state, options = {}) {
    if (state.mode !== "souls" || !state.souls.reward) return state;
    if (state.souls.reward.rerolled) return state;
    if ((state.souls.carriedRunes ?? 0) < this._rerollCost) return state;

    const rng = options.rng ?? Math.random;
    const souls = { ...state.souls, carriedRunes: state.souls.carriedRunes - this._rerollCost };

    const optionsList = this.rollOptions(souls, rng);
    if (optionsList.length === 0) {
      return { ...state, souls: { ...souls, reward: null } };
    }

    return {
      ...state,
      souls: {
        ...souls,
        reward: { ...state.souls.reward, options: optionsList, rerolled: true },
      },
    };
  }

  /**
   * Cria o estado de reward screen após vitória de boss.
   * Utilizado por SoulsMode ao completar um andar de boss.
   *
   * @param {object}   state
   * @param {object}   nextBase
   * @param {object}   souls
   * @param {number}   nextFloor
   * @param {string}   completionLabel
   * @param {Function} rng
   * @returns {object} Estado completo do jogo com reward pausado (ou transição direta)
   */
  buildRewardScreenState(state, nextBase, souls, nextFloor, completionLabel, rng) {
    const options = this.rollOptions(souls, rng);

    if (options.length === 0) {
      // Todos os poderes já no máximo: dá runas extras e transita direto
      this._applyRune(souls, this._getReward("allPowersMaxed"));
      return this._transition(state, nextBase, souls, nextFloor, rng, { message: completionLabel });
    }

    return {
      ...state,
      base: { ...nextBase, isGameOver: false, isPaused: true },
      tickMs: state.tickMs,
      barriers: state.barriers,
      enemy: state.enemy ? { ...state.enemy } : null,
      isGameOver: false,
      isPaused: true,
      souls: {
        ...souls,
        enemyTeleportPreview: null,
        stageFlow: this._newFlow("reward", {
          message: completionLabel,
          nextFloor,
          msRemaining: 0,
        }),
        reward: { options, rerolled: false, source: souls.stageType },
      },
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = RewardSystem;
}
