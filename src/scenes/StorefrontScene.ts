import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";
import type { LevelId } from "../domain/gameTypes";
import { LEVELS } from "../levels/levelConfigs";
import { gameSession } from "../systems/GameSession";
import {
  bestStarsFor,
  clearLastShiftResult,
  peekLastShiftResult,
  totalBestStars,
  type ShiftResult
} from "../systems/StorefrontProgress";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const AUXILIARY_SCENES = ["polish-overlay", "progression-customer", "back-stock"] as const;

type StorefrontData = {
  showResult?: boolean;
};

export class StorefrontScene extends Phaser.Scene {
  private toast?: Phaser.GameObjects.Text;
  private modal?: Phaser.GameObjects.Container;
  private actionLocked = false;

  constructor() {
    super("storefront");
  }

  preload(): void {
    const keys = [
      Assets.storefront.day,
      Assets.storefront.night,
      Assets.storefront.startShift,
      Assets.storefront.days,
      Assets.storefront.upgrades,
      Assets.storefront.store,
      Assets.storefront.collection,
      Assets.storefront.settings,
      Assets.storefront.shiftResultPanel,
      Assets.ui.star,
      Assets.ui.coin
    ] as const;

    keys.forEach((key) => {
      if (!this.textures.exists(key)) this.load.image(key, AssetPaths[key]);
    });
  }

  create(data: StorefrontData = {}): void {
    this.actionLocked = false;
    this.modal = undefined;
    this.toast = undefined;

    AUXILIARY_SCENES.forEach((key) => {
      if (this.scene.isActive(key)) this.scene.stop(key);
    });

    const pendingResult = peekLastShiftResult();
    const showResult = Boolean(data.showResult || pendingResult);

    this.cameras.main.setBackgroundColor("#0b1517");
    this.createBackground(showResult ? Assets.storefront.night : Assets.storefront.day);
    this.createTopHud();

    if (showResult && pendingResult) {
      this.createResultView(pendingResult);
    } else {
      this.createLobbyView();
    }

    this.cameras.main.fadeIn(220, 8, 16, 18);
  }

  private createBackground(texture: string): void {
    const background = this.add.image(665, 591, texture).setDepth(0);
    const sourceWidth = Math.max(1, background.width);
    const sourceHeight = Math.max(1, background.height);
    background.setScale(Math.max(1330 / sourceWidth, 1182 / sourceHeight));

    this.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.14).setDepth(1);
    this.add.rectangle(1045, 615, 570, 1030, 0x071215, 0.18).setDepth(2);
  }

  private createTopHud(): void {
    const totalStars = totalBestStars();
    const storeLevel = Math.min(5, 1 + Math.floor(totalStars / 6));
    const activeDay = this.resolveActiveDay();
    const dayNumber = Number(activeDay.slice(-2));

    this.add.rectangle(665, 58, 1330, 116, 0x0d1719, 0.94)
      .setStrokeStyle(2, 0x384b4e)
      .setDepth(20);

    this.add.text(42, 28, "FRESH MART", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(21);

    this.add.text(42, 72, `STORE LEVEL ${storeLevel}`, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#bfe88a",
      fontStyle: "bold"
    }).setDepth(21);

    this.add.image(850, 58, Assets.ui.star).setDisplaySize(54, 54).setDepth(21);
    this.add.text(888, 37, String(totalStars), {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(21);

    this.add.image(1015, 58, Assets.ui.coin).setDisplaySize(54, 54).setDepth(21);
    this.add.text(1054, 37, String(gameSession.coins), {
      fontFamily: "Arial",
      fontSize: "30px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(21);

    this.add.text(1235, 58, `DAY ${dayNumber}`, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#315f4b",
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setDepth(21);
  }

  private createLobbyView(): void {
    const day = this.resolveActiveDay();
    const level = LEVELS[day];
    const dayNumber = Number(day.slice(-2));
    const bestStars = bestStarsFor(day);

    const card = this.add.rectangle(1010, 330, 520, 380, 0x102025, 0.91)
      .setStrokeStyle(5, 0x78a465)
      .setDepth(10);

    this.add.text(1010, 190, `DAY ${dayNumber} · ${level.title.toUpperCase()}`, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#f7e8a9",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 460 }
    }).setOrigin(0.5).setDepth(11);

    this.add.text(1010, 258, "TODAY'S SHIFT", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9fd0bd",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5).setDepth(11);

    this.add.text(1010, 330, level.objective, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      align: "center",
      lineSpacing: 8,
      wordWrap: { width: 445 }
    }).setOrigin(0.5).setDepth(11);

    this.add.text(1010, 418, [
      `Sales target  ${level.salesTargets.rushToClosing}`,
      `Shift time    ${Math.floor(level.shiftSeconds / 60)}:${String(level.shiftSeconds % 60).padStart(2, "0")}`,
      `Best result   ${"★".repeat(bestStars)}${"☆".repeat(3 - bestStars)}`
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#d8e7df",
      align: "left",
      lineSpacing: 10
    }).setOrigin(0.5, 0).setDepth(11);

    void card;

    this.createImageButton(
      Assets.storefront.startShift,
      1010,
      690,
      500,
      180,
      () => this.startShift(day)
    );

    this.createImageButton(Assets.storefront.days, 855, 865, 280, 105, () => this.openDaySelector());
    this.createImageButton(
      Assets.storefront.upgrades,
      1165,
      865,
      280,
      105,
      () => this.showToast("UPGRADES unlock after the first full progression pass.")
    );
    this.createImageButton(
      Assets.storefront.store,
      855,
      995,
      280,
      105,
      () => this.showToast("STORE expansion arrives with the next department update.")
    );
    this.createImageButton(
      Assets.storefront.collection,
      1165,
      995,
      280,
      105,
      () => this.showToast("COLLECTION will track products, customers and achievements.")
    );
    this.createImageButton(
      Assets.storefront.settings,
      1010,
      1110,
      260,
      92,
      () => this.showToast("SETTINGS: sound, language and save controls are coming next.")
    );
  }

  private createResultView(result: ShiftResult): void {
    const stars = Math.max(0, Math.min(3, result.stars));
    const dayNumber = Number(result.day.slice(-2));

    this.add.text(100, 210, "STORE CLOSED", {
      fontFamily: "Arial",
      fontSize: "48px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#14222a",
      strokeThickness: 8
    }).setDepth(12);

    this.add.text(104, 278, `DAY ${dayNumber} COMPLETE`, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffd98a",
      fontStyle: "bold",
      backgroundColor: "#193144",
      padding: { x: 15, y: 9 }
    }).setDepth(12);

    this.add.text(104, 345, "The doors are closed.\nReview the shift, then prepare the next day.", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#e5eef2",
      lineSpacing: 8,
      wordWrap: { width: 460 }
    }).setDepth(12);

    this.add.image(1005, 625, Assets.storefront.shiftResultPanel)
      .setDisplaySize(610, 650)
      .setDepth(10);

    // The artwork contains decorative sample values. Cover the data area and render
    // the real shift result above it so stars and statistics always stay truthful.
    this.add.rectangle(1005, 570, 500, 390, 0x102536, 0.94)
      .setStrokeStyle(2, 0x496b7f)
      .setDepth(11);

    this.add.text(1005, 405, result.title.toUpperCase(), {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#d7e8f3",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(12);

    this.add.text(1005, 462, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
      fontFamily: "Arial",
      fontSize: "56px",
      color: "#ffcc3f",
      fontStyle: "bold",
      stroke: "#6d4a09",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(12);

    const labels = this.add.text(820, 535, [
      "SALES",
      "MISSED SALES",
      "WRONG STOCK",
      "BEST COMBO",
      "WALLET COINS"
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#b8cad4",
      fontStyle: "bold",
      lineSpacing: 15
    }).setOrigin(0, 0).setDepth(12);

    const values = this.add.text(1190, 535, [
      `${result.soldCount}/${result.salesTarget}`,
      String(result.missedSales),
      String(result.wrongStock),
      `x${result.bestCombo}`,
      String(result.walletCoins)
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "right",
      lineSpacing: 15
    }).setOrigin(1, 0).setDepth(12);

    void labels;
    void values;

    const replay = this.createInvisibleAction(880, 864, 220, 94, () => {
      clearLastShiftResult();
      this.startShift(result.day);
    });
    const continueButton = this.createInvisibleAction(1110, 864, 260, 94, () => {
      const nextDay: LevelId = result.day === "day01" ? "day02" : result.day;
      this.setActiveDay(nextDay);
      clearLastShiftResult();
      this.scene.restart({ showResult: false });
    });

    this.add.text(880, 864, "REPLAY", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#173752",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(14);

    this.add.text(1110, 864, result.day === "day01" ? "CONTINUE" : "BACK TO STORE", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#2a5b19",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(14);

    void replay;
    void continueButton;
  }

  private createImageButton(
    texture: string,
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void
  ): Phaser.GameObjects.Container {
    const image = this.add.image(0, 0, texture).setDisplaySize(width, height);
    const hitPlate = this.add.rectangle(0, 0, width + 30, height + 24, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const container = this.add.container(x, y, [image, hitPlate]).setDepth(15);

    hitPlate.on("pointerover", () => container.setScale(1.025));
    hitPlate.on("pointerout", () => container.setScale(1));
    hitPlate.on("pointerdown", () => {
      container.setScale(0.985);
      action();
    });

    return container;
  }

  private createInvisibleAction(
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void
  ): Phaser.GameObjects.Rectangle {
    const hitPlate = this.add.rectangle(x, y, width, height, 0xffffff, 0.001)
      .setDepth(13)
      .setInteractive({ useHandCursor: true });
    let used = false;
    hitPlate.on("pointerdown", () => {
      if (used) return;
      used = true;
      action();
    });
    return hitPlate;
  }

  private openDaySelector(): void {
    if (this.modal?.active) return;

    const shade = this.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.78)
      .setInteractive()
      .setDepth(100);
    const panel = this.add.rectangle(665, 570, 760, 570, 0x10252a, 0.99)
      .setStrokeStyle(6, 0x78a465)
      .setDepth(101);
    const title = this.add.text(665, 350, "SELECT A SHIFT", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(102);

    const day01 = this.createDayCard("day01", 490, 575);
    const day02 = this.createDayCard("day02", 840, 575);
    const close = this.add.text(665, 795, "CLOSE", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#34454a",
      padding: { x: 32, y: 13 }
    }).setOrigin(0.5).setDepth(102).setInteractive({ useHandCursor: true });

    close.on("pointerdown", () => {
      this.modal?.destroy(true);
      this.modal = undefined;
    });

    this.modal = this.add.container(0, 0, [shade, panel, title, day01, day02, close]).setDepth(100);
  }

  private createDayCard(day: Extract<LevelId, "day01" | "day02">, x: number, y: number): Phaser.GameObjects.Container {
    const level = LEVELS[day];
    const dayNumber = Number(day.slice(-2));
    const stars = bestStarsFor(day);
    const selected = day === this.resolveActiveDay();

    const background = this.add.rectangle(0, 0, 300, 300, selected ? 0x315f4b : 0x20343a, 1)
      .setStrokeStyle(4, selected ? 0xc7e78b : 0x6e858b);
    const dayText = this.add.text(0, -100, `DAY ${dayNumber}`, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#f7e8a9",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const title = this.add.text(0, -48, level.title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 260 }
    }).setOrigin(0.5);
    const starText = this.add.text(0, 20, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffcc3f",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const actionText = this.add.text(0, 102, selected ? "SELECTED" : "SELECT", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: selected ? "#4b7b55" : "#315f7d",
      padding: { x: 22, y: 11 }
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 320, 320, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    const card = this.add.container(x, y, [background, dayText, title, starText, actionText, hit]).setDepth(102);

    hit.on("pointerover", () => card.setScale(1.025));
    hit.on("pointerout", () => card.setScale(1));
    hit.on("pointerdown", () => {
      this.setActiveDay(day);
      this.modal?.destroy(true);
      this.modal = undefined;
      this.scene.restart({ showResult: false });
    });

    return card;
  }

  private showToast(message: string): void {
    this.toast?.destroy();
    const toast = this.add.text(665, 1030, message, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      backgroundColor: "#173238",
      padding: { x: 24, y: 14 },
      wordWrap: { width: 780 }
    }).setOrigin(0.5).setDepth(80).setAlpha(0);

    this.toast = toast;
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: 1010,
      duration: 150,
      yoyo: true,
      hold: 1350,
      onComplete: () => {
        toast.destroy();
        if (this.toast === toast) this.toast = undefined;
      }
    });
  }

  private startShift(day: LevelId): void {
    if (this.actionLocked) return;
    this.actionLocked = true;
    this.setActiveDay(day);
    gameSession.reset(day);
    clearLastShiftResult();
    this.input.enabled = false;
    this.cameras.main.fadeOut(220, 8, 16, 18);
    this.time.delayedCall(230, () => this.scene.start("opening"));
  }

  private resolveActiveDay(): Extract<LevelId, "day01" | "day02"> {
    try {
      return globalThis.localStorage?.getItem(ACTIVE_DAY_KEY) === "day02" ? "day02" : "day01";
    } catch {
      return "day01";
    }
  }

  private setActiveDay(day: LevelId): void {
    const playableDay: Extract<LevelId, "day01" | "day02"> = day === "day02" ? "day02" : "day01";
    try {
      globalThis.localStorage?.setItem(ACTIVE_DAY_KEY, playableDay);
    } catch {
      // GameSession still keeps the active day for this browser session.
    }
    gameSession.setActiveDay(playableDay);
  }
}
