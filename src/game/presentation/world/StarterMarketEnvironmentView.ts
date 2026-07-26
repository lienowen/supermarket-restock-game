import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveCoolerStockSlots } from "../visual/CoolerStockLayout";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { MarketLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

/**
 * Owns the fixed supermarket shell only. Gameplay fixtures, actors and targets
 * are layered by their dedicated views so the environment remains one coherent
 * place instead of a collage of oversized departments.
 */
export class StarterMarketEnvironmentView {
  private readonly visualPreset: MarketLevelVisualPreset;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
  }

  create(): void {
    this.createBase();
    this.createFloor();
    this.createRestockEmptyCooler();
    this.registerSharedFixtureAvailability();
    this.createModeFocus();
    this.createAtmosphere();
  }

  private createBase(): void {
    const { scene, context } = this;
    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      context.levelAssets.environment.key
    )
      .setOrigin(0.5)
      .setDisplaySize(context.world.width, context.world.height)
      .setFlipX(context.mode === "restock")
      .setDepth(-30)
      .setName("commercial-supermarket-salesfloor");
  }

  private createFloor(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height - 18,
      context.world.width,
      36,
      0x10201b,
      0.08
    ).setDepth(-29);
  }

  /**
   * The sales-floor background contains a photographed drinks wall whose stock
   * is baked into the image. Restock mode covers that whole wall segment with
   * one opaque cooler fixture. Two central glass doors are the playable bays;
   * sealed service panels at both sides prevent any background merchandise from
   * leaking around the empty 0/3 task shelves.
   */
  private createRestockEmptyCooler(): void {
    if (this.context.mode !== "restock") {
      document.body.dataset.restockCoolerBackground = "not-applicable";
      return;
    }

    const slots = resolveCoolerStockSlots(this.context.world.beverageCooler.x);
    const xs = slots.map((slot) => slot.x);
    const ys = slots.map((slot) => slot.y);
    const worldRight = this.context.world.width - 2;
    const left = Math.max(0, Math.min(...xs) - 135);
    const right = Math.min(worldRight, Math.max(...xs) + 108);
    const top = Math.min(...ys) - 82;
    const bottom = Math.max(...ys) + 86;
    const width = right - left;
    const height = bottom - top;
    const centreX = left + width / 2;
    const headerHeight = 48;
    const baseHeight = 54;
    const doorTop = top + headerHeight + 8;
    const doorBottom = bottom - baseHeight - 7;
    const doorHeight = doorBottom - doorTop;
    const doorWidth = 80;
    const firstDoorLeft = Math.min(...xs) - doorWidth / 2;
    const lastDoorRight = Math.max(...xs) + doorWidth / 2;

    const shell = this.scene.add.graphics()
      .setDepth(3)
      .setName("beverage-cooler-empty-shell")
      .setData("background-stock-occluded", true)
      .setData("occluded-wall-bounds", { left, right, top, bottom });

    shell.fillStyle(0x080d0b, 1);
    shell.fillRoundedRect(left, top, width, height, 12);
    shell.lineStyle(4, 0x303a36, 1);
    shell.strokeRoundedRect(left, top, width, height, 12);

    shell.fillStyle(0x315f38, 1);
    shell.fillRoundedRect(left + 6, top + 6, width - 12, headerHeight - 6, 8);
    shell.lineStyle(2, 0x78a780, 0.72);
    shell.strokeRoundedRect(left + 6, top + 6, width - 12, headerHeight - 6, 8);

    this.drawCoolerServicePanel(shell, {
      left: left + 7,
      right: firstDoorLeft - 7,
      top: doorTop,
      bottom: doorBottom,
      label: "COLD\nSTORAGE"
    });
    this.drawCoolerServicePanel(shell, {
      left: lastDoorRight + 7,
      right: right - 7,
      top: doorTop,
      bottom: doorBottom,
      label: "SERVICE"
    });

    const bayIndexes = [...new Set(slots.map((slot) => slot.bayIndex))];
    bayIndexes.forEach((bayIndex) => {
      const baySlots = slots.filter((slot) => slot.bayIndex === bayIndex);
      const firstSlot = baySlots[0];
      if (!firstSlot) return;

      const doorLeft = firstSlot.x - doorWidth / 2;
      shell.fillStyle(0x06110d, 1);
      shell.fillRoundedRect(doorLeft, doorTop, doorWidth, doorHeight, 7);
      shell.lineStyle(3, 0x303b37, 1);
      shell.strokeRoundedRect(doorLeft, doorTop, doorWidth, doorHeight, 7);
      shell.lineStyle(1, 0xa9c2b7, 0.22);
      shell.strokeRoundedRect(doorLeft + 5, doorTop + 5, doorWidth - 10, doorHeight - 10, 5);

      shell.fillStyle(0xa9d6c5, 0.045);
      shell.fillRoundedRect(doorLeft + 8, doorTop + 8, 13, doorHeight - 16, 4);

      shell.lineStyle(3, 0xc6d5cf, 0.48);
      baySlots.forEach((slot) => {
        const shelfY = slot.y + 30;
        shell.lineBetween(doorLeft + 7, shelfY, doorLeft + doorWidth - 7, shelfY);
      });
    });

    shell.fillStyle(0x111815, 1);
    shell.fillRoundedRect(left + 7, bottom - baseHeight, width - 14, baseHeight - 7, 7);
    shell.lineStyle(2, 0x2b3531, 1);
    shell.strokeRoundedRect(left + 7, bottom - baseHeight, width - 14, baseHeight - 7, 7);
    shell.lineStyle(2, 0x39443f, 0.85);
    for (let y = bottom - baseHeight + 11; y < bottom - 13; y += 8) {
      shell.lineBetween(left + 18, y, right - 18, y);
    }

    this.scene.add.text(centreX, top + 20, "BEVERAGES", {
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#ffffff"
    })
      .setOrigin(0.5)
      .setDepth(4)
      .setName("beverage-cooler-empty-header");

    this.scene.add.text(centreX, top + 36, "RESTOCK ZONE", {
      fontFamily: "Arial, sans-serif",
      fontSize: "8px",
      fontStyle: "bold",
      color: "#cfe7d8"
    })
      .setOrigin(0.5)
      .setDepth(4)
      .setName("beverage-cooler-empty-subtitle");

    document.body.dataset.restockCoolerBackground = "occluded";
  }

  private drawCoolerServicePanel(
    shell: Phaser.GameObjects.Graphics,
    bounds: {
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
      readonly label: string;
    }
  ): void {
    const width = Math.max(0, bounds.right - bounds.left);
    const height = Math.max(0, bounds.bottom - bounds.top);
    if (width < 18 || height < 18) return;

    shell.fillStyle(0x101815, 1);
    shell.fillRoundedRect(bounds.left, bounds.top, width, height, 7);
    shell.lineStyle(2, 0x2f3a35, 1);
    shell.strokeRoundedRect(bounds.left, bounds.top, width, height, 7);

    const insetLeft = bounds.left + 8;
    const insetRight = bounds.right - 8;
    shell.lineStyle(2, 0x35423d, 0.72);
    for (let y = bounds.top + 20; y < bounds.bottom - 18; y += 11) {
      shell.lineBetween(insetLeft, y, insetRight, y);
    }

    this.scene.add.text(
      bounds.left + width / 2,
      bounds.top + height / 2,
      bounds.label,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: width < 62 ? "7px" : "9px",
        fontStyle: "bold",
        align: "center",
        color: "#71847b"
      }
    )
      .setOrigin(0.5)
      .setDepth(4);
  }

  private registerSharedFixtureAvailability(): void {
    // These production fixtures stay registered for task-specific views, but
    // are deliberately not enlarged into the shared background composition.
    ["fixture-backroom-rack-a", "fixture-produce-display-a"].forEach((key) => {
      this.scene.textures.exists(key);
    });
  }

  private createModeFocus(): void {
    const { focus, focusSize } = this.visualPreset.environment;
    const accent = this.context.mode === "checkout"
      ? this.context.palette.greenBright
      : this.context.palette.gold;
    const glow = this.scene.add.ellipse(
      focus.x,
      focus.y + 36,
      focusSize.width * 0.72,
      focusSize.height * 0.34,
      accent,
      this.context.mode === "restock" ? 0.026 : 0.035
    ).setDepth(7);
    glow.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0xffe8bf,
      0.012
    ).setDepth(80);

    const alpha = Math.min(0.12, this.visualPreset.environment.vignetteAlpha * 0.42);
    scene.add.rectangle(6, context.world.height / 2, 12, context.world.height, 0x07110e, alpha).setDepth(81);
    scene.add.rectangle(
      context.world.width - 6,
      context.world.height / 2,
      12,
      context.world.height,
      0x07110e,
      alpha
    ).setDepth(81);
    scene.add.rectangle(
      context.world.width / 2,
      6,
      context.world.width,
      12,
      0x07110e,
      alpha * 0.7
    ).setDepth(81);
  }
}
