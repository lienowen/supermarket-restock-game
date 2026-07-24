import Phaser from "phaser";
import type { VisualSize } from "../visual/StarterMarketVisualSpec";
import type { FindItemsLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

interface OrderTicketSlot {
  readonly productId: string;
  readonly card: Phaser.GameObjects.Graphics;
  readonly image: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text;
  readonly checkBadge: Phaser.GameObjects.Arc;
  readonly check: Phaser.GameObjects.Text;
  readonly baseScaleX: number;
  readonly baseScaleY: number;
}

export interface OrderTicketViewConfig {
  readonly productIds: readonly string[];
  readonly itemAssetKeys: readonly string[];
  readonly itemSizes: Readonly<Record<string, VisualSize>>;
  readonly visual: FindItemsLevelVisualPreset["orderTicket"];
  readonly panelColor: number;
  readonly accentColor: number;
}

/** A reusable, data-driven order summary for player-driven find-items activities. */
export class OrderTicketView {
  private container?: Phaser.GameObjects.Container;
  private counter?: Phaser.GameObjects.Text;
  private readonly slots: OrderTicketSlot[] = [];
  private previousCompleted = new Set<string>();
  private previousCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: OrderTicketViewConfig
  ) {}

  create(): void {
    if (this.container) return;
    const { scene, config } = this;
    const { centre, size, slotSize, itemGap } = config.visual;

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x13251d, 0.3);
    shadow.fillRoundedRect(
      -size.width / 2 + 6,
      -size.height / 2 + 8,
      size.width,
      size.height,
      20
    );

    const panel = scene.add.graphics();
    panel.fillStyle(0xf9f4df, 0.98);
    panel.fillRoundedRect(-size.width / 2, -size.height / 2, size.width, size.height, 20);
    panel.lineStyle(4, 0x2f7d4d, 0.96);
    panel.strokeRoundedRect(-size.width / 2, -size.height / 2, size.width, size.height, 20);
    panel.fillStyle(config.panelColor, 1);
    panel.fillRoundedRect(-size.width / 2, -size.height / 2, size.width, 34, {
      tl: 20,
      tr: 20,
      bl: 0,
      br: 0
    });

    const title = scene.add.text(-size.width / 2 + 20, -size.height / 2 + 17, "ORDER LIST", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0, 0.5);

    this.counter = scene.add.text(size.width / 2 - 20, -size.height / 2 + 17, `0/${config.productIds.length}`, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffd95e",
      fontStyle: "bold"
    }).setOrigin(1, 0.5);

    const objects: Phaser.GameObjects.GameObject[] = [shadow, panel, title, this.counter];
    const startX = -((config.productIds.length - 1) * itemGap) / 2;
    const slotY = 27;

    config.productIds.forEach((productId, index) => {
      const assetKey = config.itemAssetKeys[index];
      if (!assetKey) throw new Error(`Order ticket is missing an asset for ${productId}`);
      const sourceSize = config.itemSizes[productId];
      if (!sourceSize) throw new Error(`Order ticket is missing dimensions for ${productId}`);

      const x = startX + index * itemGap;
      const card = scene.add.graphics();
      const imageSize = this.fitSize(sourceSize, config.visual.iconMaxSize);
      const image = scene.add.image(x, slotY - 10, assetKey)
        .setDisplaySize(imageSize.width, imageSize.height);
      const label = scene.add.text(
        x,
        slotY + slotSize.height / 2 - 13,
        this.productLabel(productId),
        {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#234f35",
          fontStyle: "bold",
          align: "center",
          wordWrap: { width: slotSize.width - 18 }
        }
      ).setOrigin(0.5);
      const checkBadge = scene.add.circle(
        x + slotSize.width / 2 - 11,
        slotY - slotSize.height / 2 + 11,
        12,
        0x42a866,
        1
      ).setStrokeStyle(2, 0xffffff, 0.88).setVisible(false);
      const check = scene.add.text(checkBadge.x, checkBadge.y - 1, "✓", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold"
      }).setOrigin(0.5).setVisible(false);

      const slot: OrderTicketSlot = {
        productId,
        card,
        image,
        label,
        checkBadge,
        check,
        baseScaleX: image.scaleX,
        baseScaleY: image.scaleY
      };
      this.slots.push(slot);
      objects.push(card, image, label, checkBadge, check);
    });

    this.container = scene.add.container(centre.x, centre.y, objects)
      .setDepth(18)
      .setName("find-items-order-ticket");
    this.sync([], false);
  }

  sync(completedProductIds: readonly string[], animate = true): void {
    if (!this.container || !this.counter) return;
    const completed = new Set(completedProductIds);
    const completedCount = Phaser.Math.Clamp(completed.size, 0, this.slots.length);
    this.counter.setText(`${completedCount}/${this.slots.length}`);

    this.slots.forEach((slot, index) => {
      const isCompleted = completed.has(slot.productId);
      this.drawSlot(slot.card, index, isCompleted);
      slot.checkBadge.setVisible(isCompleted);
      slot.check.setVisible(isCompleted);
      slot.label.setColor(isCompleted ? "#5d7867" : "#234f35");
      slot.image.setAlpha(isCompleted ? 0.35 : 1);
      slot.image.setScale(slot.baseScaleX, slot.baseScaleY);

      if (animate && isCompleted && !this.previousCompleted.has(slot.productId)) {
        slot.checkBadge.setScale(0.2);
        slot.check.setScale(0.2);
        slot.image.setScale(slot.baseScaleX * 1.12, slot.baseScaleY * 1.12);
        this.scene.tweens.add({
          targets: [slot.checkBadge, slot.check],
          scaleX: 1,
          scaleY: 1,
          duration: 260,
          ease: "Back.Out"
        });
        this.scene.tweens.add({
          targets: slot.image,
          scaleX: slot.baseScaleX,
          scaleY: slot.baseScaleY,
          duration: 220,
          ease: "Back.Out"
        });
      }
    });

    if (animate && completedCount !== this.previousCount) {
      this.scene.tweens.add({
        targets: this.counter,
        scaleX: 1.18,
        scaleY: 1.18,
        yoyo: true,
        duration: 150,
        ease: "Sine.Out"
      });
    }
    this.previousCompleted = completed;
    this.previousCount = completedCount;
  }

  destroy(): void {
    this.container?.destroy(true);
    this.container = undefined;
    this.counter = undefined;
    this.slots.length = 0;
    this.previousCompleted.clear();
  }

  private drawSlot(
    card: Phaser.GameObjects.Graphics,
    index: number,
    completed: boolean
  ): void {
    const { slotSize, itemGap } = this.config.visual;
    const x = -((this.slots.length - 1) * itemGap) / 2 + index * itemGap;
    const y = 27;
    card.clear();
    card.fillStyle(completed ? 0xdfece2 : 0xfff3c4, completed ? 0.75 : 0.96);
    card.fillRoundedRect(
      x - slotSize.width / 2,
      y - slotSize.height / 2,
      slotSize.width,
      slotSize.height,
      12
    );
    card.lineStyle(2, completed ? 0x9cb2a2 : this.config.accentColor, completed ? 0.55 : 0.9);
    card.strokeRoundedRect(
      x - slotSize.width / 2,
      y - slotSize.height / 2,
      slotSize.width,
      slotSize.height,
      12
    );
  }

  private fitSize(source: VisualSize, maximum: VisualSize): VisualSize {
    const scale = Math.min(maximum.width / source.width, maximum.height / source.height);
    return Object.freeze({
      width: Math.max(1, source.width * scale),
      height: Math.max(1, source.height * scale)
    });
  }

  private productLabel(productId: string): string {
    return productId
      .replace(/-bottle$/, "")
      .replace(/-box$/, "")
      .replace(/-/g, " ")
      .toUpperCase();
  }
}
