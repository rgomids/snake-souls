"use strict";

/**
 * GameConstants — todas as constantes numéricas e de chaves do jogo.
 *
 * Princípio SRP: fonte única de verdade para valores de configuração.
 * Princípio OCP: novos valores são adicionados sem alterar lógica de uso.
 */
class GameConstants {
  // ── Persistência ─────────────────────────────────────────────────────────
  static STORAGE_KEY                    = "snake-souls-profile-v1";
  static SETTINGS_STORAGE_KEY          = "snake-settings-v1";

  // ── Gameplay ──────────────────────────────────────────────────────────────
  static DEFAULT_SNAKE_ID              = "basica";
  static GLOBAL_SNAKE_SLOW_FACTOR      = 0.88;
  static MIN_TICK_MS                   = 55;

  // ── Souls: tempo / cooldowns ──────────────────────────────────────────────
  static GHOST_COOLDOWN_MS             = 15000;
  static ESPECTRO_TELEPORT_PREVIEW_MS  = 1000;
  static ESPECTRO_TELEPORT_MAX_DISTANCE = 3;
  static SHIELD_DURATION_MS            = 5000;

  // ── Souls: ticks base por tipo de fase ────────────────────────────────────
  static TICK_BASE = Object.freeze({
    normal:     140,
    boss:       128,
    final_boss: 118,
  });

  // ── Souls: ranges de arena ────────────────────────────────────────────────
  static ARENA_RANGES = Object.freeze({
    normal:     Object.freeze({ min: 18, max: 22 }),
    boss:       Object.freeze({ min: 22, max: 24 }),
    final_boss: Object.freeze({ min: 24, max: 26 }),
  });

  // ── Souls: economia de runas ──────────────────────────────────────────────
  static RUNE_REWARDS = Object.freeze({
    food:          2,
    sigil:         6,
    bossWin:       40,
    finalBossWin:  120,
    allPowersMaxed: 60,
  });

  static REROLL_COST = 30;

  // ── Souls: desbloqueio de cobras ──────────────────────────────────────────
  static UNLOCK_ORDER = Object.freeze(["veloz", "tanque", "vidente"]);
  static UNLOCK_COSTS = Object.freeze([120, 220, 360]);

  // ── Loop / RAF ────────────────────────────────────────────────────────────
  static SOULS_FIXED_STEP_MS       = 1000 / 90;
  static SOULS_MAX_STEPS_PER_FRAME = 4;
  static SOULS_MAX_FRAME_DELTA_MS  = 120;

  // ── Modo tradicional ──────────────────────────────────────────────────────
  static TRADITIONAL_TICK_MS = 200;

  // ── Modo Shooter ──────────────────────────────────────────────────────────
  static WEAPON_REGEN_MS      = 5000;
  static SHOOTER_FIXED_STEP_MS = 1000 / 60;
  static WAVE_COUNTDOWN_MS    = 3000;
  static WAVE_INITIAL_ENEMIES = 3;
  static SHOOTER_VIEWPORT_W   = 21;
  static SHOOTER_VIEWPORT_H   = 21;
  static SHOOTER_MOVE_PERIOD_MS = 200;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = GameConstants;
}
