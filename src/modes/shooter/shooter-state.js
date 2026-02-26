"use strict";

/**
 * ShooterState — estado imutável do modo Shooter (substitui Traditional).
 *
 * Princípios SOLID aplicados:
 *   SRP: cria e avança o estado puro do shooter; sem I/O nem rendering.
 *   OCP: novos sistemas adicionados como novos módulos sem alterar este arquivo.
 *   DIP: todos os sistemas são importados via require; testável com mocks.
 *
 * Formato do estado:
 *   mode: "traditional"   — compatível com o roteamento de snake-modes.js
 *   base.*                — cobra (snake), score, direção, tamanho do viewport
 *   shooter.*             — inimigos, projéteis, ondas, câmera, timers
 *   campos legados        — mantidos como null/[] para não quebrar consumers
 */

const { BodySystem }    = require("./systems/body-system.js");
const WeaponSystem      = require("./systems/weapon-system.js");
const ProjectileSystem  = require("./systems/projectile-system.js");
const SwingSystem       = require("./systems/swing-system.js");
const { WaveSystem }    = require("./systems/wave-system.js");
const WeaponCatalog     = require("../../data/weapon-catalog.js");
const EnemyCatalog      = require("../../data/enemy-catalog.js");

// ── Constantes ────────────────────────────────────────────────────────────────

const VIEWPORT_W         = 21;
const VIEWPORT_H         = 21;
const MOVE_PERIOD_MS     = 200;         // ms entre passos da cobra
const ENEMY_CONTACT_DIST = 0.7;        // células — distância de colisão inimigo-cobra
const ENEMY_CONTACT_SQ   = ENEMY_CONTACT_DIST * ENEMY_CONTACT_DIST;

const DIRECTION_VECTORS = Object.freeze({
  UP:         Object.freeze({ x:  0, y: -1 }),
  DOWN:       Object.freeze({ x:  0, y:  1 }),
  LEFT:       Object.freeze({ x: -1, y:  0 }),
  RIGHT:      Object.freeze({ x:  1, y:  0 }),
  UP_LEFT:    Object.freeze({ x: -1, y: -1 }),
  UP_RIGHT:   Object.freeze({ x:  1, y: -1 }),
  DOWN_LEFT:  Object.freeze({ x: -1, y:  1 }),
  DOWN_RIGHT: Object.freeze({ x:  1, y:  1 }),
});

let _eidCounter = 0;

// ── Helpers de cobra ──────────────────────────────────────────────────────────

/**
 * Verifica se duas direções são opostas (produto escalar < 0).
 */
function isOppositeDir(cur, next) {
  const v1 = DIRECTION_VECTORS[cur];
  const v2 = DIRECTION_VECTORS[next];
  if (!v1 || !v2) return false;
  return v1.x * v2.x + v1.y * v2.y < 0;
}

/**
 * Consome o próximo item da fila de entrada e aplica de direção, se válido.
 */
function processInputQueue(base) {
  const queue = base.inputQueue ?? [];
  if (queue.length === 0) return base;

  const [next, ...rest] = queue;
  if (isOppositeDir(base.direction, next)) {
    // Descarta direção oposta e tenta próxima no mesmo tick
    return processInputQueue({ ...base, inputQueue: rest });
  }
  return { ...base, direction: next, inputQueue: rest };
}

/**
 * Move o corpo da cobra um passo na direção indicada.
 * Cada segmento herda a posição do segmento anterior; o tipo é preservado.
 */
function moveSnakeBody(snake, direction) {
  const vec  = DIRECTION_VECTORS[direction] ?? DIRECTION_VECTORS.RIGHT;
  const head = snake[0];
  return snake.map((seg, i) => {
    if (i === 0) return { ...seg, x: head.x + vec.x, y: head.y + vec.y };
    return { ...seg, x: snake[i - 1].x, y: snake[i - 1].y };
  });
}

// ── Helpers de inimigos ───────────────────────────────────────────────────────

function createEnemy(catalogId, x, y, def) {
  return {
    id:         ++_eidCounter,
    x,
    y,
    hp:         def.hp,
    maxHp:      def.hp,
    speed:      def.speed,
    scoreValue: def.scoreValue ?? 10,
    catalogId,
    color:      def.color,
    symbol:     def.symbol,
    shape:      def.shape,
    spawnSound: def.spawnSound ?? null,
  };
}

/**
 * Move todos os inimigos na direção da cabeça da cobra (perseguição direta).
 * Posições são float para movimento suave.
 */
function moveEnemies(enemies, head, deltaMs) {
  const dt = deltaMs / 1000;
  return enemies.map(e => {
    const dx   = head.x - e.x;
    const dy   = head.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    return {
      ...e,
      x: e.x + (dx / dist) * e.speed * dt,
      y: e.y + (dy / dist) * e.speed * dt,
      facingAngle: Math.atan2(dy, dx),
    };
  });
}

/**
 * Verifica colisões entre inimigos e segmentos da cobra.
 * Quando um inimigo toca qualquer segmento:
 *   - Aplica dano ao segmento via BodySystem
 *   - Remove o inimigo da arena
 * Retorna: { snake, weaponRegenQueue, enemies, gameOver }
 */
function resolveEnemySnakeCollisions(enemies, snake, weaponRegenQueue) {
  let nextSnake   = snake;
  let nextQueue   = weaponRegenQueue;
  let gameOver    = false;
  const surviving = [];

  for (const enemy of enemies) {
    let hit = false;
    for (let si = 0; si < nextSnake.length; si++) {
      const seg = nextSnake[si];
      const dx  = enemy.x - seg.x;
      const dy  = enemy.y - seg.y;
      if (dx * dx + dy * dy <= ENEMY_CONTACT_SQ) {
        const result = BodySystem.applyDamage(nextSnake, si, nextQueue);
        nextSnake = result.snake;
        nextQueue = result.weaponRegenQueue;
        if (result.event === "game_over") gameOver = true;
        hit = true;
        break;
      }
    }
    if (!hit) surviving.push(enemy);
  }

  return { snake: nextSnake, weaponRegenQueue: nextQueue, enemies: surviving, gameOver };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Cria o estado inicial do modo Shooter.
 * Cobra começa com 3 segmentos: cabeça, espada, vida.
 *
 * @param {object} [opts]
 * @returns {object}  Estado completo compatível com snake-modes.js
 */
function toOdd(value, minimum) {
  const safe = Math.max(minimum, Math.floor(value));
  return safe % 2 === 0 ? safe + 1 : safe;
}

function computeViewport(viewportAspect) {
  const aspect = Math.max(0.5, Math.min(2.5, Number(viewportAspect) || 1));
  const base   = VIEWPORT_W;
  let w = base;
  let h = base;
  if (aspect >= 1) {
    w = Math.round(base * aspect);
  } else {
    h = Math.round(base / aspect);
  }
  return {
    width:  toOdd(Math.max(base, w), base),
    height: toOdd(Math.max(base, h), base),
  };
}

function createShooterState(opts = {}) {
  const vp  = computeViewport(opts.viewportAspect);
  const W   = vp.width;
  const H   = vp.height;
  const cx  = Math.floor(W / 2);
  const cy  = Math.floor(H / 2);

  const snake = [
    { x: cx,     y: cy, type: "head" },
    { x: cx - 1, y: cy, type: "weapon", weaponId: "espada", disabled: false, attackCooldownMs: 0 },
    { x: cx - 2, y: cy, type: "life" },
  ];

  return {
    mode: "traditional",
    base: {
      snake,
      direction:  "RIGHT",
      inputQueue: [],
      score:      0,
      isGameOver: false,
      isPaused:   false,
      food:       null,
      width:      W,
      height:     H,
    },
    isGameOver: false,
    isPaused:   false,
    shooter: {
      enemies:          [],
      projectiles:      [],
      swings:           [],
      wave: {
        number:      1,
        phase:       "countdown",
        countdownMs: 3000,
        totalInWave: 0,
        spawnQueue:  [],
      },
      weaponRegenQueue:  [],
      camera:            { centerX: cx, centerY: cy, width: W, height: H },
      elapsedMs:         0,
      moveAccumMs:       0,
      movePeriodMs:      MOVE_PERIOD_MS,
      moveStepCount:     0,
    },
    // Campos legados — mantidos para compatibilidade com consumers existentes
    level:             null,
    levelProgress:     0,
    levelTarget:       0,
    barriers:          [],
    enemy:             null,
    powerUp:           null,
    shieldMsRemaining: 0,
    souls:             null,
    tickMs:            MOVE_PERIOD_MS,
  };
}

/**
 * Avança o estado do Shooter por `deltaMs`.
 * Função pura: retorna um novo estado sem mutar o original.
 *
 * Ordem de execução por tick:
 *   1. Acumular tempo de movimento da cobra; mover quando limiar atingido
 *   2. Avançar tempo total decorrido
 *   3. Tick do sistema de ondas (countdown / spawn)
 *   4. Mover inimigos
 *   5. Sistema de armas (cooldowns + disparo automático)
 *   6. Sistema de projéteis (movimento + colisão projétil-inimigo)
 *   7. Colisão inimigo-cobra
 *   8. Tick de regeneração de armas
 *   9. Atualizar câmera
 *
 * @param {object} state
 * @param {{ deltaMs?: number, rng?: Function }} [opts]
 * @returns {object}
 */
function stepShooterState(state, opts = {}) {
  if (state.isGameOver || state.isPaused) return state;

  const deltaMs = Math.max(0, opts.deltaMs ?? 16);
  const rng     = opts.rng ?? Math.random;

  let base    = state.base;
  let shooter = state.shooter;
  let gameOver = false;

  // ── 1. Cobra: movimento guiado por input ────────────────────────────────────
  // A cobra só avança quando:
  //   a) há uma direção explícita na inputQueue (press), OU
  //   b) uma tecla está mantida (holdCurrentDirection) e a fila está vazia.
  //
  // holdCurrentDirection é verificado NO MOMENTO do step, nunca pré-injetado
  // na fila persistente — isso garante que soltar a tecla para o movimento
  // imediatamente, sem overshoot de 1 frame.
  const holdCurrentDirection = opts.holdCurrentDirection === true;
  let moveAccumMs    = Math.max(0, shooter.moveAccumMs - deltaMs);
  let moveStepCount  = shooter.moveStepCount ?? 0;
  const hasQueuedDir = (base.inputQueue ?? []).length > 0;
  if (moveAccumMs === 0 && (hasQueuedDir || holdCurrentDirection)) {
    moveAccumMs = shooter.movePeriodMs;
    moveStepCount += 1;
    // Se a fila está vazia mas a tecla está pressionada, usa direção atual sem
    // alterar a fila persistente.
    if (hasQueuedDir) {
      base = processInputQueue(base);
    }
    base = { ...base, snake: moveSnakeBody(base.snake, base.direction) };
  }

  // ── 2. Tempo decorrido ──────────────────────────────────────────────────────
  const elapsedMs = shooter.elapsedMs + deltaMs;

  // ── 3. Sistema de ondas ─────────────────────────────────────────────────────
  const head       = base.snake[0];
  const waveResult = WaveSystem.tick(
    shooter.wave,
    shooter.enemies,
    head,
    base.width,
    base.height,
    elapsedMs,
    deltaMs,
    rng
  );

  let enemies = shooter.enemies;
  if (waveResult.toSpawn.length > 0) {
    const spawned = waveResult.toSpawn
      .map(sp => {
        const def = EnemyCatalog.getById(sp.catalogId);
        return def ? createEnemy(sp.catalogId, sp.x, sp.y, def) : null;
      })
      .filter(Boolean);
    enemies = [...enemies, ...spawned];
  }

  // ── 4. Mover inimigos ───────────────────────────────────────────────────────
  enemies = moveEnemies(enemies, head, deltaMs);

  // ── 5. Sistema de armas (auto-ataque) ───────────────────────────────────────
  const headDir      = DIRECTION_VECTORS[base.direction] ?? DIRECTION_VECTORS.RIGHT;
  const weaponResult = WeaponSystem.tick(
    base.snake,
    headDir,
    enemies,
    shooter.projectiles,
    shooter.swings,
    WeaponCatalog.ALL,
    deltaMs
  );
  base = { ...base, snake: weaponResult.snake };
  let projectiles = weaponResult.projectiles;
  let swings      = weaponResult.swings;

  // ── 6. Sistema de projéteis ─────────────────────────────────────────────────
  const projResult = ProjectileSystem.tick(projectiles, enemies, deltaMs);
  projectiles = projResult.projectiles;
  enemies     = projResult.enemies;
  base        = { ...base, score: base.score + projResult.scoreGained };

  // ── 6b. Swings melee (arco de espada) ──────────────────────────────────────
  const swingResult = SwingSystem.tick(swings, enemies, deltaMs);
  swings  = swingResult.swings;
  enemies = swingResult.enemies;
  base    = { ...base, score: base.score + swingResult.scoreGained };

  // ── 7. Colisão inimigo-cobra ────────────────────────────────────────────────
  const collResult = resolveEnemySnakeCollisions(enemies, base.snake, shooter.weaponRegenQueue);
  base     = { ...base, snake: collResult.snake };
  enemies  = collResult.enemies;
  let weaponRegenQueue = collResult.weaponRegenQueue;
  if (collResult.gameOver) gameOver = true;

  // ── 8. Regeneração de armas ─────────────────────────────────────────────────
  const regenResult = BodySystem.tickRegen(base.snake, weaponRegenQueue, deltaMs);
  base             = { ...base, snake: regenResult.snake };
  weaponRegenQueue = regenResult.weaponRegenQueue;

  // ── 9. Câmera ───────────────────────────────────────────────────────────────
  const camera = {
    ...shooter.camera,
    centerX: base.snake[0].x,
    centerY: base.snake[0].y,
  };

  const nextShooter = {
    ...shooter,
    enemies,
    projectiles,
    swings,
    wave:             waveResult.wave,
    weaponRegenQueue,
    camera,
    elapsedMs,
    moveAccumMs,
    moveStepCount,
  };

  if (gameOver) {
    return {
      ...state,
      base:      { ...base, isGameOver: true },
      isGameOver: true,
      shooter:   nextShooter,
    };
  }

  return {
    ...state,
    base:      { ...base, isGameOver: false },
    isGameOver: false,
    shooter:   nextShooter,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createShooterState, stepShooterState };
}
