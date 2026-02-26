"use strict";

/**
 * BodySystem — gerência do corpo da cobra no modo Shooter.
 *
 * SRP: única responsabilidade de aplicar dano a segmentos e avançar a fila
 *   de regeneração de armas.
 * OCP: novos tipos de segmento adicionados sem alterar o loop principal.
 *
 * Segmentos reconhecidos:
 *   "head"   — cabeça: destruída = game over imediato.
 *   "weapon" — arma: atingida → disabled=true + 5000ms na fila de regen.
 *   "life"   — vida extra: atingida → removida permanentemente.
 */

/** Tempo de regeneração por segmento de arma destruído (ms). */
const WEAPON_REGEN_MS = 5000;

class BodySystem {
  /**
   * Aplica dano ao segmento de índice `hitIndex` no array `snake`.
   *
   * @param {object[]} snake             Array de segmentos com { type, ... }
   * @param {number}   hitIndex          Índice do segmento atingido
   * @param {number[]} weaponRegenQueue  Fila de timers de regeneração (ms)
   * @returns {{ snake: object[], weaponRegenQueue: number[], event: string|null }}
   *   `event` é "game_over" | "weapon_disabled" | "life_lost" | null
   */
  static applyDamage(snake, hitIndex, weaponRegenQueue) {
    if (hitIndex < 0 || hitIndex >= snake.length) {
      return { snake, weaponRegenQueue, event: null };
    }

    const seg = snake[hitIndex];

    if (seg.type === "head") {
      return { snake, weaponRegenQueue, event: "game_over" };
    }

    if (seg.type === "weapon") {
      const nextSnake = snake.map((s, i) =>
        i === hitIndex ? { ...s, disabled: true, attackCooldownMs: 0 } : s
      );
      const nextQueue = [...weaponRegenQueue, WEAPON_REGEN_MS];
      return { snake: nextSnake, weaponRegenQueue: nextQueue, event: "weapon_disabled" };
    }

    if (seg.type === "life") {
      const nextSnake = snake.filter((_, i) => i !== hitIndex);
      return { snake: nextSnake, weaponRegenQueue, event: "life_lost" };
    }

    return { snake, weaponRegenQueue, event: null };
  }

  /**
   * Avança a fila de regeneração de armas em `deltaMs`.
   * Quando o primeiro timer expira, o primeiro segmento de arma desabilitado
   * é reabilitado e o timer é removido da fila.
   *
   * @param {object[]} snake            Array de segmentos
   * @param {number[]} weaponRegenQueue Fila de timers (ms), cada item = 5000ms
   * @param {number}   deltaMs          Tempo decorrido
   * @returns {{ snake: object[], weaponRegenQueue: number[] }}
   */
  static tickRegen(snake, weaponRegenQueue, deltaMs) {
    if (weaponRegenQueue.length === 0) {
      return { snake, weaponRegenQueue };
    }

    const queue = [...weaponRegenQueue];
    queue[0] = Math.max(0, queue[0] - deltaMs);

    if (queue[0] > 0) {
      return { snake, weaponRegenQueue: queue };
    }

    // Primeiro timer expirou — reabilita a primeira arma desabilitada
    queue.shift();
    let regenDone = false;
    const nextSnake = snake.map(seg => {
      if (!regenDone && seg.type === "weapon" && seg.disabled) {
        regenDone = true;
        return { ...seg, disabled: false, attackCooldownMs: 0 };
      }
      return seg;
    });

    return { snake: nextSnake, weaponRegenQueue: queue };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BodySystem, WEAPON_REGEN_MS };
}
