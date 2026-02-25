"use strict";

/**
 * EnemyAiSystem — IA de bosses e minions do modo Souls.
 *
 * Princípio SRP: única responsabilidade de calcular movimentos de inimigos.
 * Princípio OCP: novos tipos de boss adicionados como estratégias (objetos
 *   com `matches(enemy)` e `getDirectionOrder(enemy, head)`) via
 *   `EnemyAiSystem.registerStrategy()`, sem if-chains.
 *
 * Stratégias incluídas:
 *   - AggressiveStrategy  (Caçador)
 *   - PatrolStrategy      (Carcereiro)
 *   - PhaseStrategy       (Espectro)
 *   - MixedStrategy       (Abissal)
 *   - DefaultChaseStrategy (minions e fallback)
 */

// ── Direções disponíveis (8 cardinais + diagonais) ────────────────────────────
const ALL_DIRECTIONS = Object.freeze([
  "UP", "UP_RIGHT", "RIGHT", "DOWN_RIGHT", "DOWN", "DOWN_LEFT", "LEFT", "UP_LEFT",
]);

// ── Hunter boost state machine ────────────────────────────────────────────────
const HUNTER_PHASE_READY   = "ready";
const HUNTER_PHASE_BOOST   = "boost";
const HUNTER_PHASE_FATIGUE = "fatigue";
const HUNTER_PHASE_RECOVER = "recover";

const HUNTER_BOOST_MS   = 700;
const HUNTER_FATIGUE_MS = 1200;
const HUNTER_RECOVER_MS = 5000;
const HUNTER_BOOST_MULT  = 1.55;
const HUNTER_FATIGUE_MULT = 0.7;

// ── Direction vectors (para não depender de SnakeLogic no boot) ────────────────
const DIR_VECTORS = Object.freeze({
  UP:         Object.freeze({ x:  0, y: -1 }),
  DOWN:       Object.freeze({ x:  0, y:  1 }),
  LEFT:       Object.freeze({ x: -1, y:  0 }),
  RIGHT:      Object.freeze({ x:  1, y:  0 }),
  UP_LEFT:    Object.freeze({ x: -1, y: -1 }),
  UP_RIGHT:   Object.freeze({ x:  1, y: -1 }),
  DOWN_LEFT:  Object.freeze({ x: -1, y:  1 }),
  DOWN_RIGHT: Object.freeze({ x:  1, y:  1 }),
});

// ── helpers internos ──────────────────────────────────────────────────────────
function manhattanDist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getEnemyCells(enemy) {
  if (!enemy) return [];
  const w = Math.max(1, enemy.width ?? enemy.size ?? 1);
  const h = Math.max(1, enemy.height ?? enemy.size ?? 1);
  const cells = [];
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      cells.push({ x: enemy.x + dx, y: enemy.y + dy });
    }
  }
  return cells;
}

function enemyDistanceTo(enemy, target) {
  if (!enemy || !target) return Infinity;
  let min = Infinity;
  for (const cell of getEnemyCells(enemy)) {
    min = Math.min(min, manhattanDist(cell, target));
  }
  return min;
}

/**
 * Ordena direções para que o inimigo persiga o alvo (chase sort).
 * @param {{ x: number, y: number }} enemy
 * @param {{ x: number, y: number }} target
 * @param {ReadonlyArray<string>} dirs
 * @returns {string[]}
 */
function chaseSort(enemy, target, dirs = ALL_DIRECTIONS) {
  return [...dirs].sort((a, b) => {
    const va = DIR_VECTORS[a];
    const vb = DIR_VECTORS[b];
    const da = manhattanDist({ x: enemy.x + va.x, y: enemy.y + va.y }, target);
    const db = manhattanDist({ x: enemy.x + vb.x, y: enemy.y + vb.y }, target);
    return da - db;
  });
}

// ── Estratégias ───────────────────────────────────────────────────────────────

/** Estratégia base: perseguição direta por manhattan distance. */
class DefaultChaseStrategy {
  matches(enemy) { return true; } // fallback para todos
  getDirectionOrder(enemy, head) { return chaseSort(enemy, head); }
}

/** Caçador: perseguição agressiva com hunter boost. */
class AggressiveStrategy {
  matches(enemy) { return enemy?.style === "aggressive"; }
  getDirectionOrder(enemy, head) { return chaseSort(enemy, head); }
}

/** Carcereiro: patrulha contornando barreiras. */
class PatrolStrategy {
  matches(enemy) { return enemy?.style === "patrol"; }
  getDirectionOrder(enemy, head) {
    // Patrol: alterna entre perseguir e continuar na direção atual
    const chase = chaseSort(enemy, head);
    const currentDir = enemy.direction ?? "LEFT";
    if (!chase.includes(currentDir)) return chase;
    // Place current direction early to bias continuation
    const idx = chase.indexOf(currentDir);
    const reordered = [...chase];
    reordered.splice(idx, 1);
    reordered.unshift(currentDir);
    return reordered;
  }
}

/** Espectro: modo fase — persegue com preferência por diagonais. */
class PhaseStrategy {
  matches(enemy) { return enemy?.style === "phase"; }
  getDirectionOrder(enemy, head) {
    const diag = ["UP_LEFT", "UP_RIGHT", "DOWN_LEFT", "DOWN_RIGHT"];
    const cardinal = ["UP", "DOWN", "LEFT", "RIGHT"];
    const all = [...diag, ...cardinal];
    return chaseSort(enemy, head, all);
  }
}

/** Abissal: mixed — prioridade diagonal + agressividade do Caçador. */
class MixedStrategy {
  matches(enemy) { return enemy?.style === "mixed"; }
  getDirectionOrder(enemy, head) { return chaseSort(enemy, head); }
}

// ── EnemyAiSystem ─────────────────────────────────────────────────────────────

class EnemyAiSystem {
  constructor() {
    /** @type {Array<{ matches: Function, getDirectionOrder: Function }>} */
    this._strategies = [
      new AggressiveStrategy(),
      new PatrolStrategy(),
      new PhaseStrategy(),
      new MixedStrategy(),
      new DefaultChaseStrategy(), // sempre no final (fallback)
    ];
  }

  /**
   * Registra uma estratégia customizada (OCP: extensível sem modificar este arquivo).
   * @param {{ matches: Function, getDirectionOrder: Function }} strategy
   */
  registerStrategy(strategy) {
    this._strategies.unshift(strategy);
  }

  /**
   * Retorna a ordem de direções para o inimigo se mover.
   * @param {object} enemy
   * @param {{ x: number, y: number }} head
   * @returns {string[]}
   */
  getDirectionOrder(enemy, head) {
    for (const strategy of this._strategies) {
      if (strategy.matches(enemy)) {
        return strategy.getDirectionOrder(enemy, head);
      }
    }
    return chaseSort(enemy, head);
  }

  // ── Hunter boost state machine ────────────────────────────────────────────

  /**
   * Normaliza o estado de hunter boost.
   * @param {object|null} source
   * @returns {{ phase: string, msRemaining: number }}
   */
  static normalizeHunterBoost(source) {
    const phase = [HUNTER_PHASE_BOOST, HUNTER_PHASE_FATIGUE, HUNTER_PHASE_RECOVER].includes(source?.phase)
      ? source.phase
      : HUNTER_PHASE_READY;
    return {
      phase,
      msRemaining: phase === HUNTER_PHASE_READY ? 0 : Math.max(0, Math.floor(Number(source?.msRemaining ?? 0))),
    };
  }

  /**
   * Avança o estado de hunter boost por deltaMs.
   * @param {object|null} state
   * @param {number} deltaMs
   * @returns {{ phase: string, msRemaining: number }}
   */
  static advanceHunterBoost(state, deltaMs) {
    const norm = EnemyAiSystem.normalizeHunterBoost(state);
    let { phase, msRemaining } = norm;
    let remaining = Math.max(0, Number(deltaMs) || 0);

    while (remaining > 0 && phase !== HUNTER_PHASE_READY) {
      const spent = Math.min(msRemaining, remaining);
      msRemaining -= spent;
      remaining -= spent;
      if (msRemaining > 0) break;
      phase = EnemyAiSystem._nextHunterPhase(phase);
      msRemaining = EnemyAiSystem._hunterPhaseDuration(phase);
    }

    return { phase, msRemaining: phase === HUNTER_PHASE_READY ? 0 : msRemaining };
  }

  /**
   * Tenta ativar o hunter boost (Caçador está pronto e longe do alvo).
   * @param {object} enemy
   * @param {{ x: number, y: number }} target
   * @returns {object} enemy atualizado
   */
  static tryActivateHunterBoost(enemy, target) {
    if (!enemy || enemy.id !== "cacador") return enemy;
    const boost = EnemyAiSystem.normalizeHunterBoost(enemy.hunterBoost);
    if (boost.phase !== HUNTER_PHASE_READY) return { ...enemy, hunterBoost: boost };
    const dist = enemyDistanceTo(enemy, target);
    if (!Number.isFinite(dist) || dist <= 1) return { ...enemy, hunterBoost: boost };
    return { ...enemy, hunterBoost: { phase: HUNTER_PHASE_BOOST, msRemaining: HUNTER_BOOST_MS } };
  }

  /**
   * Atualiza o runtime do hunter boost (Caçador) por deltaMs.
   * @param {object} enemy
   * @param {number} deltaMs
   * @returns {object} enemy atualizado
   */
  static updateHunterBoostRuntime(enemy, deltaMs) {
    if (!enemy || enemy.id !== "cacador") return enemy;
    return { ...enemy, hunterBoost: EnemyAiSystem.advanceHunterBoost(enemy.hunterBoost, deltaMs) };
  }

  /**
   * Multiplicador de velocidade do Caçador baseado no boost.
   * @param {object} enemy
   * @returns {number}
   */
  static getHunterSpeedMult(enemy) {
    const boost = EnemyAiSystem.normalizeHunterBoost(enemy?.hunterBoost);
    if (boost.phase === HUNTER_PHASE_BOOST)   return HUNTER_BOOST_MULT;
    if (boost.phase === HUNTER_PHASE_FATIGUE) return HUNTER_FATIGUE_MULT;
    return 1;
  }

  // ── helpers privados estáticos ────────────────────────────────────────────

  static _nextHunterPhase(phase) {
    if (phase === HUNTER_PHASE_BOOST)   return HUNTER_PHASE_FATIGUE;
    if (phase === HUNTER_PHASE_FATIGUE) return HUNTER_PHASE_RECOVER;
    if (phase === HUNTER_PHASE_RECOVER) return HUNTER_PHASE_READY;
    return HUNTER_PHASE_READY;
  }

  static _hunterPhaseDuration(phase) {
    if (phase === HUNTER_PHASE_BOOST)   return HUNTER_BOOST_MS;
    if (phase === HUNTER_PHASE_FATIGUE) return HUNTER_FATIGUE_MS;
    if (phase === HUNTER_PHASE_RECOVER) return HUNTER_RECOVER_MS;
    return 0;
  }
}

// Expõe constantes para uso externo
EnemyAiSystem.HUNTER_PHASE_READY   = HUNTER_PHASE_READY;
EnemyAiSystem.HUNTER_PHASE_BOOST   = HUNTER_PHASE_BOOST;
EnemyAiSystem.HUNTER_PHASE_FATIGUE = HUNTER_PHASE_FATIGUE;
EnemyAiSystem.HUNTER_PHASE_RECOVER = HUNTER_PHASE_RECOVER;
EnemyAiSystem.DIR_VECTORS          = DIR_VECTORS;

if (typeof module !== "undefined" && module.exports) {
  module.exports = EnemyAiSystem;
}
