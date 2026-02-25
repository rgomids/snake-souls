(function defineSoulsUiHelpers(global) {
  "use strict";

  function toSafePowerStacks(powersState) {
    return powersState && typeof powersState === "object" ? powersState : {};
  }

  function buildRewardRenderKey(rewardState, powersState) {
    if (!rewardState || typeof rewardState !== "object") {
      return null;
    }

    const options = Array.isArray(rewardState.options) ? rewardState.options : [];
    if (options.length === 0) {
      return null;
    }

    const rerolled = rewardState.rerolled ? 1 : 0;
    const source = typeof rewardState.source === "string" ? rewardState.source : "";
    const safePowers = toSafePowerStacks(powersState);
    const stacks = options.map((powerId) => {
      const raw = safePowers[powerId];
      const stack = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
      return `${powerId}:${stack}`;
    });

    return `${source}|${rerolled}|${options.join(",")}|${stacks.join(",")}`;
  }

  function canSelectReward(modeState) {
    return Boolean(
      modeState &&
        modeState.mode === "souls" &&
        !modeState.isGameOver &&
        modeState.souls &&
        modeState.souls.reward &&
        Array.isArray(modeState.souls.reward.options) &&
        modeState.souls.reward.options.length > 0
    );
  }

  const api = Object.freeze({
    buildRewardRenderKey,
    canSelectReward,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.SoulsUiHelpers = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
