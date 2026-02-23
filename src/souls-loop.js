(function defineSoulsLoop(global) {
  "use strict";

  function calculateFixedSteps(options = {}) {
    const accumulatorMs = Math.max(0, options.accumulatorMs ?? 0);
    const deltaMs = Math.max(0, options.deltaMs ?? 0);
    const fixedStepMs = Math.max(0.0001, options.fixedStepMs ?? 16.6667);
    const maxStepsPerFrame = Math.max(1, options.maxStepsPerFrame ?? 5);

    const total = accumulatorMs + deltaMs;
    const requestedSteps = Math.floor(total / fixedStepMs);
    const steps = Math.min(maxStepsPerFrame, requestedSteps);
    const rawRemainingMs = total - steps * fixedStepMs;
    const maxAccumulatorMs = fixedStepMs * maxStepsPerFrame;
    const accumulatorAfterMs = Math.min(rawRemainingMs, maxAccumulatorMs);

    return {
      steps,
      accumulatorAfterMs,
      requestedSteps,
    };
  }

  const api = Object.freeze({
    calculateFixedSteps,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SoulsLoop = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
