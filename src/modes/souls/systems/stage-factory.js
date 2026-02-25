"use strict";

/**
 * StageFactory — Fábrica que unifica as três variantes de criação de andar
 * do modo Souls.
 *
 * Variantes originais (em snake-modes.js):
 *  - createSoulsStageState       → cria do zero
 *  - transitionSoulsFloorInPlace → transição preservando cobra e progresso
 *  - startNextSoulsFloor         → wrapper de createSoulsStageState + merge
 *
 * Princípio DIP: todas as funções de spawn e de câmera são injetadas via
 * construtor (não importadas diretamente), tornando esta classe testável com
 * mocks.
 *
 * Princípio SRP: única responsabilidade de construir/transicionar descritores
 * de andar; não modifica perfil nem decide recompensas.
 */
class StageFactory {
  /**
   * @param {object} deps Dependências injetadas
   * @param {Function} deps.getStageDescriptor      (floor) → StageDescriptor
   * @param {Function} deps.spawnEnemy               (base, barriers, minions, floor, stageType, bossDef, rng) → enemy
   * @param {Function} deps.spawnMinions             (base, barriers, enemy, stageType, bossOrdinal, cycle, withinCycle, rng) → minions[]
   * @param {Function} deps.rebalanceMinions         (base, barriers, enemy, existing, target, rng) → minions[]
   * @param {Function} deps.getMinionTarget          (stageType, bossOrdinal, cycle, withinCycle) → number
   * @param {Function} deps.spawnFood                (base, souls, barriers, enemy, minions, hazards, echo, rng) → food
   * @param {Function} deps.spawnSigil               (base, souls, barriers, enemy, minions, hazards, echo, rng) → sigil
   * @param {Function} deps.spawnEcho                (base, souls, barriers, enemy, minions, hazards, sigil, pendingEcho, rng) → echo | null
   * @param {Function} deps.updateCameraAndWorld     (base, souls, stageType, viewportAspect) → { camera, barriers }
   * @param {Function} deps.buildCamera              (snakeHead, stageType, viewportAspect) → camera
   * @param {Function} deps.createWorldSession       (stage) → WorldSession
   * @param {Function} deps.getViewportDimensions    (stageType, viewportAspect) → { width, height }
   * @param {Function} deps.normalizeViewportAspect  (raw) → number
   * @param {Function} deps.getObjectiveTarget       (floor, stageType, snakeDef) → number
   * @param {Function} deps.getSnakeDefinition       (souls) → SnakeDef
   * @param {Function} deps.getSnakeSpeedCps         (floor, stageType, souls) → number
   * @param {Function} deps.getEnemySpeedCps         (enemy, params) → number
   * @param {Function} deps.getEnemyBaseRefCps       (floor, stageType) → number
   * @param {Function} deps.getEnemyNormalRefCps     (floor, stageType) → number
   * @param {Function} deps.getArmorPerStage         (souls) → number
   * @param {Function} deps.createStaminaState       (souls, opts) → stamina
   * @param {Function} deps.createStageFlowState     (phase, params?) → StageFlow
   * @param {Function} deps.createMessageFlow        (message) → StageFlow
   * @param {Function} deps.buildSigilIndicator      (base, souls) → SigilIndicator
   * @param {Function} deps.createGameOver           (state, base, souls) → game-over state
   * @param {Function} deps.shouldResetMinions       (fromFloor, toFloor) → boolean
   * @param {Function} deps.clonePositions           (arr) → arr
   * @param {number}   deps.minTickMs                Mínimo de ms por tick
   * @param {number}   deps.countdownMs              Duração do countdown (ms)
   */
  constructor(deps) {
    this._d = deps;
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * Cria um estado de andar do zero.
   * Equivale a `createSoulsStageState(state, floor, rng, options)`.
   *
   * @param {object} state       Estado geral do jogo (souls, base…)
   * @param {number} floor       Número do andar a criar
   * @param {Function} rng       Função de random
   * @param {object}  [options]
   * @param {boolean} [options.includeCountdown=false]
   * @param {number}  [options.viewportAspect]
   * @returns {StageSnapshot}    Objeto parcial com campos do andar
   */
  createFresh(state, floor, rng, options = {}) {
    const d = this._d;
    const stage = d.getStageDescriptor(floor);
    const snakeDef = d.getSnakeDefinition(state.souls);
    const aspect = d.normalizeViewportAspect(
      options.viewportAspect ?? state.souls.viewportAspect ?? 1
    );
    const vp = d.getViewportDimensions(stage.stageType, aspect);

    const base = {
      ...state.base,
      width: vp.width,
      height: vp.height,
      snake: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -2, y: 0 }],
      direction: "RIGHT",
      inputQueue: [],
      food: null,
      score: state.base.score,
      isGameOver: false,
      isPaused: false,
    };

    const worldSession = d.createWorldSession(stage);
    const stageSouls = {
      ...state.souls,
      floor,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      stageType: stage.stageType,
      world: worldSession,
      viewportAspect: aspect,
    };

    const camResult = d.updateCameraAndWorld(base, stageSouls, stage.stageType, aspect);
    const barriers = camResult.barriers;
    const hazards = [];

    const enemy = d.spawnEnemy(base, barriers, [], floor, stage.stageType, stage.bossDefinition, rng);
    const minions = d.spawnMinions(
      base, barriers, enemy, stage.stageType, stage.bossOrdinal, stage.cycle, stage.withinCycle, rng
    );

    let food = null;
    let sigil = null;

    if (stage.stageType === "normal") {
      food = d.spawnFood(base, stageSouls, barriers, enemy, minions, hazards, null, null, rng);
    } else {
      sigil = d.spawnSigil(base, stageSouls, barriers, enemy, minions, hazards, null, rng);
    }

    const echo = floor === 1 && stage.stageType === "normal"
      ? d.spawnEcho(base, stageSouls, barriers, enemy, minions, hazards, sigil, state.souls.profile?.pendingEcho ?? null, rng)
      : null;

    const objectiveTarget = d.getObjectiveTarget(floor, stage.stageType, snakeDef);
    const snakeSpeedCps = d.getSnakeSpeedCps(floor, stage.stageType, state.souls);
    const enemySpeedCps = enemy
      ? d.getEnemySpeedCps(enemy, {
        snakeBaseCps: d.getEnemyBaseRefCps(floor, stage.stageType),
        snakeNormalCps: d.getEnemyNormalRefCps(floor, stage.stageType),
      })
      : 0;

    const stageFlow = options.includeCountdown === true
      ? d.createStageFlowState("countdown", { msRemaining: d.countdownMs })
      : d.createStageFlowState("idle");

    return {
      base: { ...base, food },
      barriers,
      hazards,
      enemy,
      minions,
      echo,
      sigil,
      sigilRespawnMsRemaining: 0,
      enemyTeleportPreview: null,
      stageType: stage.stageType,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      bossOrdinal: stage.bossOrdinal,
      bossName: stage.bossDefinition?.name ?? null,
      objectiveType: stage.stageType === "normal" ? "food" : "sigil",
      objectiveProgress: 0,
      objectiveTarget,
      camera: camResult.camera,
      world: worldSession,
      stageFlow,
      viewportAspect: aspect,
      sigilIndicator: d.buildSigilIndicator(
        { ...base, food },
        { ...stageSouls, camera: camResult.camera, sigil, objectiveType: stage.stageType === "normal" ? "food" : "sigil" }
      ),
      tickMs: Math.max(d.minTickMs, Math.round(1000 / snakeSpeedCps)),
      snakeSpeedCps,
      enemySpeedCps,
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
      armorCharges: d.getArmorPerStage(state.souls),
      stamina: d.createStaminaState(state.souls, { current: "max" }),
      countdownMsRemaining: stageFlow.phase === "countdown" ? stageFlow.msRemaining : 0,
    };
  }

  /**
   * Transita um estado existente para um novo andar preservando cobra e progresso.
   * Equivale a `transitionSoulsFloorInPlace(state, currentBase, souls, floor, rng, options)`.
   *
   * @param {object}   state
   * @param {object}   currentBase
   * @param {object}   souls
   * @param {number}   floor
   * @param {Function} rng
   * @param {object}  [options]
   * @param {boolean} [options.keepCurrentObstacles=true]
   * @param {boolean} [options.resetMinions]
   * @param {string}  [options.message=""]
   * @param {number}  [options.viewportAspect]
   * @returns {object} Estado completo do jogo após a transição
   */
  transition(state, currentBase, souls, floor, rng, options = {}) {
    const d = this._d;
    const stage = d.getStageDescriptor(floor);
    const snakeDef = d.getSnakeDefinition(souls);
    const aspect = d.normalizeViewportAspect(
      options.viewportAspect ?? souls.viewportAspect ?? state.souls.viewportAspect ?? 1
    );
    const vp = d.getViewportDimensions(stage.stageType, aspect);
    const keepObs = options.keepCurrentObstacles !== false;
    const shouldReset = options.resetMinions === true
      || d.shouldResetMinions(souls.floor, floor);
    const sourceMinions = shouldReset ? [] : (souls.minions ?? []);

    const nextBase = {
      ...currentBase,
      width: vp.width,
      height: vp.height,
      food: null,
      isGameOver: false,
      isPaused: false,
    };
    const nextSouls = {
      ...souls,
      floor,
      cycle: stage.cycle,
      withinCycle: stage.withinCycle,
      stageType: stage.stageType,
      bossOrdinal: stage.bossOrdinal,
      bossName: stage.bossDefinition?.name ?? null,
      objectiveType: stage.stageType === "normal" ? "food" : "sigil",
      objectiveProgress: 0,
      objectiveTarget: d.getObjectiveTarget(floor, stage.stageType, snakeDef),
      sigil: null,
      sigilRespawnMsRemaining: 0,
      hazards: [],
      enemyTeleportPreview: null,
      echo: null,
      reward: null,
      rewardRerolled: false,
      world: souls.world ?? d.createWorldSession(stage),
      viewportAspect: aspect,
      stageFlow: d.createMessageFlow(options.message ?? ""),
      snakeMoveAccumulatorMs: 0,
      enemyMoveAccumulatorMs: 0,
      armorCharges: d.getArmorPerStage(souls),
      stamina: d.createStaminaState(souls, { current: "max" }),
      countdownMsRemaining: 0,
    };
    const camera = d.buildCamera(nextBase.snake[0], stage.stageType, aspect);
    nextSouls.camera = camera;

    // Sync world session
    if (nextSouls.world && typeof nextSouls.world.updateChunks === "function") {
      nextSouls.world.stageType = stage.stageType;
      nextSouls.world.cycle = stage.cycle;
      nextSouls.world.updateChunks({ x: camera.centerX, y: camera.centerY });
    }

    let barriers = keepObs && Array.isArray(state.barriers)
      ? d.clonePositions(state.barriers)
      : [];
    if (barriers.length === 0) {
      const camResult = d.updateCameraAndWorld(nextBase, nextSouls, stage.stageType, aspect);
      nextSouls.camera = camResult.camera;
      barriers = camResult.barriers ?? [];
    }

    const minionTarget = d.getMinionTarget(stage.stageType, stage.bossOrdinal, stage.cycle, stage.withinCycle);
    let minions = d.rebalanceMinions(nextBase, barriers, null, sourceMinions, minionTarget, rng);
    const enemy = d.spawnEnemy(nextBase, barriers, minions, floor, stage.stageType, stage.bossDefinition, rng);
    minions = d.rebalanceMinions(nextBase, barriers, enemy, minions, minionTarget, rng);

    if (nextSouls.objectiveType === "food") {
      nextBase.food = d.spawnFood(nextBase, nextSouls, barriers, enemy, minions, nextSouls.hazards, null, nextSouls.echo, rng);
      if (!nextBase.food) return d.createGameOver(state, nextBase, nextSouls);
    } else {
      nextSouls.sigil = d.spawnSigil(nextBase, nextSouls, barriers, enemy, minions, nextSouls.hazards, nextSouls.echo, rng);
      if (!nextSouls.sigil) return d.createGameOver(state, nextBase, nextSouls);
    }

    nextSouls.minions = minions;
    nextSouls.snakeSpeedCps = d.getSnakeSpeedCps(floor, stage.stageType, nextSouls);
    nextSouls.enemySpeedCps = enemy
      ? d.getEnemySpeedCps(enemy, {
        snakeBaseCps: d.getEnemyBaseRefCps(floor, stage.stageType),
        snakeNormalCps: d.getEnemyNormalRefCps(floor, stage.stageType),
      })
      : 0;
    nextSouls.sigilIndicator = d.buildSigilIndicator(nextBase, nextSouls);

    return {
      ...state,
      base: nextBase,
      tickMs: Math.max(d.minTickMs, Math.round(1000 / nextSouls.snakeSpeedCps)),
      barriers: d.clonePositions(barriers),
      enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls: nextSouls,
    };
  }

  /**
   * Cria um próximo andar a partir de um estado existente.
   * Equivale a `startNextSoulsFloor(state, currentBase, souls, floor, rng, options)`.
   *
   * @param {object}   state
   * @param {object}   currentBase
   * @param {object}   souls
   * @param {number}   floor
   * @param {Function} rng
   * @param {object}  [options]
   * @param {boolean} [options.includeCountdown=true]
   * @param {number}  [options.viewportAspect]
   * @returns {object} Estado completo do jogo com o novo andar
   */
  startNext(state, currentBase, souls, floor, rng, options = {}) {
    const includeCountdown = options.includeCountdown !== false;
    const workingState = {
      ...state,
      base: currentBase,
      souls: {
        ...souls,
        floor,
        objectiveProgress: 0,
        reward: null,
        rewardRerolled: false,
      },
    };

    const snap = this.createFresh(workingState, floor, rng, {
      includeCountdown,
      viewportAspect: options.viewportAspect ?? souls.viewportAspect ?? state.souls.viewportAspect ?? 1,
    });

    return {
      ...workingState,
      base: {
        ...snap.base,
        score: currentBase.score,
        isGameOver: false,
        isPaused: false,
      },
      tickMs: snap.tickMs,
      barriers: snap.barriers,
      enemy: snap.enemy,
      powerUp: null,
      isGameOver: false,
      isPaused: false,
      souls: {
        ...workingState.souls,
        cycle: snap.cycle,
        withinCycle: snap.withinCycle,
        stageType: snap.stageType,
        bossOrdinal: snap.bossOrdinal,
        bossName: snap.bossName,
        objectiveType: snap.objectiveType,
        objectiveTarget: snap.objectiveTarget,
        objectiveProgress: snap.objectiveProgress,
        sigil: snap.sigil,
        sigilRespawnMsRemaining: snap.sigilRespawnMsRemaining,
        hazards: snap.hazards,
        enemyTeleportPreview: snap.enemyTeleportPreview,
        echo: snap.echo,
        minions: snap.minions,
        camera: snap.camera,
        world: snap.world,
        stageFlow: snap.stageFlow,
        viewportAspect: snap.viewportAspect,
        sigilIndicator: snap.sigilIndicator,
        snakeSpeedCps: snap.snakeSpeedCps,
        enemySpeedCps: snap.enemySpeedCps,
        snakeMoveAccumulatorMs: snap.snakeMoveAccumulatorMs,
        enemyMoveAccumulatorMs: snap.enemyMoveAccumulatorMs,
        armorCharges: snap.armorCharges,
        stamina: snap.stamina,
        countdownMsRemaining: snap.countdownMsRemaining,
      },
    };
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = StageFactory;
}
