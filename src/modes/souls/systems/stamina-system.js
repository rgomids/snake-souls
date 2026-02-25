"use strict";

/**
 * StaminaSystem — gerência do ciclo de stamina/boost do jogador no modo Souls.
 *
 * Princípio SRP: única responsabilidade de calcular e avançar o estado de stamina.
 * Princípio OCP: novos poderes que modificam stamina adicionados como
 *   ajustes nos getters, sem alterar o loop principal de update.
 */
class StaminaSystem {
  // ── Constantes de fase ────────────────────────────────────────────────────
  static PHASE_READY      = "ready";
  static PHASE_EXHAUSTED  = "exhausted";
  static PHASE_RECOVERING = "recovering_lock";

  // ── Parâmetros base ───────────────────────────────────────────────────────
  static MAX_BASE           = 100;
  static DRAIN_PER_SEC      = 25;
  static EXHAUST_MS         = 1000;
  static RECOVERY_MS_BASE   = 12000;
  static BOOST_MULT         = 1.6;
  static EXHAUST_MULT       = 0.65;

  /**
   * Retorna os stats de stamina considerando poderes do jogador.
   * @param {{ powers: Record<string, number> }} souls
   * @returns {{ max: number, recoveryMs: number, rechargeRate: number }}
   */
  static getStats(souls) {
    const adrStacks = souls?.powers?.adrenalina ?? 0;
    const max = StaminaSystem.MAX_BASE + adrStacks * 20;
    const recoveryMs = Math.max(
      1000,
      Math.round(StaminaSystem.RECOVERY_MS_BASE * Math.pow(0.85, adrStacks))
    );
    return { max, recoveryMs, rechargeRate: max / (recoveryMs / 1000) };
  }

  /**
   * Cria o estado inicial de stamina (cheio).
   * @param {{ powers: Record<string, number> }} souls
   * @param {{ current?: number|"max", phase?: string, exhaustedMsRemaining?: number, lockMsRemaining?: number }} [opts]
   * @returns {object}
   */
  static create(souls, opts = {}) {
    const stats = StaminaSystem.getStats(souls);
    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    const current = opts.current === "max"
      ? stats.max
      : clamp(Number(opts.current ?? stats.max), 0, stats.max);
    const phase = opts.phase === StaminaSystem.PHASE_EXHAUSTED ? StaminaSystem.PHASE_EXHAUSTED
      : opts.phase === StaminaSystem.PHASE_RECOVERING ? StaminaSystem.PHASE_RECOVERING
      : StaminaSystem.PHASE_READY;
    return {
      current,
      max: stats.max,
      phase,
      exhaustedMsRemaining: phase === StaminaSystem.PHASE_EXHAUSTED
        ? Math.max(0, Math.floor(opts.exhaustedMsRemaining ?? StaminaSystem.EXHAUST_MS))
        : 0,
      lockMsRemaining: phase === StaminaSystem.PHASE_RECOVERING
        ? Math.max(0, Math.floor(opts.lockMsRemaining ?? stats.recoveryMs))
        : 0,
    };
  }

  /**
   * Avança o estado de stamina por deltaMs, aplicando boost se solicitado.
   * Muta `souls.stamina` in-place (compatível com o padrão legado).
   *
   * @param {{ powers: Record<string, number>, stamina: object }} souls
   * @param {number} deltaMs
   * @param {boolean} wantsBoost
   * @returns {{ boostActive: boolean, exhausted: boolean }}
   */
  static update(souls, deltaMs, wantsBoost) {
    const stats = StaminaSystem.getStats(souls);
    const dt = Math.max(0, deltaMs) / 1000;
    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));

    // Normalize
    const src = souls.stamina ?? StaminaSystem.create(souls, { current: "max" });
    const stamina = {
      current: clamp(Number(src.current ?? stats.max), 0, stats.max),
      max: stats.max,
      phase: src.phase === StaminaSystem.PHASE_EXHAUSTED ? StaminaSystem.PHASE_EXHAUSTED
        : src.phase === StaminaSystem.PHASE_RECOVERING ? StaminaSystem.PHASE_RECOVERING
        : StaminaSystem.PHASE_READY,
      exhaustedMsRemaining: Math.max(0, Math.floor(src.exhaustedMsRemaining ?? 0)),
      lockMsRemaining: Math.max(0, Math.floor(src.lockMsRemaining ?? 0)),
    };

    let boostActive = false;

    if (stamina.phase === StaminaSystem.PHASE_EXHAUSTED) {
      stamina.exhaustedMsRemaining = Math.max(0, stamina.exhaustedMsRemaining - deltaMs);
      if (stamina.exhaustedMsRemaining <= 0) {
        stamina.phase = StaminaSystem.PHASE_RECOVERING;
        stamina.lockMsRemaining = stats.recoveryMs;
      }
    } else if (stamina.phase === StaminaSystem.PHASE_RECOVERING) {
      stamina.lockMsRemaining = Math.max(0, stamina.lockMsRemaining - deltaMs);
      stamina.current = clamp(stamina.current + stats.rechargeRate * dt, 0, stamina.max);
      if (stamina.lockMsRemaining <= 0 && stamina.current >= stamina.max - 0.0001) {
        stamina.current = stamina.max;
        stamina.phase = StaminaSystem.PHASE_READY;
        stamina.lockMsRemaining = 0;
      }
    } else {
      if (wantsBoost && stamina.current > 0) {
        boostActive = true;
        stamina.current = Math.max(0, stamina.current - StaminaSystem.DRAIN_PER_SEC * dt);
        if (stamina.current <= 0) {
          stamina.current = 0;
          stamina.phase = StaminaSystem.PHASE_EXHAUSTED;
          stamina.exhaustedMsRemaining = StaminaSystem.EXHAUST_MS;
        }
      } else {
        stamina.current = clamp(stamina.current + stats.rechargeRate * dt, 0, stamina.max);
      }
    }

    souls.stamina = { ...stamina, max: stats.max };

    return {
      boostActive: boostActive && souls.stamina.phase === StaminaSystem.PHASE_READY,
      exhausted: souls.stamina.phase === StaminaSystem.PHASE_EXHAUSTED,
    };
  }

  /**
   * Velocidade do jogador em CPS considerando modificadores de stamina.
   * @param {number} normalCps
   * @param {{ boostActive: boolean, exhausted: boolean }} status
   * @returns {number}
   */
  static applySpeedMultiplier(normalCps, status) {
    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    if (status.exhausted)    return clamp(normalCps * StaminaSystem.EXHAUST_MULT, 1.5, 18);
    if (status.boostActive)  return clamp(normalCps * StaminaSystem.BOOST_MULT,   2,   24);
    return normalCps;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = StaminaSystem;
}
