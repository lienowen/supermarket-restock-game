import Phaser from "phaser";
import {
  ShiftHud,
  type ShiftHudCopy,
  type ShiftHudSnapshot
} from "./ShiftHud";

interface ShiftHudInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly dayLabel: string;
    readonly timeLabel: string;
  };
}

interface CompactHudState {
  readonly container: Phaser.GameObjects.Container;
  readonly economy: Phaser.GameObjects.Text;
  compactActivated: boolean;
}

const states = new WeakMap<ShiftHud, CompactHudState>();
const originalUpdate = ShiftHud.prototype.update;

/**
 * Mature routed restock keeps the tutorial/action HUD while the player learns
 * collect/load/push/open. Once the shelf interaction starts, that large chrome
 * becomes redundant with RestockRushMeter. At that point it hands off to one
 * compact status strip and leaves the store world readable.
 */
ShiftHud.prototype.update = function updateMatureRestockHud(
  this: ShiftHud,
  snapshot: ShiftHudSnapshot,
  copy: ShiftHudCopy
): void {
  originalUpdate.call(this, snapshot, copy);
  if (document.body.dataset.restockActorControl !== "routed-world-action-chain") return;

  const view = this as unknown as ShiftHudInternals;
  const state = states.get(this) ?? createCompactHud(view);
  if (!states.has(this)) states.set(this, state);

  if (snapshot.step === "restock") {
    if (!state.compactActivated) {
      hideLegacyShiftHud(view.scene);
      hideRedundantShelfRule(view.scene);
      handOffChecklist();
      state.compactActivated = true;
    }
    state.economy.setText(`★ ${snapshot.stars}    COINS ${snapshot.coins}`);
    state.container.setVisible(true);
    document.body.dataset.matureRestockHud = "compact-v1";
    return;
  }

  if (state.compactActivated) {
    state.container.setVisible(snapshot.step !== "complete");
  }
};

function createCompactHud(view: ShiftHudInternals): CompactHudState {
  const scene = view.scene;
  const panel = scene.add.graphics();
  panel.fillStyle(0x0a1812, 0.9);
  panel.fillRoundedRect(0, 0, 390, 48, 16);
  panel.lineStyle(1, 0xffffff, 0.1);
  panel.strokeRoundedRect(0, 0, 390, 48, 16);

  const shift = scene.add.text(18, 13, `${view.config.dayLabel}  ·  ${view.config.timeLabel}`, {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#ffffff",
    fontStyle: "bold"
  });

  const economy = scene.add.text(370, 13, "★ 0    COINS 0", {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#ffd95e",
    fontStyle: "bold",
    align: "right"
  }).setOrigin(1, 0);

  const container = scene.add.container(22, 18, [panel, shift, economy])
    .setDepth(118)
    .setScrollFactor(0)
    .setVisible(false)
    .setName("mature-restock-hud");

  return { container, economy, compactActivated: false };
}

function hideLegacyShiftHud(scene: Phaser.Scene): void {
  scene.children.getChildren().forEach((gameObject) => {
    const display = gameObject as Phaser.GameObjects.GameObject & {
      depth?: number;
      setVisible?: (visible: boolean) => unknown;
      disableInteractive?: () => unknown;
    };
    const depth = display.depth ?? -1;
    if (depth < 99 || depth > 105) return;
    display.setVisible?.(false);
    display.disableInteractive?.();
  });
}

function hideRedundantShelfRule(scene: Phaser.Scene): void {
  const rule = scene.children.getByName("restock-cooler-shelf-rule") as Phaser.GameObjects.GameObject & {
    setVisible?: (visible: boolean) => unknown;
  } | null;
  rule?.setVisible?.(false);
  document.body.dataset.matureRestockShelfRule = "hidden";
}

function handOffChecklist(): void {
  const checklist = document.getElementById("level-checklist");
  if (!checklist) return;
  checklist.style.opacity = "0";
  checklist.style.transform = "translateX(-8px)";
  checklist.style.visibility = "hidden";
  document.body.dataset.levelChecklist = "handoff";
}
