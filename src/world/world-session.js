"use strict";

/**
 * WorldSession — orquestra câmera, chunks, pools e spawns do mundo infinito.
 *
 * Princípio SRP: única responsabilidade de coordenar subsistemas do mundo
 *   por sessão de jogo Souls.
 * Princípio DIP: Camera, ChunkManager, EntityPool, ProceduralGenerator são
 *   injetados (ou criados internamente com defaults) — jamais instanciados
 *   por dependência inline no código de game-logic.
 * Princípio OCP: novos tipos de entidade de mundo são adicionados como novos
 *   métodos de spawn, sem alterar os existentes.
 */

const Camera            = (typeof require !== "undefined") ? require("./camera.js")             : globalThis.Camera;
const EntityPool        = (typeof require !== "undefined") ? require("./entity-pool.js")         : globalThis.EntityPool;
const ProceduralGenerator = (typeof require !== "undefined") ? require("./procedural-generator.js") : globalThis.ProceduralGenerator;
const ChunkManager      = (typeof require !== "undefined") ? require("./chunk-manager.js")       : globalThis.ChunkManager;
const MathUtils         = (typeof require !== "undefined") ? require("../core/utils.js")         : globalThis.MathUtils;

const POOL_LIMITS = Object.freeze({
  obstaclePool: 800,
  pickupPool:    80,
  minionPool:   120,
});

const MIN_SIGIL_DISTANCE        = 18;
const DEFAULT_REENTRY_COOLDOWN  = 1200;

class WorldSession {
  /**
   * @param {{
   *   seed?: number,
   *   chunkSize?: number,
   *   activeRadius?: number,
   *   stageType?: string,
   *   cycle?: number,
   *   rng?: () => number
   * }} [options]
   */
  constructor(options = {}) {
    const seed = Number.isFinite(Number(options.seed))
      ? Math.floor(Number(options.seed))
      : Math.floor(Math.random() * 0xffffffff);

    this.stageType = options.stageType ?? "normal";
    this.cycle     = Math.max(1, Math.floor(options.cycle ?? 1));
    this.random    = options.rng ?? Math.random;

    this._obstaclePool = new EntityPool(POOL_LIMITS.obstaclePool);
    this._pickupPool   = new EntityPool(POOL_LIMITS.pickupPool);
    this._minionPool   = new EntityPool(POOL_LIMITS.minionPool);

    const generator = new ProceduralGenerator(seed);
    this._chunks = new ChunkManager(generator, this._obstaclePool, {
      chunkSize:    options.chunkSize    ?? 32,
      activeRadius: options.activeRadius ?? 2,
      stageType:    this.stageType,
      cycle:        this.cycle,
    });

    this.lastCameraCenter = { x: 0, y: 0 };
  }

  // ── Acesso aos chunks ─────────────────────────────────────────────────────

  /** Compatibilidade com código legado que lê world.activeChunks */
  get activeChunks()    { return this._chunks.activeChunks; }
  get activeChunkKeys() { return this._chunks.activeChunkKeys; }

  /** Compatibilidade com código legado que lê world.pools */
  get pools() {
    return {
      obstaclePool: this._obstaclePool._pool,
      pickupPool:   this._pickupPool._pool,
      minionPool:   this._minionPool._pool,
    };
  }

  // ── API principal ─────────────────────────────────────────────────────────

  /**
   * Atualiza chunks ativos ao redor do centro da câmera.
   * @param {{ x: number, y: number }} cameraCenter
   */
  updateChunks(cameraCenter) {
    this.lastCameraCenter = { x: Math.floor(cameraCenter.x), y: Math.floor(cameraCenter.y) };
    this._chunks.update(cameraCenter);
  }

  /**
   * Retorna entidades visíveis (obstáculos) dentro da câmera.
   * @param {Camera} camera
   * @returns {{ barriers: Array<{x:number,y:number}> }}
   */
  getVisibleEntities(camera) {
    const bounds = camera.getBounds(3);
    return { barriers: this._chunks.getVisibleObstacles(bounds) };
  }

  /**
   * Spawna um item de comida dentro ou próximo do viewport.
   * @param {{ x: number, y: number }} snakeHead
   * @param {Set<string>} [blockedSet]
   * @param {Camera | null} [camera]
   * @returns {{ x: number, y: number } | null}
   */
  spawnFood(snakeHead, blockedSet = new Set(), camera = null) {
    this.updateChunks(snakeHead);
    const cam = camera ?? Camera.forSpawn(snakeHead, this.stageType);
    const bounds = cam.getBounds(0);

    const randInt = (min, max) => MathUtils
      ? MathUtils.randomIntInclusive(min, max, this.random)
      : Math.floor(this.random() * (max - min + 1)) + min;

    const keyFn = MathUtils ? MathUtils.keyForPosition.bind(MathUtils) : (p) => `${p.x},${p.y}`;

    for (let a = 0; a < 600; a += 1) {
      const candidate = { x: randInt(bounds.minX, bounds.maxX), y: randInt(bounds.minY, bounds.maxY) };
      if (!blockedSet.has(keyFn(candidate))) {
        return this._pickupPool.take(candidate.x, candidate.y);
      }
    }

    const chunkList = Array.from(this._chunks.activeChunks.values());
    for (let a = 0; a < 1000; a += 1) {
      if (chunkList.length === 0) return null;
      const chunk = chunkList[randInt(0, chunkList.length - 1)];
      const x = chunk.cx * this._chunks.chunkSize + randInt(0, this._chunks.chunkSize - 1);
      const y = chunk.cy * this._chunks.chunkSize + randInt(0, this._chunks.chunkSize - 1);
      const candidate = { x, y };
      if (!blockedSet.has(keyFn(candidate))) {
        return this._pickupPool.take(x, y);
      }
    }

    return null;
  }

  /**
   * Spawna um sigilo longe da cobra, prefencialmente fora da câmera.
   * @param {{ x: number, y: number }} snakeHead
   * @param {Set<string>} [blockedSet]
   * @param {number} [minDistance]
   * @param {boolean} [requireOffscreen]
   * @param {Camera | null} [camera]
   * @returns {{ x: number, y: number } | null}
   */
  spawnSigil(snakeHead, blockedSet = new Set(), minDistance = MIN_SIGIL_DISTANCE, requireOffscreen = true, camera = null) {
    this.updateChunks(snakeHead);

    const cam = camera ?? Camera.forSpawn(snakeHead, this.stageType);
    const dist = MathUtils ? MathUtils.manhattanDistance.bind(MathUtils) : (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const keyFn = MathUtils ? MathUtils.keyForPosition.bind(MathUtils) : (p) => `${p.x},${p.y}`;
    const safeDist = Math.max(1, Math.floor(minDistance));

    for (let a = 0; a < 2000; a += 1) {
      const radius = safeDist + this._randInt(0, 64);
      const angle = this.random() * Math.PI * 2;
      const x = snakeHead.x + Math.round(Math.cos(angle) * radius);
      const y = snakeHead.y + Math.round(Math.sin(angle) * radius);
      const candidate = { x, y };

      if (blockedSet.has(keyFn(candidate))) continue;
      if (dist(candidate, snakeHead) < safeDist) continue;
      if (requireOffscreen && cam.contains(candidate, 0)) continue;

      return this._pickupPool.take(x, y);
    }

    for (let radius = safeDist; radius <= safeDist + 96; radius += 2) {
      const ring = [
        { x: snakeHead.x + radius, y: snakeHead.y },
        { x: snakeHead.x - radius, y: snakeHead.y },
        { x: snakeHead.x, y: snakeHead.y + radius },
        { x: snakeHead.x, y: snakeHead.y - radius },
        { x: snakeHead.x + radius, y: snakeHead.y + radius },
        { x: snakeHead.x - radius, y: snakeHead.y + radius },
        { x: snakeHead.x + radius, y: snakeHead.y - radius },
        { x: snakeHead.x - radius, y: snakeHead.y - radius },
      ];
      for (const candidate of ring) {
        if (blockedSet.has(keyFn(candidate))) continue;
        if (requireOffscreen && cam.contains(candidate, 0)) continue;
        return this._pickupPool.take(candidate.x, candidate.y);
      }
    }

    return null;
  }

  /**
   * Re-entra um inimigo que saiu do campo visual pelas bordas da câmera.
   * @param {object} enemy
   * @param {{ x: number, y: number }} snakeHead
   * @param {Camera} camera
   * @param {number} [cooldownMs]
   * @param {Set<string>} [blockedSet]
   * @param {number} [deltaMs]
   * @returns {object}
   */
  reenterEnemy(enemy, snakeHead, camera, cooldownMs = DEFAULT_REENTRY_COOLDOWN, blockedSet = new Set(), deltaMs = 0) {
    if (!enemy) return enemy;

    const next = {
      ...enemy,
      reentryCooldownMs: Math.max(0, (enemy.reentryCooldownMs ?? 0) - Math.max(0, deltaMs)),
    };

    const outside = !camera.contains(next, 8);
    if (!outside || next.reentryCooldownMs > 0) return next;

    const dist = MathUtils ? MathUtils.manhattanDistance.bind(MathUtils) : (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const keyFn = MathUtils ? MathUtils.keyForPosition.bind(MathUtils) : (p) => `${p.x},${p.y}`;
    const bounds = camera.getBounds(4);
    const candidates = this._buildEdgeCandidates(bounds);

    for (let i = 0; i < candidates.length; i += 1) {
      const idx = this._randInt(0, candidates.length - 1);
      const candidate = candidates[idx];
      if (dist(candidate, snakeHead) < 8) continue;
      if (blockedSet.has(keyFn(candidate))) continue;
      return { ...next, x: candidate.x, y: candidate.y, reentryCooldownMs: Math.max(0, cooldownMs) };
    }

    return next;
  }

  /**
   * Recicla um pickup de volta ao pool.
   * @param {{ x: number, y: number } | null} position
   * @param {"pickupPool"|"minionPool"} poolName
   */
  recyclePickup(position, poolName = "pickupPool") {
    const pool = poolName === "minionPool" ? this._minionPool : this._pickupPool;
    pool.recycle(position);
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  /** @private */
  _randInt(min, max) {
    return MathUtils
      ? MathUtils.randomIntInclusive(min, max, this.random)
      : Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** @private */
  _buildEdgeCandidates(bounds) {
    const candidates = [];
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      candidates.push({ x, y: bounds.minY });
      candidates.push({ x, y: bounds.maxY });
    }
    for (let y = bounds.minY + 1; y <= bounds.maxY - 1; y += 1) {
      candidates.push({ x: bounds.minX, y });
      candidates.push({ x: bounds.maxX, y });
    }
    return candidates;
  }
}

WorldSession.POOL_LIMITS = POOL_LIMITS;

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorldSession;
}
