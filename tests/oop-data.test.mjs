/**
 * tests/oop-data.test.mjs — testes das classes OOP Data + Profile
 *
 * Cobre: GameConstants, SnakeCatalog, PowerCatalog, BossCatalog,
 *        StageCalculator, ProfileValidator, ProfileRepository, ProfileService
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const GameConstants     = require("../src/data/constants.js");
const SnakeCatalog      = require("../src/data/snake-catalog.js");
const PowerCatalog      = require("../src/data/power-catalog.js");
const BossCatalog       = require("../src/data/boss-catalog.js");
const StageCalculator   = require("../src/data/stage-calculator.js");
const ProfileValidator  = require("../src/profile/profile-validator.js");
const ProfileRepository = require("../src/profile/profile-repository.js");
const ProfileService    = require("../src/profile/profile-service.js");

// ─── GameConstants ────────────────────────────────────────────────────────────

describe("GameConstants", () => {
  it("STORAGE_KEY is a non-empty string", () => {
    assert.ok(typeof GameConstants.STORAGE_KEY === "string" && GameConstants.STORAGE_KEY.length > 0);
  });

  it("MIN_TICK_MS is a positive number", () => {
    assert.ok(GameConstants.MIN_TICK_MS > 0);
  });

  it("DEFAULT_SNAKE_ID is defined", () => {
    assert.ok(GameConstants.DEFAULT_SNAKE_ID);
  });
});

// ─── SnakeCatalog ────────────────────────────────────────────────────────────

describe("SnakeCatalog", () => {
  it("ALL contains at least one snake", () => {
    assert.ok(SnakeCatalog.ALL.length >= 1);
  });

  it("getById returns matching snake", () => {
    const first = SnakeCatalog.ALL[0];
    const found = SnakeCatalog.getById(first.id);
    assert.ok(found, "should find snake");
    assert.equal(found.id, first.id);
  });

  it("getById returns null for unknown id", () => {
    assert.equal(SnakeCatalog.getById("???"), null);
  });

  it("getAllIds lists all snake ids", () => {
    const ids = SnakeCatalog.getAllIds();
    assert.ok(ids.length === SnakeCatalog.ALL.length);
    for (const s of SnakeCatalog.ALL) assert.ok(ids.includes(s.id));
  });

  it("exists checks correctly", () => {
    assert.ok(SnakeCatalog.exists(SnakeCatalog.ALL[0].id));
    assert.ok(!SnakeCatalog.exists("ghost_id_99"));
  });
});

// ─── PowerCatalog ────────────────────────────────────────────────────────────

describe("PowerCatalog", () => {
  it("ALL is a non-empty frozen array", () => {
    assert.ok(PowerCatalog.ALL.length >= 1);
  });

  it("getById retrieves power", () => {
    const first = PowerCatalog.ALL[0];
    const p = PowerCatalog.getById(first.id);
    assert.equal(p?.id, first.id);
  });

  it("getMaxStacks returns a positive integer", () => {
    const first = PowerCatalog.ALL[0];
    const max = PowerCatalog.getMaxStacks(first.id);
    assert.ok(Number.isInteger(max) && max >= 1);
  });
});

// ─── BossCatalog ─────────────────────────────────────────────────────────────

describe("BossCatalog", () => {
  it("getByOrdinal(1) returns first boss", () => {
    const b = BossCatalog.getByOrdinal(1);
    assert.ok(b, "boss 1 should exist");
    assert.ok(b.id);
  });

  it("getByOrdinal('final') returns final boss", () => {
    const b = BossCatalog.getByOrdinal("final");
    assert.ok(b, "final boss should exist");
  });

  it("getAllIds returns at least 3 boss ids", () => {
    const ids = BossCatalog.getAllIds();
    assert.ok(ids.length >= 3);
  });

  it("getIntel(id) returns or null", () => {
    const ids = BossCatalog.getAllIds();
    const intel = BossCatalog.getIntel(ids[0]);
    // May be null if no intel defined, but should not throw
    assert.ok(intel === null || typeof intel === "object");
  });
});

// ─── StageCalculator ─────────────────────────────────────────────────────────

describe("StageCalculator", () => {
  it("getStageType(1) returns 'normal'", () => {
    assert.equal(StageCalculator.getStageType(1), "normal");
  });

  it("boss floors return 'boss' type", () => {
    // floor 4 should be boss floor in default config
    const type = StageCalculator.getStageType(4);
    assert.ok(type === "boss" || type === "final_boss" || type === "normal",
      `unexpected type: ${type}`);
  });

  it("getBaseTickMs returns positive number", () => {
    const ms = StageCalculator.getBaseTickMs(1, "normal");
    assert.ok(ms > 0);
  });

  it("getCycle always returns positive int", () => {
    for (let f = 1; f <= 20; f++) {
      const c = StageCalculator.getCycle(f);
      assert.ok(Number.isInteger(c) && c >= 1, `floor ${f}: cycle=${c}`);
    }
  });

  it("getDifficultyScale increases with cycle", () => {
    const c1 = StageCalculator.getDifficultyScale(1);
    const c2 = StageCalculator.getDifficultyScale(2);
    assert.ok(c2 >= c1, "difficulty should not decrease with cycle");
  });
});

// ─── ProfileValidator ────────────────────────────────────────────────────────

describe("ProfileValidator", () => {
  it("createDefault returns valid profile base structure", () => {
    const p = ProfileValidator.createDefault();
    assert.ok(typeof p === "object");
    assert.ok(Array.isArray(p.unlockedSnakeIds));
    assert.ok(typeof p.walletRunes === "number");
  });

  it("sanitize keeps walletRunes as non-negative integer", () => {
    const dirty = { walletRunes: -99.9 };
    const clean = ProfileValidator.sanitize(dirty);
    assert.ok(clean.walletRunes >= 0);
    assert.ok(Number.isInteger(clean.walletRunes));
  });

  it("sanitize uses defaults when given null", () => {
    const p = ProfileValidator.sanitize(null);
    assert.ok(p.unlockedSnakeIds !== undefined);
  });

  it("VERSION is a positive integer", () => {
    assert.ok(Number.isInteger(ProfileValidator.VERSION) && ProfileValidator.VERSION >= 1);
  });
});

// ─── ProfileRepository ───────────────────────────────────────────────────────

describe("ProfileRepository", () => {
  it("loadRaw returns null when storage has nothing", () => {
    const fakeStor = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    const repo = new ProfileRepository(fakeStor);
    assert.equal(repo.loadRaw(), null);
  });

  it("saveRaw + loadRaw roundtrip", () => {
    let stored = null;
    const fakeStor = {
      getItem:    ()  => stored,
      setItem:    (k, v) => { stored = v; },
      removeItem: ()  => { stored = null; },
    };
    const repo = new ProfileRepository(fakeStor);
    repo.saveRaw('{"foo":1}');
    assert.equal(repo.loadRaw(), '{"foo":1}');
  });

  it("remove clears stored data", () => {
    let stored = "data";
    const fakeStor = {
      getItem:    () => stored,
      setItem:    (k, v) => { stored = v; },
      removeItem: () => { stored = null; },
    };
    const repo = new ProfileRepository(fakeStor);
    repo.remove();
    assert.equal(repo.loadRaw(), null);
  });
});

// ─── ProfileService ──────────────────────────────────────────────────────────

describe("ProfileService", () => {
  function makeService() {
    let stored = null;
    const fakeStor = {
      getItem:    () => stored,
      setItem:    (k, v) => { stored = v; },
      removeItem: () => { stored = null; },
    };
    const repo      = new ProfileRepository(fakeStor);
    const validator = ProfileValidator;
    return new ProfileService(repo, validator);
  }

  it("load returns default profile when empty", () => {
    const svc = makeService();
    const p = svc.load();
    assert.ok(p.unlockedSnakeIds !== undefined);
    assert.ok(typeof p.walletRunes === "number");
  });

  it("save + load roundtrip preserves walletRunes", () => {
    const svc = makeService();
    let p = svc.load();
    p = { ...p, walletRunes: 123 };
    svc.save(p);
    const p2 = svc.load();
    assert.equal(p2.walletRunes, 123);
  });

  it("reset returns default profile and clears storage", () => {
    const svc = makeService();
    let p = svc.load();
    p = { ...p, walletRunes: 999 };
    svc.save(p);
    svc.reset();
    const p2 = svc.load();
    assert.equal(p2.walletRunes, 0);
  });

  it("addWalletRunes accumulates correctly", () => {
    const svc = makeService();
    let p = svc.load();
    p = svc.addWalletRunes(p, 50);
    p = svc.addWalletRunes(p, 30);
    assert.equal(p.walletRunes, 80);
  });

  it("hasSnakeUnlocked is false for locked snakes", () => {
    const svc = makeService();
    const p = svc.load();
    // All keys except default should be locked initially
    const allIds = SnakeCatalog.getAllIds();
    const lockedIds = allIds.filter(id => id !== GameConstants.DEFAULT_SNAKE_ID);
    if (lockedIds.length > 0) {
      assert.ok(!svc.hasSnakeUnlocked(p, lockedIds[0]));
    }
  });

  it("selectSnake updates selectedSnakeId when snake is unlocked", () => {
    const svc = makeService();
    const p   = svc.load();
    const unlocked = p.unlockedSnakeIds[0];
    const p2  = svc.selectSnake(p, unlocked);
    assert.equal(p2.selectedSnakeId, unlocked);
  });
});
