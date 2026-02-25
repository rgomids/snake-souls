/**
 * tests/oop-core.test.mjs — testes das classes OOP Core + Data
 *
 * Cobre: MathUtils, Direction, KonamiTracker, StaminaSystem,
 *        HazardSystem, EconomySystem, EnemyAiSystem, ModeFactory
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const MathUtils      = require("../src/core/utils.js");
const Direction      = require("../src/core/direction.js");
const EventEmitter   = require("../src/core/event-emitter.js");
const KonamiTracker  = require("../src/input/konami-tracker.js");
const StaminaSystem  = require("../src/modes/souls/systems/stamina-system.js");
const HazardSystem   = require("../src/modes/souls/systems/hazard-system.js");
const EconomySystem  = require("../src/modes/souls/systems/economy-system.js");
const EnemyAiSystem  = require("../src/modes/souls/systems/enemy-ai-system.js");
const ModeFactory    = require("../src/modes/mode-factory.js");

// ─── MathUtils ───────────────────────────────────────────────────────────────

describe("MathUtils", () => {
  it("clamp stays within bounds", () => {
    assert.equal(MathUtils.clamp(5, 0, 10), 5);
    assert.equal(MathUtils.clamp(-5, 0, 10), 0);
    assert.equal(MathUtils.clamp(15, 0, 10), 10);
  });

  it("randomIntInclusive returns value in [min, max]", () => {
    for (let i = 0; i < 50; i++) {
      const v = MathUtils.randomIntInclusive(3, 7, Math.random);
      assert.ok(v >= 3 && v <= 7, `out of range: ${v}`);
    }
  });

  it("manhattanDistance computes correctly", () => {
    assert.equal(MathUtils.manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 7);
    assert.equal(MathUtils.manhattanDistance({ x: -2, y: 5 }, { x: 2, y: 2 }), 7);
  });

  it("keyForPosition produces consistent string key", () => {
    assert.equal(MathUtils.keyForPosition({ x: 3, y: 7 }), "3,7");
    assert.equal(MathUtils.keyForPosition({ x: -1, y: 0 }), "-1,0");
  });

  it("positionsEqual is symmetric", () => {
    assert.ok(MathUtils.positionsEqual({ x: 1, y: 2 }, { x: 1, y: 2 }));
    assert.ok(!MathUtils.positionsEqual({ x: 1, y: 2 }, { x: 1, y: 3 }));
  });
});

// ─── Direction ───────────────────────────────────────────────────────────────

describe("Direction", () => {
  it("VECTORS covers 4 cardinal directions", () => {
    assert.ok(Direction.VECTORS["UP"]);
    assert.ok(Direction.VECTORS["DOWN"]);
    assert.ok(Direction.VECTORS["LEFT"]);
    assert.ok(Direction.VECTORS["RIGHT"]);
  });

  it("isOpposite returns true for opposite pairs", () => {
    assert.ok(Direction.isOpposite("UP", "DOWN"));
    assert.ok(Direction.isOpposite("LEFT", "RIGHT"));
    assert.ok(!Direction.isOpposite("UP", "LEFT"));
  });

  it("fromKey maps arrow keys", () => {
    assert.equal(Direction.fromKey("ArrowUp"),    "UP");
    assert.equal(Direction.fromKey("ArrowDown"),  "DOWN");
    assert.equal(Direction.fromKey("ArrowLeft"),  "LEFT");
    assert.equal(Direction.fromKey("ArrowRight"), "RIGHT");
  });

  it("fromKey maps WASD", () => {
    assert.equal(Direction.fromKey("w"), "UP");
    assert.equal(Direction.fromKey("s"), "DOWN");
    assert.equal(Direction.fromKey("a"), "LEFT");
    assert.equal(Direction.fromKey("d"), "RIGHT");
  });

  it("opposite returns reverse", () => {
    assert.equal(Direction.opposite("UP"),    "DOWN");
    assert.equal(Direction.opposite("LEFT"),  "RIGHT");
  });
});

// ─── EventEmitter ────────────────────────────────────────────────────────────

describe("EventEmitter", () => {
  it("on + emit fires listener", () => {
    const ee = new EventEmitter();
    const calls = [];
    ee.on("foo", v => calls.push(v));
    ee.emit("foo", 42);
    assert.deepEqual(calls, [42]);
  });

  it("once fires only once", () => {
    const ee = new EventEmitter();
    const calls = [];
    ee.once("bar", v => calls.push(v));
    ee.emit("bar", 1);
    ee.emit("bar", 2);
    assert.deepEqual(calls, [1]);
  });

  it("off removes listener", () => {
    const ee = new EventEmitter();
    const calls = [];
    const fn = v => calls.push(v);
    ee.on("ev", fn);
    ee.off("ev", fn);
    ee.emit("ev", 99);
    assert.deepEqual(calls, []);
  });

  it("on returns unsubscribe function", () => {
    const ee = new EventEmitter();
    const calls = [];
    const unsub = ee.on("ev", v => calls.push(v));
    unsub();
    ee.emit("ev", 1);
    assert.deepEqual(calls, []);
  });
});

// ─── KonamiTracker ───────────────────────────────────────────────────────────

describe("KonamiTracker", () => {
  function playSequence(tracker, keys) {
    for (const key of keys) tracker.consumeKey(key);
  }

  it("reports progress correctly", () => {
    const t = new KonamiTracker();
    t.consumeKey("ArrowUp");
    assert.equal(t.progress, 1);
  });

  it("returns true when full sequence entered", () => {
    const t = new KonamiTracker();
    const seq = KonamiTracker.DEFAULT_SEQUENCE;
    let fired = false;
    for (let i = 0; i < seq.length - 1; i++) t.consumeKey(seq[i]);
    fired = t.consumeKey(seq[seq.length - 1]);
    assert.ok(fired, "should return true on completion");
    assert.equal(t.progress, 0, "resets after completion");
  });

  it("resets on wrong key", () => {
    const t = new KonamiTracker();
    t.consumeKey("ArrowUp");
    t.consumeKey("ArrowUp");
    t.consumeKey("B");  // valid token but wrong position (expected DOWN)
    assert.equal(t.progress, 0);
  });
});

// ─── StaminaSystem ───────────────────────────────────────────────────────────

describe("StaminaSystem", () => {
  const baseSouls = { powers: {} };

  it("create returns stamina at max", () => {
    const st = StaminaSystem.create(baseSouls, { current: "max" });
    assert.ok(st.max > 0);
    assert.equal(st.current, st.max);
    assert.equal(st.phase, StaminaSystem.PHASE_READY);
  });

  it("boost exhausts stamina and transitions to EXHAUSTED", () => {
    const souls = { powers: {}, stamina: null };
    souls.stamina = StaminaSystem.create(souls, { current: "max" });
    // DRAIN_PER_SEC=25, max=100 → 4000ms to drain; 6000ms ensures exhaustion
    const drainMs = (souls.stamina.max / StaminaSystem.DRAIN_PER_SEC) * 1000 * 1.5;
    StaminaSystem.update(souls, drainMs, true);
    assert.ok(
      souls.stamina.phase === StaminaSystem.PHASE_EXHAUSTED
      || souls.stamina.current === 0
    );
  });

  it("exhausted stamina recovers over time", () => {
    const souls = { powers: {}, stamina: null };
    souls.stamina = StaminaSystem.create(souls, { current: 0, phase: StaminaSystem.PHASE_EXHAUSTED });
    StaminaSystem.update(souls, 10000, false);
    assert.ok(souls.stamina.current > 0 || souls.stamina.phase === StaminaSystem.PHASE_RECOVERING);
  });
});

// ─── HazardSystem ────────────────────────────────────────────────────────────

describe("HazardSystem", () => {
  it("normalize reduces ttl and removes expired hazards", () => {
    const hazards = [
      { x: 0, y: 0, ttlMs: 100 },
      { x: 1, y: 1, ttlMs: 50  },
    ];
    const result = HazardSystem.normalize(hazards, 80);
    assert.equal(result.length, 1, "expired hazard removed");
    assert.ok(result[0].ttlMs < 100, "ttl reduced");
  });

  it("isHit detects position in hazards", () => {
    const hazards = [{ x: 3, y: 4, ttlMs: 200 }];
    assert.ok(HazardSystem.isHit({ x: 3, y: 4 }, hazards));
    assert.ok(!HazardSystem.isHit({ x: 0, y: 0 }, hazards));
  });
});

// ─── EconomySystem ───────────────────────────────────────────────────────────

describe("EconomySystem", () => {
  const baseSouls = { powers: {}, carriedRunes: 0 };

  it("getMultiplier returns ≥ 1 for base snake", () => {
    const m = EconomySystem.getMultiplier(baseSouls, null);
    assert.ok(m >= 1);
  });

  it("applyGain increases carriedRunes", () => {
    const souls = { ...baseSouls, carriedRunes: 5 };
    EconomySystem.applyGain(souls, 10, null);
    assert.ok(souls.carriedRunes > 5);
  });

  it("canAffordReroll returns false when broke", () => {
    const souls = { ...baseSouls, carriedRunes: 0 };
    assert.ok(!EconomySystem.canAffordReroll(souls));
  });

  it("spendReroll deducts cost", () => {
    const cost = EconomySystem.getRerollCost();
    const souls = { ...baseSouls, carriedRunes: cost + 5 };
    EconomySystem.spendReroll(souls);
    assert.equal(souls.carriedRunes, 5);
  });
});

// ─── EnemyAiSystem ───────────────────────────────────────────────────────────

describe("EnemyAiSystem", () => {
  it("getDirectionOrder returns all valid directions", () => {
    const ai = new EnemyAiSystem();
    const order = ai.getDirectionOrder({ x: 0, y: 0, style: "aggressive" }, { x: 5, y: 5 });
    assert.ok(Array.isArray(order) && order.length > 0);
    assert.ok(order.every(d => EnemyAiSystem.DIR_VECTORS[d]));
  });

  it("hunter boost: normalizing null gives READY", () => {
    const boost = EnemyAiSystem.normalizeHunterBoost(null);
    assert.equal(boost.phase, EnemyAiSystem.HUNTER_PHASE_READY);
  });

  it("hunter boost: advancing cycles through phases", () => {
    let boost = { phase: EnemyAiSystem.HUNTER_PHASE_BOOST, msRemaining: 700 };
    boost = EnemyAiSystem.advanceHunterBoost(boost, 800);
    assert.equal(boost.phase, EnemyAiSystem.HUNTER_PHASE_FATIGUE);
  });

  it("hunter boost cycles all the way back to READY", () => {
    let boost = { phase: EnemyAiSystem.HUNTER_PHASE_BOOST, msRemaining: 700 };
    // advance far past all phases
    boost = EnemyAiSystem.advanceHunterBoost(boost, 700 + 1200 + 5000 + 100);
    assert.equal(boost.phase, EnemyAiSystem.HUNTER_PHASE_READY);
  });

  it("getHunterSpeedMult returns 1 when READY", () => {
    const enemy = { id: "cacador", hunterBoost: { phase: EnemyAiSystem.HUNTER_PHASE_READY, msRemaining: 0 } };
    assert.equal(EnemyAiSystem.getHunterSpeedMult(enemy), 1);
  });

  it("registerStrategy inserts before fallback", () => {
    const ai = new EnemyAiSystem();
    let called = false;
    ai.registerStrategy({
      matches: e => e?.style === "custom",
      getDirectionOrder: () => { called = true; return ["UP"]; },
    });
    ai.getDirectionOrder({ style: "custom", x: 0, y: 0 }, { x: 1, y: 1 });
    assert.ok(called);
  });
});

// ─── ModeFactory ─────────────────────────────────────────────────────────────

describe("ModeFactory", () => {
  it("throws when mode not registered", () => {
    const f = new ModeFactory();
    assert.throws(() => f.create("unknown"), /não reconhecido/);
  });

  it("returns registered builder result", () => {
    const f = new ModeFactory();
    const sentinel = { id: "test", step: () => {} };
    f.register("test", () => sentinel);
    assert.strictEqual(f.create("test"), sentinel);
  });

  it("has() correctly reports registration", () => {
    const f = new ModeFactory();
    f.register("foo", () => null);
    assert.ok(f.has("foo"));
    assert.ok(!f.has("bar"));
  });

  it("registeredModes lists all modes", () => {
    const f = new ModeFactory();
    f.register("a", () => null).register("b", () => null);
    assert.deepEqual(f.registeredModes().sort(), ["a", "b"]);
  });

  it("register is fluent (returns this)", () => {
    const f = new ModeFactory();
    assert.strictEqual(f.register("x", () => null), f);
  });
});
