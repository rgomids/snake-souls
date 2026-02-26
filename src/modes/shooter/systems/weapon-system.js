"use strict";

/**
 * WeaponSystem — auto-ataque de armas da cobra no modo Shooter.
 *
 * SRP: única responsabilidade de avançar cooldowns e disparar ataques
 *   automaticamente quando inimigos entram no alcance.
 * OCP: novos tipos de arma adicionados via WeaponCatalog (JSON) sem alterar
 *   este sistema — `type: "melee"` produz um swing; outros tipos produzem
 *   projéteis.
 * DIP: recebe definições de arma e direção via parâmetros; sem imports diretos.
 */

let _swingIdCounter = 0;
let _projIdCounter  = 0;

class WeaponSystem {
  /**
   * Retorna os segmentos de arma ativos (não desabilitados).
   * @param {object[]} snake
   * @returns {object[]}
   */
  static getActiveWeapons(snake) {
    return snake.filter(s => s.type === "weapon" && !s.disabled);
  }

  /**
   * Avança cooldowns; produz swings (melee) ou projéteis (ranged) quando o
   * cooldown zera e há inimigos no alcance.
   *
   * @param {object[]} snake        Segmentos da cobra
   * @param {{x,y}}    headDir      Vetor unitário da direção da cabeça
   * @param {object[]} enemies      Inimigos (posições float)
   * @param {object[]} projectiles  Projéteis existentes
   * @param {object[]} swings       Swings existentes
   * @param {object[]} weaponDefs   WeaponCatalog.ALL — definições imutáveis
   * @param {number}   deltaMs      Tempo decorrido
   * @returns {{ snake: object[], projectiles: object[], swings: object[] }}
   */
  static tick(snake, headDir, enemies, projectiles, swings, weaponDefs, deltaMs) {
    const newProjectiles = [...projectiles];
    const newSwings      = [...swings];

    const nextSnake = snake.map(seg => {
      if (seg.type !== "weapon" || seg.disabled) return seg;

      // Avança cooldown
      const cd = Math.max(0, seg.attackCooldownMs - deltaMs);
      if (cd > 0) return { ...seg, attackCooldownMs: cd };

      // Cooldown chegou a zero — tenta atacar
      const wDef = weaponDefs.find(w => w.id === seg.weaponId);
      if (!wDef) return { ...seg, attackCooldownMs: 0 };

      if (wDef.type === "melee") {
        // Swing melee — sempre dispara ao recarregar, independente de inimigos.
        // O jogador posiciona a cobra para atingir os inimigos com o arco.
        const mag  = Math.sqrt(headDir.x * headDir.x + headDir.y * headDir.y) || 1;
        const ndx  = headDir.x / mag;
        const ndy  = headDir.y / mag;
        newSwings.push({
          id:          ++_swingIdCounter,
          x:           seg.x,
          y:           seg.y,
          dx:          ndx,
          dy:          ndy,
          range:       wDef.range,
          arcDeg:      wDef.arcDeg ?? 120,
          damage:      wDef.damage,
          durationMs:  wDef.swingDurationMs ?? 200,
          ttlMs:       wDef.swingDurationMs ?? 200,
          color:       wDef.color ?? "#ffe066",
          hitIds:      [],
          attackSound: wDef.attackSound ?? null,
        });
      } else {
        // Projétil ranged — só dispara se houver inimigo no alcance.
        if (enemies.length === 0) return { ...seg, attackCooldownMs: 0 };
        const target = WeaponSystem._findClosestInRange(seg, enemies, wDef.range);
        if (!target) return { ...seg, attackCooldownMs: 0 };
        const dx   = target.x - seg.x;
        const dy   = target.y - seg.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        newProjectiles.push({
          id:     ++_projIdCounter,
          x:      seg.x,
          y:      seg.y,
          dx:     (dx / dist) * (wDef.projectileSpeed ?? 10),
          dy:     (dy / dist) * (wDef.projectileSpeed ?? 10),
          damage: wDef.damage,
          ttlMs:  wDef.projectileTtlMs ?? 500,
          symbol: wDef.projectileSymbol ?? "·",
          color:  wDef.projectileColor ?? "#ffe066",
        });
      }

      return { ...seg, attackCooldownMs: wDef.cooldownMs };
    });

    return { snake: nextSnake, projectiles: newProjectiles, swings: newSwings };
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  /**
   * Encontra o inimigo mais próximo dentro do alcance (distância euclidiana).
   */
  static _findClosestInRange(origin, enemies, range) {
    const rangeSq = range * range;
    let best     = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      const dx = e.x - origin.x;
      const dy = e.y - origin.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= rangeSq && d2 < bestDist) {
        bestDist = d2;
        best     = e;
      }
    }
    return best;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = WeaponSystem;
}
