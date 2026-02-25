"use strict";

/**
 * ChunkManager — gerência de chunks ativos ao redor de uma câmera.
 *
 * Princípio SRP: única responsabilidade de determinar quais chunks estão
 *   ativos e reciclar os que saem do range da câmera.
 * Princípio DIP: delega geração ao ProceduralGenerator e pooling ao EntityPool
 *   injetados no construtor.
 */

const MathUtils = (typeof require !== "undefined")
  ? require("../core/utils.js")
  : (typeof globalThis !== "undefined" ? globalThis.MathUtils : null);

class ChunkManager {
  /**
   * @param {import('./procedural-generator.js')} generator
   * @param {import('./entity-pool.js')} obstaclePool
   * @param {{
   *   chunkSize?: number,
   *   activeRadius?: number,
   *   stageType?: string,
   *   cycle?: number
   * }} [options]
   */
  constructor(generator, obstaclePool, options = {}) {
    this._generator   = generator;
    this._obstaclePool = obstaclePool;

    this.chunkSize    = Math.max(8, Math.floor(options.chunkSize    ?? 32));
    this.activeRadius = Math.max(1, Math.floor(options.activeRadius ?? 2));
    this.stageType    = options.stageType ?? "normal";
    this.cycle        = Math.max(1, Math.floor(options.cycle ?? 1));

    /** @type {Map<string, { cx: number, cy: number, obstacles: Array }>} */
    this.activeChunks = new Map();
    /** @type {Set<string>} */
    this.activeChunkKeys = new Set();
  }

  /**
   * Atualiza os chunks ativos ao redor do centro fornecido.
   * Recicla chunks fora do range; gera os novos necessários.
   * @param {{ x: number, y: number }} cameraCenter
   */
  update(cameraCenter) {
    const floorDiv = MathUtils ? MathUtils.floorDiv.bind(MathUtils) : (v, d) => Math.floor(v / d);

    const centerX = Math.floor(cameraCenter.x);
    const centerY = Math.floor(cameraCenter.y);
    const ccx = floorDiv(centerX, this.chunkSize);
    const ccy = floorDiv(centerY, this.chunkSize);

    const desired = new Set();

    for (let dy = -this.activeRadius; dy <= this.activeRadius; dy += 1) {
      for (let dx = -this.activeRadius; dx <= this.activeRadius; dx += 1) {
        const cx = ccx + dx;
        const cy = ccy + dy;
        const key = `${cx},${cy}`;
        desired.add(key);
        if (!this.activeChunks.has(key)) {
          this._generateChunk(cx, cy, key);
        }
      }
    }

    for (const key of [...this.activeChunkKeys]) {
      if (!desired.has(key)) {
        this._recycleChunk(key);
      }
    }
  }

  /**
   * Retorna os obstáculos visíveis dentro do bound fornecido.
   * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
   * @returns {Array<{ x: number, y: number }>}
   */
  getVisibleObstacles(bounds) {
    const result = [];
    for (const chunk of this.activeChunks.values()) {
      for (const obs of chunk.obstacles) {
        if (
          obs.x >= bounds.minX && obs.x <= bounds.maxX &&
          obs.y >= bounds.minY && obs.y <= bounds.maxY
        ) {
          result.push({ x: obs.x, y: obs.y });
        }
      }
    }
    return result;
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  /** @private */
  _generateChunk(cx, cy, key) {
    const obstacles = this._generator.generateObstacles(
      cx, cy, this.chunkSize, this.stageType, this.cycle, this._obstaclePool
    );
    const chunk = { cx, cy, obstacles };
    this.activeChunks.set(key, chunk);
    this.activeChunkKeys.add(key);
    return chunk;
  }

  /** @private */
  _recycleChunk(key) {
    const chunk = this.activeChunks.get(key);
    if (!chunk) return;
    this.activeChunks.delete(key);
    this.activeChunkKeys.delete(key);
    if (this._obstaclePool) {
      this._obstaclePool.recycleAll(chunk.obstacles);
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = ChunkManager;
}
