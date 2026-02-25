"use strict";

/**
 * ProceduralGenerator — geração determinística de obstáculos por seed e chunk.
 *
 * Princípio SRP: única responsabilidade de gerar conteúdo procedural de chunks.
 * Princípio OCP: novos tipos de conteúdo gerados podem ser adicionados como
 *   métodos sem alterar a lógica de geração de obstáculos.
 */

const MathUtils = (typeof require !== "undefined")
  ? require("../core/utils.js")
  : (typeof globalThis !== "undefined" ? globalThis.MathUtils : null);

const EntityPool = (typeof require !== "undefined")
  ? require("./entity-pool.js")
  : (typeof globalThis !== "undefined" ? globalThis.EntityPool : null);

class ProceduralGenerator {
  /**
   * @param {number} seed - semente global da sessão
   */
  constructor(seed) {
    this._seed = (Number.isFinite(Number(seed))
      ? Math.floor(Number(seed))
      : Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  /**
   * Gera os obstáculos de um chunk dado suas coordenadas de chunk e parâmetros de fase.
   * @param {number} cx - coordenada X do chunk
   * @param {number} cy - coordenada Y do chunk
   * @param {number} chunkSize
   * @param {"normal"|"boss"|"final_boss"} stageType
   * @param {number} cycle
   * @param {EntityPool} pool
   * @returns {Array<{x: number, y: number}>}
   */
  generateObstacles(cx, cy, chunkSize, stageType, cycle, pool) {
    const rng = this._createChunkRng(cx, cy);
    const count = this._obstacleCount(stageType, cycle);
    const used = new Set();
    const obstacles = [];
    const originX = cx * chunkSize;
    const originY = cy * chunkSize;
    const attempts = count * 8;
    const randInt = MathUtils
      ? MathUtils.randomIntInclusive.bind(MathUtils)
      : (min, max, r) => Math.floor(r() * (max - min + 1)) + min;

    for (let i = 0; i < attempts && obstacles.length < count; i += 1) {
      const localX = randInt(0, chunkSize - 1, rng);
      const localY = randInt(0, chunkSize - 1, rng);
      const key = `${localX},${localY}`;
      if (used.has(key)) continue;
      used.add(key);
      const x = originX + localX;
      const y = originY + localY;
      obstacles.push(pool ? pool.take(x, y) : { x, y });
    }

    return obstacles;
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  /** @private */
  _createChunkRng(cx, cy) {
    let value = this._seed;
    value ^= Math.imul(cx | 0, 374761393);
    value ^= Math.imul(cy | 0, 668265263);
    value  = Math.imul(value ^ (value >>> 13), 1274126177);
    let state = (value ^ (value >>> 16)) >>> 0;

    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** @private */
  _obstacleCount(stageType, cycle) {
    const base = stageType === "normal" ? 4 : stageType === "boss" ? 9 : 12;
    const clamp = MathUtils ? MathUtils.clamp.bind(MathUtils) : (v, mn, mx) => Math.max(mn, Math.min(mx, v));
    return clamp(base + Math.floor((Math.max(1, cycle) - 1) * 1.5), 2, 26);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProceduralGenerator;
}
