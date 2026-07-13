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
      Assets.ui.workerAvatar,
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

    this.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.08).setDepth(1);
    this.add.rectangle(665, 1125, 1330, 115, 0x071215, 0.45).setDepth(2);
  }

  private createTopHud(): void {
    const totalStars = totalBestStars();
    const storeLevel = Math.min(5, 1 + Math.floor(totalStars / 6));
    const activeDay = this.resolveActiveDay();
    const dayNumber = Number(activeDay.slice(-2));

    this.add.rectangle(665, 58, 1330, 116, 0x0d1719, 0.94)
      .setStrokeStyle(2, 0x384b4e)
      .setDepth(20);

    this.add.text(42, 24, "FRESH MART", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(21);

    this.add.text(42, 72, `STORE LEVEL ${storeLevel} · OPENING TEAM`, {
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
    const completed = bestStars > 0;

    this.add.text(70, 160, "STORE ENTRANCE", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d9efdf",
      fontStyle: "bold",
      letterSpacing: 3,
      backgroundColor: "#173238",
      padding: { x: 16, y: 9 }
    }).setDepth(10);

    this.add.rectangle(310, 390, 510, 410, 0x0b1719, 0.88)
      .setStrokeStyle(4, 0x73906f, 0.95)
      .setDepth(9);

    this.add.text(310, 220, `DAY ${dayNumber} · ${level.title.toUpperCase()}`, {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#f7e8a9",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 455 }
    }).setOrigin(0.5).setDepth(11);

    const avatar = this.add.image(155, 425, Assets.ui.workerAvatar)
      .setOrigin(0.5)
      .setDepth(11);
    const avatarScale = Math.min(145 / Math.max(1, avatar.width), 190 / Math.max(1, avatar.height));
    avatar.setScale(avatarScale);

    this.add.text(255, 295, "TODAY'S OPERATIONS", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#9fd0bd",
      fontStyle: "bold",
      letterSpacing: 2
    }).setDepth(11);

    this.add.text(255, 335, level.objective, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      lineSpacing: 8,
      wordWrap: { width: 285 }
    }).setDepth(11);

    this.add.text(255, 455, [
      `Sales target   ${level.salesTargets.rushToClosing}`,
      `Shift time     ${Math.floor(level.shiftSeconds / 60)}:${String(level.shiftSeconds % 60).padStart(2, "0")}`,
      `Best result    ${"★".repeat(bestStars)}${"☆".repeat(3 - bestStars)}`
    ].join("\n"), {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#d8e7df",
      lineSpacing: 12
    }).setDepth(11);

    this.add.text(310, 565, completed
      ? "REPLAY SHIFT · CONTRACTS AND SURPRISE DUTIES ACTIVE"
      : day === "day01"
        ? "NEW EMPLOYEE SHIFT · COMPLETE THE FULL OPENING ROUTINE"
        : "NEW DEPARTMENT SHIFT · KEEP BOTH STORE AREAS SUPPLIED", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: completed ? "#bfe88a" : "#ffd98a",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 455 }
    }).setOrigin(0.5).setDepth(11);

    this.add.rectangle(965, 700, 470, 280, 0x0b1719, 0.76)
      .setStrokeStyle(3, 0x8eb48d, 0.75)
      .setDepth(9);
    this.add.text(965, 620, "STAFF ENTRANCE", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(11);
    this.add.text(965, 668, "Clock in, receive stock and prepare the sales floor.", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d6e7df",
      align: "center",
      wordWrap: { width: 410 }
    }).setOrigin(0.5).setDepth(11);

    this.createTextButton(965, 770, 400, 96, `START DAY ${dayNumber}`, 0x4f8b4c, () => this.startShift(day));

    const menuY = 1080;
    this.createUtilityButton(180, menuY, "SHIFTS", () => this.openDaySelector());
    this.createUtilityButton(415, menuY, "UPGRADES", () => this.showToast("Upgrade delivery handling and store operations after completing shifts."));
    this.createUtilityButton(650, menuY, "STORE", () => this.showToast("Store expansion is earned through department progression."));
    this.createUtilityButton(885, menuY, "COLLECTION", () => this.showToast("Collection tracks products, customers and achievements."));
    this.createUtilityButton(1120, menuY, "SETTINGS", () => this.showToast("Settings contains sound, language and save controls."));
  }

  private createResultView(result: ShiftResult): void {
    const stars = Math.max(0, Math.min(3, result.stars));
    const dayNumber = Number(result.day.slice(-2));
    const nextDay: LevelId = result.day === "day01" ? "day02" : result.day === "day02" ? "day03" : "day03";
    const continueLabel = result.day === "day03" ? "BACK TO STORE" : `CONTINUE TO DAY ${Number(nextDay.slice(-2))}`;
    const progressionTitle = result.day === "day01"
      ? "PROMOTION WING UNLOCKED"
      : result.day === "day02"
        ? "SHIFT SUPERVISOR UNLOCKED"
        : "CORE TRAINING COMPLETE";
    const progressionDetail = result.day === "day01"
      ? "Day 2 adds shared reserve stock, a second room, checkout and customer service."
      : result.day === "day02"
        ? "Day 3 adds inspections, service decisions, rush control and equipment recovery."
        : "Replay contracts, improve stars and build a stronger store record.";

    this.add.rectangle(665, 620, 980, 850, 0x0b1719, 0.96)
      .setStrokeStyle(5, 0x6f916f, 0.95)
      .setDepth(10);

    this.add.text(665, 215, "SHIFT COMPLETE", {
      fontFamily: "Arial",
      fontSize: "46px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#14222a",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(12);

    this.add.text(665, 275, `DAY ${dayNumber} · ${result.title.toUpperCase()}`, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#f7e8a9",
      fontStyle: "bold",
      backgroundColor: "#193144",
      padding: { x: 18, y: 9 }
    }).setOrigin(0.5).setDepth(12);

    this.add.text(665, 350, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
      fontFamily: "Arial",
      fontSize: "62px",
      color: "#ffcc3f",
      fontStyle: "bold",
      stroke: "#6d4a09",
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(12);

    this.add.rectangle(665, 580, 760, 330, 0x102536, 0.94)
      .setStrokeStyle(2, 0x496b7f)
      .setDepth(11);

    const rows = [
      ["SALES", `${result.soldCount}/${result.salesTarget}`],
      ["SATISFIED", String(result.satisfiedCustomers ?? 0)],
      ["MISSED SALES", String(result.missedSales)],
      ["WRONG STOCK", String(result.wrongStock)],
      ["BEST COMBO", `x${result.bestCombo}`],
      ["WALLET COINS", String(result.walletCoins)]
    ];

    rows.forEach(([label, value], index) => {
      const y = 455 + index * 47;
      this.add.text(360, y, label, {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#b8cad4",
        fontStyle: "bold"
      }).setDepth(12);
      this.add.text(970, y, value, {
        fontFamily: "Arial",
        fontSize: "21px",
        color: "#ffffff",
        fontStyle: "bold"
      }).setOrigin(1, 0).setDepth(12);
    });

    this.add.rectangle(665, 810, 760, 125, 0x17382b, 0.96)
      .setStrokeStyle(3, 0x9bd58f)
      .setDepth(11);
    this.add.text(665, 782, progressionTitle, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#d9f4ad",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(12);
    this.add.text(665, 830, progressionDetail, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d7e6df",
      align: "center",
      wordWrap: { width: 700 }
    }).setOrigin(0.5).setDepth(12);

    this.createTextButton(485, 980, 300, 84, "REPLAY SHIFT", 0x315f7d, () => {
      clearLastShiftResult();
      this.startShift(result.day);
    });

    this.createTextButton(845, 980, 380, 84, continueLabel, 0x4f8b4c, () => {
      this.setActiveDay(nextDay);
      clearLastShiftResult();
      this.scene.restart({ showResult: false });
    });
  }

  private createTextButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    action: () => void
  ): Phaser.GameObjects.Container {
    const background = this.add.rectangle(0, 0, width, height, color, 1)
      .setStrokeStyle(4, 0xd7ecdf);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, width + 22, height + 18, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [background, text, hit]).setDepth(15);
    let used = false;

    hit.on("pointerover", () => button.setScale(1.025));
    hit.on("pointerout", () => button.setScale(1));
    hit.on("pointerdown", () => {
      if (used) return;
      used = true;
      button.setScale(0.985);
      action();
    });
    return button;
  }

  private createUtilityButton(x: number, y: number, label: string, action: () => void): void {
    const background = this.add.rectangle(0, 0, 205, 68, 0x173238, 0.96)
      .setStrokeStyle(2, 0x769091);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    const hit = this.add.rectangle(0, 0, 220, 82, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const button = this.add.container(x, y, [background, text, hit]).setDepth(15);
    hit.on("pointerover", () => button.setScale(1.035));
    hit.on("pointerout", () => button.setScale(1));
    hit.on("pointerdown", action);
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
