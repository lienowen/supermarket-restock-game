import {
  LevelCompleteOverlay,
  type LevelCompleteOverlayConfig
} from "../ui/LevelCompleteOverlay";

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";
const FIRST_DELIVERY_OVERLAY_DELAY_MS = 1450;

interface LevelCompleteOverlayInternals {
  config: LevelCompleteOverlayConfig;
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const originalShow = LevelCompleteOverlay.prototype.show;

LevelCompleteOverlay.prototype.show = function showAfterLevelOneReward(
  this: LevelCompleteOverlay,
  delayMs = 180
): void {
  if (!isFirstDelivery()) {
    originalShow.call(this, delayMs);
    return;
  }

  const view = this as unknown as LevelCompleteOverlayInternals;
  const rewardLine = view.config.rewardLabel
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) ?? view.config.rewardLabel;

  view.config = {
    ...view.config,
    statusLabel: "FIRST SHIFT COMPLETE",
    levelTitle: "FIRST DELIVERY COMPLETE",
    rewardLabel: `6/6 SHELVES  •  18 BOTTLES\n${rewardLine}`
  };

  document.body.dataset.levelOneCompletionSequence = "reward-then-results";
  originalShow.call(this, Math.max(delayMs, FIRST_DELIVERY_OVERLAY_DELAY_MS));
};
