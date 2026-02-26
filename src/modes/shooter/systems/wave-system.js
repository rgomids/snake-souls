"use strict";

/**
 * WaveSystem — gerência de ondas de inimigos no modo Shooter.
 *
 * SRP: única responsabilidade de controlar o ciclo countdown → active → (próxima onda).
 * OCP: curva de dificuldade e tabela de tipos disponíveis por onda são derivadas
 *   de constantes puras, extensíveis sem alterar o algoritmo central.
 */

const WAVE_COUNTDOWN_MS     = 3000;
const MAX_ENEMIES_PER_WAVE  = 25;
const SPAWN_STAGGER_MS      = 300;  // intervalo entre cada inimigo sendo spawnado

/** Tipos de inimigo por onda: wave ≤2 → só crawlers; ≤4 → + darts; 5+ → todos */
const WAVE_TYPE_TIERS = [
  ["crawler"],
  ["crawler"],
  ["crawler", "dart"],
  ["crawler", "dart"],
  ["crawler", "dart", "bastion"],
];

class WaveSystem {
  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * Número de inimigos para esta onda.
   * Cresce linearmente com a onda e com o tempo decorrido.
   * @param {number} waveNumber
   * @param {number} elapsedMs
   * @returns {number}
   */
  static getWaveEnemyCount(waveNumber, elapsedMs) {
    const fromWave = 3 + (waveNumber - 1) * 2;
    const fromTime = Math.floor(elapsedMs / 30000);
    return Math.min(MAX_ENEMIES_PER_WAVE, fromWave + fromTime);
  }

  /**
   * Tipos de inimigo disponíveis para a onda indicada.
   * @param {number} waveNumber
   * @returns {string[]}
   */
  static getAvailableTypes(waveNumber) {
    const idx = Math.min(waveNumber - 1, WAVE_TYPE_TIERS.length - 1);
    return WAVE_TYPE_TIERS[idx];
  }

  /**
   * Constrói a lista de inimigos a spawnar para esta onda.
   * @param {number}   waveNumber
   * @param {number}   elapsedMs
   * @param {Function} rng
   * @returns {{ catalogId: string }[]}
   */
  static buildSpawnList(waveNumber, elapsedMs, rng) {
    const count = WaveSystem.getWaveEnemyCount(waveNumber, elapsedMs);
    const types = WaveSystem.getAvailableTypes(waveNumber);
    const list  = [];
    for (let i = 0; i < count; i++) {
      list.push({ catalogId: types[Math.floor(rng() * types.length)] });
    }
    return list;
  }

  /**
   * Calcula uma posição de spawn fora do viewport centrado na cabeça da cobra.
   * @param {{ x: number, y: number }} head
   * @param {number}   viewportW
   * @param {number}   viewportH
   * @param {Function} rng
   * @returns {{ x: number, y: number }}
   */
  static spawnPosition(head, viewportW, viewportH, rng) {
    const radius = Math.ceil(Math.max(viewportW, viewportH) / 2) + 4;
    const angle  = rng() * Math.PI * 2;
    return {
      x: Math.round(head.x + Math.cos(angle) * radius),
      y: Math.round(head.y + Math.sin(angle) * radius),
    };
  }

  // ── Main tick ─────────────────────────────────────────────────────────────

  /**
   * Avança o estado de onda por `deltaMs`.
   *
   * - Fase "countdown": decrementa countdownMs; quando zera → spawna inimigos
   *   e passa para "active".
   * - Fase "active": quando todos os inimigos morrem → inicia novo countdown
   *   com wave.number incrementado.
   *
   * @param {object}   wave      Estado atual da onda
   * @param {object[]} enemies   Inimigos vivos atualmente
   * @param {{ x: number, y: number }} head  Posição da cabeça da cobra
   * @param {number}   viewportW
   * @param {number}   viewportH
   * @param {number}   elapsedMs
   * @param {number}   deltaMs
   * @param {Function} rng
   * @returns {{ wave: object, toSpawn: { catalogId: string, x: number, y: number }[] }}
   */
  static tick(wave, enemies, head, viewportW, viewportH, elapsedMs, deltaMs, rng) {
    if (wave.phase === "countdown") {
      const nextMs = Math.max(0, wave.countdownMs - deltaMs);
      if (nextMs > 0) {
        return { wave: { ...wave, countdownMs: nextMs }, toSpawn: [] };
      }

      // Countdown terminou — monta a fila de spawn com timestamps escalonados
      const spawnList  = WaveSystem.buildSpawnList(wave.number, elapsedMs, rng);
      const spawnQueue = spawnList.map((s, i) => ({
        catalogId: s.catalogId,
        spawnAt:   elapsedMs + i * SPAWN_STAGGER_MS,
        ...WaveSystem.spawnPosition(head, viewportW, viewportH, rng),
      }));

      return {
        wave: {
          ...wave,
          phase:       "active",
          countdownMs: 0,
          totalInWave: spawnList.length,
          spawnQueue,
        },
        toSpawn: [],
      };
    }

    // Fase ativa — drena entradas da fila cujo tempo de spawn chegou
    const queue    = wave.spawnQueue ?? [];
    const toSpawn  = queue.filter(s => s.spawnAt <= elapsedMs);
    const remaining = queue.filter(s => s.spawnAt  > elapsedMs);

    // Verifica se onda foi limpa: sem inimigos vivos E sem pendentes na fila
    if (enemies.length === 0 && remaining.length === 0 && toSpawn.length === 0) {
      return {
        wave: {
          number:      wave.number + 1,
          phase:       "countdown",
          countdownMs: WAVE_COUNTDOWN_MS,
          totalInWave: 0,
          spawnQueue:  [],
        },
        toSpawn: [],
      };
    }

    return {
      wave: { ...wave, spawnQueue: remaining },
      toSpawn,
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { WaveSystem, WAVE_COUNTDOWN_MS };
}
