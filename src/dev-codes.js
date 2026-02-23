(function defineDevCodes(global) {
  "use strict";

  function normalizeDevCode(input) {
    if (typeof input !== "string") {
      return "";
    }
    return input.trim().replace(/\s+/g, " ");
  }

  function parseIntegerToken(token) {
    if (typeof token !== "string" || !/^-?\d+$/.test(token)) {
      return null;
    }

    const value = Number(token);
    if (!Number.isFinite(value)) {
      return null;
    }

    return Math.trunc(value);
  }

  function parseDevCode(input) {
    const normalized = normalizeDevCode(input);
    if (!normalized) {
      return {
        ok: false,
        error: "Código vazio.",
        normalized: null,
      };
    }

    const parts = normalized.split(" ");
    const command = parts[0].toUpperCase();
    const args = parts.slice(1);

    function fail(error) {
      return {
        ok: false,
        error,
        normalized,
      };
    }

    function success(params, nextNormalized = normalized) {
      return {
        ok: true,
        command,
        params,
        normalized: nextNormalized,
      };
    }

    if (command === "SOULS_FLOOR") {
      if (args.length !== 1) {
        return fail("Uso: SOULS_FLOOR <n>");
      }

      const floor = parseIntegerToken(args[0]);
      if (floor === null || floor < 1) {
        return fail("SOULS_FLOOR exige um número inteiro >= 1.");
      }

      return success({ floor }, `SOULS_FLOOR ${floor}`);
    }

    if (command === "SOULS_BOSS") {
      if (args.length !== 1) {
        return fail("Uso: SOULS_BOSS <1|2|3|FINAL>");
      }

      const token = args[0].toUpperCase();
      if (token === "FINAL") {
        return success({ bossSlot: "FINAL" }, "SOULS_BOSS FINAL");
      }

      const slot = parseIntegerToken(token);
      if (slot !== 1 && slot !== 2 && slot !== 3) {
        return fail("SOULS_BOSS aceita apenas 1, 2, 3 ou FINAL.");
      }

      return success({ bossSlot: slot }, `SOULS_BOSS ${slot}`);
    }

    if (command === "SCREEN") {
      if (args.length !== 1) {
        return fail("Uso: SCREEN <MENU|PLAYING|GAMEOVER>");
      }

      const screen = args[0].toUpperCase();
      if (screen !== "MENU" && screen !== "PLAYING" && screen !== "GAMEOVER") {
        return fail("SCREEN aceita apenas MENU, PLAYING ou GAMEOVER.");
      }

      return success({ screen }, `SCREEN ${screen}`);
    }

    if (command === "RUNAS_CARREGADAS") {
      if (args.length !== 1) {
        return fail("Uso: RUNAS_CARREGADAS <n>");
      }

      const value = parseIntegerToken(args[0]);
      if (value === null || value < 0) {
        return fail("RUNAS_CARREGADAS exige número inteiro >= 0.");
      }

      return success({ runes: value }, `RUNAS_CARREGADAS ${value}`);
    }

    if (command === "RUNAS_CARTEIRA") {
      if (args.length !== 1) {
        return fail("Uso: RUNAS_CARTEIRA <n>");
      }

      const value = parseIntegerToken(args[0]);
      if (value === null || value < 0) {
        return fail("RUNAS_CARTEIRA exige número inteiro >= 0.");
      }

      return success({ runes: value }, `RUNAS_CARTEIRA ${value}`);
    }

    if (command === "DESBLOQUEAR_PROXIMA") {
      if (args.length > 0) {
        return fail("DESBLOQUEAR_PROXIMA não recebe argumentos.");
      }
      return success({});
    }

    if (command === "DESBLOQUEAR_TODAS") {
      if (args.length > 0) {
        return fail("DESBLOQUEAR_TODAS não recebe argumentos.");
      }
      return success({});
    }

    if (command === "RECOMPENSA_AGORA") {
      if (args.length > 0) {
        return fail("RECOMPENSA_AGORA não recebe argumentos.");
      }
      return success({});
    }

    if (command === "RESET_PERFIL_SOULS") {
      if (args.length > 0) {
        return fail("RESET_PERFIL_SOULS não recebe argumentos.");
      }
      return success({});
    }

    return fail("Código desconhecido.");
  }

  const api = Object.freeze({
    normalizeDevCode,
    parseDevCode,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.DevCodes = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
