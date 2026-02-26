"use strict";

/**
 * SwingSystem — ticks melee swings (expanding arc hitbox) no modo Shooter.
 *
 * SRP: única responsabilidade de avançar swings ativos, verificar quais
 *   inimigos entram no arco e aplicar dano uma única vez por swing/inimigo.
 * OCP: comportamento de swing configurado pelos campos do objeto swing; novos
 *   tipos de melee adicionados sem alterar este sistema.
 *
 * Cada swing:
 *   { id, x, y, dx, dy, range, arcDeg, damage, durationMs, ttlMs, color, hitIds[] }
 *
 * O raio do hitbox se expande de 0 até `range` ao longo de `durationMs`,
 * criando o efeito de shockwave que varre os inimigos à medida que se expande.
 * `hitIds` guarda os IDs já atingidos para evitar dano duplo por swing.
 */

/** Normaliza ângulo para o intervalo (−π, π]. */
function normalizeAngle(a) {
  while (a >  Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

class SwingSystem {
  /**
   * Avança todos os swings ativos por `deltaMs`.
   *
   * Para cada swing:
   *   1. Calcula raio atual: `range * progress` onde `progress = 1 − ttlMs/durationMs`.
   *   2. Verifica novos inimigos que entraram no arco (não em `hitIds`).
   *   3. Aplica dano; remove inimigo se hp ≤ 0.
   *   4. Decrementa ttlMs; descarta swing expirado.
   *
   * @param {object[]} swings    Swings ativos
   * @param {object[]} enemies   Inimigos na arena
   * @param {number}   deltaMs
   * @returns {{ swings: object[], enemies: object[], scoreGained: number }}
   */
  static tick(swings, enemies, deltaMs) {
    let   nextEnemies = [...enemies];
    let   scoreGained = 0;
    const nextSwings  = [];

    for (const sw of swings) {
      const nTtl = sw.ttlMs - deltaMs;
      if (nTtl <= 0) continue;  // swing expirou

      const progress    = 1 - nTtl / sw.durationMs;   // 0→1 ao envelhecer
      const curRadius   = sw.range * Math.max(0.05, progress);
      const curRadiusSq = curRadius * curRadius;
      const halfArcRad  = (sw.arcDeg / 2) * (Math.PI / 180);
      const swDir       = Math.atan2(sw.dy, sw.dx);

      const hitIds = new Set(sw.hitIds ?? []);

      for (let ei = 0; ei < nextEnemies.length; ei++) {
        const e = nextEnemies[ei];
        if (hitIds.has(e.id)) continue;

        const ex = e.x - sw.x;
        const ey = e.y - sw.y;
        const d2 = ex * ex + ey * ey;

        if (d2 > curRadiusSq) continue;

        // Verifica ângulo dentro do arco
        const angle = Math.atan2(ey, ex);
        const diff  = Math.abs(normalizeAngle(angle - swDir));
        if (diff > halfArcRad) continue;

        // Acerto — registra ID e aplica dano
        hitIds.add(e.id);
        const newHp = e.hp - sw.damage;
        if (newHp <= 0) {
          scoreGained += e.scoreValue ?? 0;
          nextEnemies.splice(ei, 1);
          ei -= 1;
        } else {
          nextEnemies[ei] = { ...e, hp: newHp };
        }
      }

      nextSwings.push({ ...sw, ttlMs: nTtl, hitIds: [...hitIds] });
    }

    return { swings: nextSwings, enemies: nextEnemies, scoreGained };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = SwingSystem;
}
