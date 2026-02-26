"use strict";

/**
 * ProjectileSystem — movimento e colisão de projéteis no modo Shooter.
 *
 * SRP: única responsabilidade de mover projéteis, expirar TTLs e detectar
 *   colisões com inimigos.
 * OCP: novos comportamentos de projétil (ricochete, penetração, etc.) podem
 *   ser adicionados como novas propriedades sem modificar o loop principal.
 */

/** Raio de hit (células) — projétil acerta inimigo quando distância ≤ HIT_RADIUS. */
const HIT_RADIUS    = 0.6;
const HIT_RADIUS_SQ = HIT_RADIUS * HIT_RADIUS;

class ProjectileSystem {
  /**
   * Avança projéteis por `deltaMs`, move posições e verifica colisões com
   * inimigos. Projéteis que acertam ou expiram são removidos.
   *
   * @param {object[]} projectiles  Array de projéteis { id, x, y, dx, dy, damage, ttlMs, ... }
   * @param {object[]} enemies      Array de inimigos  { id, x, y, hp, maxHp, scoreValue, ... }
   * @param {number}   deltaMs      Tempo decorrido (ms)
   * @returns {{ projectiles: object[], enemies: object[], scoreGained: number }}
   */
  static tick(projectiles, enemies, deltaMs) {
    const dt           = deltaMs / 1000;
    const nextEnemies  = [...enemies];
    let   scoreGained  = 0;

    const nextProjectiles = [];

    for (const p of projectiles) {
      const nx   = p.x + p.dx * dt;
      const ny   = p.y + p.dy * dt;
      const nTtl = p.ttlMs - deltaMs;

      // Projétil expirou
      if (nTtl <= 0) continue;

      // Verifica colisão com cada inimigo vivo
      let hit = false;
      for (let ei = 0; ei < nextEnemies.length; ei++) {
        const e  = nextEnemies[ei];
        const ex = nx - e.x;
        const ey = ny - e.y;

        if (ex * ex + ey * ey <= HIT_RADIUS_SQ) {
          const newHp = e.hp - p.damage;
          if (newHp <= 0) {
            scoreGained += e.scoreValue ?? 0;
            nextEnemies.splice(ei, 1);
            ei -= 1;
          } else {
            nextEnemies[ei] = { ...e, hp: newHp };
          }
          hit = true;
          break;
        }
      }

      if (!hit) {
        nextProjectiles.push({ ...p, x: nx, y: ny, ttlMs: nTtl });
      }
    }

    return { projectiles: nextProjectiles, enemies: nextEnemies, scoreGained };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProjectileSystem;
}
