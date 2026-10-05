(function defineEasterEggs(global) {
  "use strict";

  const KONAMI_SEQUENCE = Object.freeze([
    "UP",
    "UP",
    "DOWN",
    "DOWN",
    "LEFT",
    "RIGHT",
    "LEFT",
    "RIGHT",
    "B",
    "A",
  ]);

  function normalizeKonamiKey(input) {
    if (typeof input !== "string" || input.length === 0) {
      return null;
    }

    const key = input.length === 1 ? input.toUpperCase() : input;
    const upper = key.toUpperCase();
    if (upper === "UP" || upper === "DOWN" || upper === "LEFT" || upper === "RIGHT") {
      return upper;
    }
    if (key === "ArrowUp") return "UP";
    if (key === "ArrowDown") return "DOWN";
    if (key === "ArrowLeft") return "LEFT";
    if (key === "ArrowRight") return "RIGHT";
    if (key === "B") return "B";
    if (key === "A") return "A";

    return null;
  }

  function advanceSequence(sequence, currentIndex, keyToken) {
    if (!Array.isArray(sequence) || sequence.length === 0) {
      return {
        nextIndex: 0,
        matched: false,
      };
    }

    const expected = sequence[currentIndex];
    if (keyToken === expected) {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= sequence.length) {
        return {
          nextIndex: 0,
          matched: true,
        };
      }

      return {
        nextIndex,
        matched: false,
      };
    }

    return {
      nextIndex: keyToken === sequence[0] ? 1 : 0,
      matched: false,
    };
  }

  function createKonamiTracker(options = {}) {
    const sequence = Array.isArray(options.sequence)
      ? Object.freeze(options.sequence.slice())
      : KONAMI_SEQUENCE;

    let progressIndex = 0;

    return {
      consumeKey(input) {
        const token = normalizeKonamiKey(input);
        if (!token) {
          return false;
        }

        const next = advanceSequence(sequence, progressIndex, token);
        progressIndex = next.nextIndex;
        return next.matched;
      },
      reset() {
        progressIndex = 0;
      },
      getProgress() {
        return progressIndex;
      },
      getSequenceLength() {
        return sequence.length;
      },
    };
  }

  const api = Object.freeze({
    KONAMI_SEQUENCE,
    normalizeKonamiKey,
    advanceSequence,
    createKonamiTracker,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.EasterEggs = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
