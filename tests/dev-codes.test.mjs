import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { normalizeDevCode, parseDevCode } = require("../src/dev/dev-codes.js");

test("normalizeDevCode trims and collapses spaces", () => {
  assert.equal(normalizeDevCode("  souls_floor   12  "), "souls_floor 12");
  assert.equal(normalizeDevCode(""), "");
});

test("parseDevCode accepts case-insensitive floor and boss commands", () => {
  const floor = parseDevCode("souls_floor 7");
  assert.equal(floor.ok, true);
  assert.equal(floor.command, "SOULS_FLOOR");
  assert.equal(floor.params.floor, 7);

  const boss = parseDevCode("souls_boss final");
  assert.equal(boss.ok, true);
  assert.equal(boss.command, "SOULS_BOSS");
  assert.equal(boss.params.bossSlot, "FINAL");
});

test("parseDevCode validates screen and rune commands", () => {
  const screen = parseDevCode("screen gameover");
  assert.equal(screen.ok, true);
  assert.equal(screen.params.screen, "GAMEOVER");

  const carried = parseDevCode("RUNAS_CARREGADAS 150");
  assert.equal(carried.ok, true);
  assert.equal(carried.params.runes, 150);

  const wallet = parseDevCode("RUNAS_CARTEIRA 90");
  assert.equal(wallet.ok, true);
  assert.equal(wallet.params.runes, 90);
});

test("parseDevCode accepts no-arg commands", () => {
  const commands = [
    "DESBLOQUEAR_PROXIMA",
    "DESBLOQUEAR_TODAS",
    "RECOMPENSA_AGORA",
    "RESET_PERFIL_SOULS",
  ];

  for (const command of commands) {
    const parsed = parseDevCode(command);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.command, command);
  }
});

test("parseDevCode returns descriptive errors for invalid input", () => {
  assert.equal(parseDevCode("").ok, false);
  assert.equal(parseDevCode("SOULS_FLOOR zero").ok, false);
  assert.equal(parseDevCode("SOULS_BOSS 4").ok, false);
  assert.equal(parseDevCode("SCREEN xyz").ok, false);
  assert.equal(parseDevCode("UNKNOWN_CMD").ok, false);
});
