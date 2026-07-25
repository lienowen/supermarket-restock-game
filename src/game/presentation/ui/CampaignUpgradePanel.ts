import Phaser from "phaser";
import type { CampaignSession } from "../../application/CampaignSession";
import type { MarketUpgradeId, MarketUpgradeOption } from "../../application/MarketUpgrades";

export interface CampaignUpgradePanelConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly session: CampaignSession;
}

interface UpgradeCard {
  readonly optionId: MarketUpgradeId;
  readonly container: Phaser.GameObjects.Container;
  readonly levelText: Phaser.GameObjects.Text;
  readonly costText: Phaser.GameObjects.Text;
  readonly button: Phaser.GameObjects.Rectangle;
}

export class CampaignUpgradePanel {
  readonly container: Phaser.GameObjects.Container;

  private readonly balanceText: Phaser.GameObjects.Text;
  private readonly cards: readonly UpgradeCard[];
  private messageText: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CampaignUpgradePanelConfig
  ) {
    const background = scene.add.graphics();
    background.fillStyle(config.panelColor, 0.98);
    background.fillRoundedRect(-config.width / 2, -78, config.width, 156, 22);
    background.lineStyle(3, config.accentColor, 0.66);
    background.strokeRoundedRect(-config.width / 2, -78, config.width, 156, 22);

    const title = scene.add.text(-config.width / 2 + 22, -59, "STORE UPGRADES", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffd95e",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0, 0.5);

    this.balanceText = scene.add.text(config.width / 2 - 22, -59, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(1, 0.5);

    this.messageText = scene.add.text(0, 65, "Spend coins now. Upgrades affect every following shift.", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#b8d9c4",
      fontStyle: "bold"
    }).setOrigin(0.5);

    const options = config.session.upgradeOptions();
    this.cards = Object.freeze(options.map((option, index) => this.createCard(option, index)));
    this.container = scene.add.container(config.x, config.y, [
      background,
      title,
      this.balanceText,
      ...this.cards.map((card) => card.container),
      this.messageText
    ]).setName("campaign-upgrade-panel");
    this.refresh();
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private createCard(option: MarketUpgradeOption, index: number): UpgradeCard {
    const cardWidth = 174;
    const gap = 12;
    const totalWidth = cardWidth * 3 + gap * 2;
    const x = -totalWidth / 2 + cardWidth / 2 + index * (cardWidth + gap);

    const cardBackground = this.scene.add.rectangle(0, 0, cardWidth, 84, 0xfffbef, 1)
      .setStrokeStyle(2, 0x91b9a0, 0.72);
    const title = this.scene.add.text(0, -27, option.title, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#173b2a",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const description = this.scene.add.text(0, -7, option.description, {
      fontFamily: "Arial",
      fontSize: "9px",
      color: "#52705f",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: cardWidth - 12 }
    }).setOrigin(0.5);
    const levelText = this.scene.add.text(-72, 25, "", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#28563d",
      fontStyle: "bold"
    }).setOrigin(0, 0.5);
    const button = this.scene.add.rectangle(42, 25, 76, 28, 0x2f8a58, 1)
      .setStrokeStyle(2, 0x195a38, 0.86)
      .setInteractive({ useHandCursor: true });
    const costText = this.scene.add.text(42, 25, "", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    button.on("pointerover", () => {
      if (button.input?.enabled) button.setScale(1.05);
    });
    button.on("pointerout", () => button.setScale(1));
    button.on("pointerdown", () => this.purchase(option.id));

    return Object.freeze({
      optionId: option.id,
      container: this.scene.add.container(x, 5, [
        cardBackground,
        title,
        description,
        levelText,
        button,
        costText
      ]),
      levelText,
      costText,
      button
    });
  }

  private purchase(upgradeId: MarketUpgradeId): void {
    const result = this.config.session.purchaseUpgrade(upgradeId);
    if (!result.purchased) {
      this.showMessage(result.reason === "max-level" ? "Upgrade already maxed." : "Not enough coins yet.", true);
      return;
    }
    this.showMessage("Upgrade installed. The next shift is stronger.", false);
    this.refresh();
    this.scene.cameras.main.flash(120, 255, 226, 118, false);
  }

  private refresh(): void {
    const snapshot = this.config.session.snapshot();
    this.balanceText.setText(`${snapshot.coins} COINS`);
    const options = new Map(this.config.session.upgradeOptions().map((option) => [option.id, option]));
    this.cards.forEach((card) => {
      const option = options.get(card.optionId);
      if (!option) return;
      card.levelText.setText(`LV ${option.level}/${option.maxLevel}`);
      if (option.maxed) {
        card.costText.setText("MAX");
        card.button.setFillStyle(0x789487, 0.9).disableInteractive();
        return;
      }
      card.costText.setText(`${option.nextCost ?? 0} C`);
      card.button.setFillStyle(option.affordable ? 0x2f8a58 : 0x789487, 1);
      if (option.affordable) card.button.setInteractive({ useHandCursor: true });
      else card.button.disableInteractive();
    });
  }

  private showMessage(message: string, error: boolean): void {
    this.messageText.setText(message).setColor(error ? "#ffb3a7" : "#b8f2c7");
    this.scene.tweens.killTweensOf(this.messageText);
    this.scene.tweens.add({
      targets: this.messageText,
      alpha: { from: 0.35, to: 1 },
      duration: 180,
      ease: "Sine.Out"
    });
  }
}
