import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { crazyGamesPlatform } from "./platform/crazyGamesPlatform";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";
import {
  bestStarsFor,
  clearLastShiftResult,
  type ShiftResult
} from "./systems/StorefrontProgress";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
type PlayableDay = LevelId;

type CampaignDefinition = {
  role: string;
  title: string;
  promise: string;
  duties: string[];
  selectorDuties: string[];
};

const WEEK_ONE: Record<PlayableDay, CampaignDefinition> = {
  day01: {
    role: "STOCK ASSOCIATE",
    title: "FIRST SHIFT",
    promise: "Learn the full path from receiving bay to the first customer sale.",
    duties: ["Receive the delivery", "Load the restock cart", "Fill the opening fixture", "Open and serve customers"],
    selectorDuties: ["Receive stock", "Single-zone restock", "Open safely"]
  },
  day02: {
    role: "PROMOTION & CHECKOUT",
    title: "DRINKS ON DEMAND",
    promise: "Balance the main store, promotion stock, checkout and customer service.",
    duties: ["Stage promotion inventory", "Protect shared reserve", "Operate checkout", "Resolve one return"],
    selectorDuties: ["Allocate promotion", "Operate checkout", "Handle return"]
  },
  day03: {
    role: "FLOOR LEAD",
    title: "FLOOR CONTROL",
    promise: "Take one cart across multiple departments and match every case to its fixture.",
    duties: ["Stock drinks", "Stock grocery", "Stock the cold case", "Manage the live sales floor"],
    selectorDuties: ["Three departments", "Batch workflow", "Floor control"]
  },
  day04: {
    role: "PROMOTION SUPERVISOR",
    title: "PROMOTION PRESSURE",
    promise: "Keep four full displays ready while a flash sale drains the promotion end cap.",
    duties: ["Stage four department cases", "Batch-fill full displays", "Protect the promotion end cap", "Complete 12 sales"],
    selectorDuties: ["Four full displays", "Flash sale", "12 sales"]
  },
  day05: {
    role: "WEEKEND DUTY MANAGER",
    title: "WEEKEND RUSH",
    promise: "Run the whole store through two demand surges and finish your first week.",
    duties: ["Stage six departments", "Choose a restock route", "Recover two demand surges", "Complete 18 sales and close"],
    selectorDuties: ["Six departments", "Demand surges", "Week finale"]
  }
};

const DAYS: PlayableDay[] = ["day01", "day02", "day03", "day04", "day05"];

const storePrototype = StorefrontScene.prototype as unknown as {
  resolveActiveDay: () => PlayableDay;
  setActiveDay: (day: LevelId) => void;
  openDaySelector: () => void;
  createLobbyView: () => void;
  createResultView: (result: ShiftResult) => void;
  startShift: (day: LevelId) => void;
};

const originalLobby = storePrototype.createLobbyView;
const originalResult = storePrototype.createResultView;

storePrototype.resolveActiveDay = function resolveWeekOneDay(): PlayableDay {
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
    return isPlayableDay(stored) ? stored : "day01";
  } catch {
    return "day01";
  }
};

storePrototype.setActiveDay = function setWeekOneDay(day: LevelId): void {
  const playable = isPlayableDay(day) ? day : "day01";
  try {
    globalThis.localStorage?.setItem(ACTIVE_DAY_KEY, playable);
  } catch {
    // The active browser session still keeps the selected shift.
  }
  gameSession.setActiveDay(playable);
};

storePrototype.startShift = function startUnlockedWeekOneShift(day: LevelId): void {
  const scene = this as unknown as Phaser.Scene & { actionLocked?: boolean };
  const playable = isPlayableDay(day) ? day : "day01";
  if (!isUnlocked(playable)) {
    showStorefrontToast(scene, unlockMessage(playable));
    return;
  }
  if (scene.actionLocked) return;
  scene.actionLocked = true;
  storePrototype.setActiveDay.call(this, playable);
  gameSession.reset(playable);
  clearLastShiftResult();
  crazyGamesPlatform.gameplayStop();
  crazyGamesPlatform.loadingStart();
  scene.input.enabled = false;
  scene.cameras.main.fadeOut(220, 8, 16, 18);
  scene.time.delayedCall(230, () => scene.scene.start("opening"));
};

storePrototype.openDaySelector = function openFiveDaySelector(): void {
  const scene = this as unknown as Phaser.Scene & {
    modal?: Phaser.GameObjects.Container;
    showToast?: (message: string) => void;
  };
  if (scene.modal?.active) return;

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.86)
    .setInteractive()
    .setDepth(3000);
  const panel = scene.add.rectangle(665, 585, 1210, 930, 0x10252a, 0.995)
    .setStrokeStyle(7, 0x78a465)
    .setDepth(3001);
  const title = scene.add.text(665, 155, "MEGA MART · WEEK ONE", {
    fontFamily: "Arial",
    fontSize: "40px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(3002);
  const subtitle = scene.add.text(665, 210, "Complete each shift to unlock the next responsibility.", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#cfe0da"
  }).setOrigin(0.5).setDepth(3002);

  const positions = [
    { x: 270, y: 455 }, { x: 665, y: 455 }, { x: 1060, y: 455 },
    { x: 465, y: 790 }, { x: 865, y: 790 }
  ];
  const cards = DAYS.map((day, index) => createShiftCard(scene, day, positions[index].x, positions[index].y));
  const close = scene.add.text(665, 1080, "CLOSE", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#34454a",
    padding: { x: 34, y: 12 }
  }).setOrigin(0.5).setDepth(3003).setInteractive({ useHandCursor: true });
  close.on("pointerdown", () => {
    scene.modal?.destroy(true);
    scene.modal = undefined;
  });
  scene.modal = scene.add.container(0, 0, [shade, panel, title, subtitle, ...cards, close]).setDepth(3000);
};

storePrototype.createLobbyView = function createWeekOneLobby(): void {
  originalLobby.call(this);
  const day = storePrototype.resolveActiveDay.call(this);
  if (day === "day04" || day === "day05") {
    coverLegacyRoleCard(this as unknown as Phaser.Scene, day);
  }
};

storePrototype.createResultView = function createWeekOneResult(result: ShiftResult): void {
  originalResult.call(this, result);
  if (result.day !== "day03" && result.day !== "day04" && result.day !== "day05") return;

  const scene = this as unknown as Phaser.Scene;
  const nextDay = nextDayAfter(result.day);
  const progressionTitle = result.day === "day03"
    ? "PROMOTION PRESSURE UNLOCKED"
    : result.day === "day04"
      ? "WEEKEND RUSH UNLOCKED"
      : "WEEK ONE COMPLETE";
  const progressionDetail = result.day === "day03"
    ? "Day 4 opens four full displays and a flash-sale promotion end cap."
    : result.day === "day04"
      ? "Day 5 opens the whole store with six departments and two demand surges."
      : "You kept Mega Mart running through its busiest shift. Replay for stronger stars while new departments are prepared.";

  replaceResultCopy(scene, progressionTitle, progressionDetail);
  scene.add.rectangle(665, 990, 1040, 180, 0x0b1719, 0.99)
    .setStrokeStyle(4, 0x6f916f)
    .setDepth(200);
  createActionButton(scene, 430, 990, 330, 82, `REPLAY DAY ${Number(result.day.slice(-2))}`, 0x315f7d, () => {
    clearLastShiftResult();
    storePrototype.startShift.call(scene, result.day);
  });
  createActionButton(scene, 880, 990, 430, 82, nextDay ? `CONTINUE TO DAY ${Number(nextDay.slice(-2))}` : "BACK TO STORE", 0x4f8b4c, () => {
    clearLastShiftResult();
    if (nextDay) storePrototype.setActiveDay.call(scene, nextDay);
    scene.scene.restart({ showResult: false });
  });
};

const openingPrototype = OpeningScene.prototype as unknown as {
  create: () => void;
  finishOpening: () => void;
  resolveDay: () => PlayableDay;
};
const originalOpeningCreate = openingPrototype.create;

openingPrototype.resolveDay = function resolveWeekOneOpeningDay(): PlayableDay {
  const queryDay = new URLSearchParams(window.location.search).get("day");
  const normalizedQuery = normalizeQueryDay(queryDay);
  if (normalizedQuery) return normalizedQuery;
  try {
    const stored = localStorage.getItem(ACTIVE_DAY_KEY);
    return isPlayableDay(stored) ? stored : "day01";
  } catch {
    return "day01";
  }
};

openingPrototype.create = function createWeekOneBriefing(): void {
  originalOpeningCreate.call(this);
  const scene = this as unknown as Phaser.Scene & {
    __campaignBriefingAccepted?: boolean;
    __campaignBriefing?: Phaser.GameObjects.Container;
  };
  const day = gameSession.day;
  if (day !== "day04" && day !== "day05") return;
  scene.__campaignBriefing?.destroy(true);
  scene.__campaignBriefing = undefined;
  scene.__campaignBriefingAccepted = false;
  scene.__campaignBriefing = buildBriefing(scene, day);
};

function createShiftCard(
  scene: Phaser.Scene & { modal?: Phaser.GameObjects.Container; showToast?: (message: string) => void },
  day: PlayableDay,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const definition = WEEK_ONE[day];
  const unlocked = isUnlocked(day);
  const selected = storePrototype.resolveActiveDay.call(scene) === day;
  const stars = bestStarsFor(day);
  const background = scene.add.rectangle(0, 0, 350, 285, unlocked ? (selected ? 0x315f4b : 0x20343a) : 0x151d1f, 1)
    .setStrokeStyle(4, unlocked ? (selected ? 0xc7e78b : 0x6e858b) : 0x596366);
  const dayText = scene.add.text(0, -108, `DAY ${Number(day.slice(-2))} · ${definition.role}`, {
    fontFamily: "Arial", fontSize: "17px", color: "#f7e8a9", fontStyle: "bold", align: "center", wordWrap: { width: 320 }
  }).setOrigin(0.5);
  const title = scene.add.text(0, -62, definition.title, {
    fontFamily: "Arial", fontSize: "25px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5);
  const duties = scene.add.text(0, 8, definition.selectorDuties.map((item) => `• ${item}`).join("\n"), {
    fontFamily: "Arial", fontSize: "17px", color: "#dce9e5", lineSpacing: 7, align: "left"
  }).setOrigin(0.5);
  const starText = scene.add.text(0, 82, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
    fontFamily: "Arial", fontSize: "28px", color: "#ffcc3f", fontStyle: "bold"
  }).setOrigin(0.5);
  const action = scene.add.text(0, 118, unlocked ? (selected ? "SELECTED" : stars > 0 ? "REPLAY" : "START") : unlockLabel(day), {
    fontFamily: "Arial", fontSize: "16px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: unlocked ? (selected ? "#4b7b55" : "#315f7d") : "#4a5355",
    padding: { x: 18, y: 8 }
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, 370, 305, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  const card = scene.add.container(x, y, [background, dayText, title, duties, starText, action, hit]).setDepth(3002);
  hit.on("pointerover", () => card.setScale(1.02));
  hit.on("pointerout", () => card.setScale(1));
  hit.on("pointerdown", () => {
    if (!unlocked) {
      scene.showToast?.(unlockMessage(day));
      return;
    }
    storePrototype.setActiveDay.call(scene, day);
    scene.modal?.destroy(true);
    scene.modal = undefined;
    scene.scene.restart({ showResult: false });
  });
  return card;
}

function coverLegacyRoleCard(scene: Phaser.Scene, day: PlayableDay): void {
  const definition = WEEK_ONE[day];
  scene.add.rectangle(300, 250, 510, 255, 0x10252a, 1)
    .setStrokeStyle(5, day === "day05" ? 0xffd75a : 0x78a465)
    .setDepth(90);
  scene.add.text(300, 165, `CURRENT ROLE · ${definition.role}`, {
    fontFamily: "Arial", fontSize: "18px", color: "#ffd75a", fontStyle: "bold", letterSpacing: 2
  }).setOrigin(0.5).setDepth(91);
  scene.add.text(300, 215, definition.title, {
    fontFamily: "Arial", fontSize: "31px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5).setDepth(91);
  scene.add.text(300, 282, definition.selectorDuties.join("  →  "), {
    fontFamily: "Arial", fontSize: "18px", color: "#d8e7df", fontStyle: "bold", align: "center", wordWrap: { width: 450 }
  }).setOrigin(0.5).setDepth(91);
  scene.add.text(300, 340, bestStarsFor(day) > 0 ? "COMPLETED · REPLAY FOR STARS" : "NEW MANAGEMENT SHIFT", {
    fontFamily: "Arial", fontSize: "16px", color: bestStarsFor(day) > 0 ? "#bfe88a" : "#ffd98a", fontStyle: "bold"
  }).setOrigin(0.5).setDepth(91);
}

function buildBriefing(
  scene: Phaser.Scene & { __campaignBriefingAccepted?: boolean; __campaignBriefing?: Phaser.GameObjects.Container },
  day: Extract<PlayableDay, "day04" | "day05">
): Phaser.GameObjects.Container {
  const definition = WEEK_ONE[day];
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.92).setInteractive();
  const panel = scene.add.rectangle(665, 585, 1060, 850, 0x10252a, 0.998)
    .setStrokeStyle(8, day === "day05" ? 0xffd75a : 0x78a465);
  const eyebrow = scene.add.text(665, 220, `DAY ${Number(day.slice(-2))} · ${definition.role}`, {
    fontFamily: "Arial", fontSize: "22px", color: "#ffd75a", fontStyle: "bold", letterSpacing: 3
  }).setOrigin(0.5);
  const title = scene.add.text(665, 290, definition.title, {
    fontFamily: "Arial", fontSize: "50px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5);
  const promise = scene.add.text(665, 365, definition.promise, {
    fontFamily: "Arial", fontSize: "22px", color: "#cfe0da", align: "center", wordWrap: { width: 860 }
  }).setOrigin(0.5);
  const duties = scene.add.text(350, 455, definition.duties.map((item, index) => `${index + 1}.  ${item}`).join("\n"), {
    fontFamily: "Arial", fontSize: "25px", color: "#ffffff", lineSpacing: 22, wordWrap: { width: 700 }
  });
  const buttonBackground = scene.add.rectangle(0, 0, 470, 92, 0x4f8b4c, 1)
    .setStrokeStyle(5, 0xbfe5a6)
    .setInteractive({ useHandCursor: true });
  const buttonText = scene.add.text(0, 0, day === "day05" ? "START WEEKEND RUSH" : "START PROMOTION SHIFT", {
    fontFamily: "Arial", fontSize: "26px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5);
  const button = scene.add.container(665, 925, [buttonBackground, buttonText]);
  const container = scene.add.container(0, 0, [shade, panel, eyebrow, title, promise, duties, button]).setDepth(5000);
  buttonBackground.on("pointerdown", () => {
    if (scene.__campaignBriefingAccepted) return;
    scene.__campaignBriefingAccepted = true;
    buttonBackground.disableInteractive();
    container.destroy(true);
    scene.__campaignBriefing = undefined;
    openingPrototype.finishOpening.call(scene);
  });
  return container;
}

function replaceResultCopy(scene: Phaser.Scene, title: string, detail: string): void {
  scene.children.list
    .filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text && child.active)
    .forEach((text) => {
      const value = text.text.toUpperCase();
      if (value === "CORE TRAINING COMPLETE" || value.includes("UNLOCKED")) text.setText(title);
      if (value.includes("REPLAY CONTRACTS") || value.includes("DAY 3 ADDS") || value.includes("CORE TRAINING")) text.setText(detail);
    });
}

function createActionButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: number,
  action: () => void
): void {
  const background = scene.add.rectangle(0, 0, width, height, color, 1).setStrokeStyle(4, 0xd7ecdf);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial", fontSize: "22px", color: "#ffffff", fontStyle: "bold"
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, width + 20, height + 16, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  const button = scene.add.container(x, y, [background, text, hit]).setDepth(202);
  hit.on("pointerover", () => button.setScale(1.025));
  hit.on("pointerout", () => button.setScale(1));
  hit.on("pointerdown", action);
}

function showStorefrontToast(scene: Phaser.Scene, message: string): void {
  scene.add.text(665, 1030, message, {
    fontFamily: "Arial", fontSize: "22px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: "#173238", padding: { x: 24, y: 14 }, align: "center"
  }).setOrigin(0.5).setDepth(5000);
}

function isUnlocked(day: PlayableDay): boolean {
  const index = DAYS.indexOf(day);
  return index <= 0 || bestStarsFor(DAYS[index - 1]) > 0;
}

function unlockLabel(day: PlayableDay): string {
  const index = DAYS.indexOf(day);
  return index > 0 ? `COMPLETE DAY ${index}` : "START";
}

function unlockMessage(day: PlayableDay): string {
  const index = DAYS.indexOf(day);
  return index > 0 ? `Complete Day ${index} to unlock ${WEEK_ONE[day].title}.` : "Day 1 is ready.";
}

function nextDayAfter(day: PlayableDay): PlayableDay | undefined {
  const index = DAYS.indexOf(day);
  return index >= 0 && index < DAYS.length - 1 ? DAYS[index + 1] : undefined;
}

function normalizeQueryDay(value: string | null): PlayableDay | undefined {
  if (!value) return undefined;
  const normalized = value.startsWith("day") ? value : `day${value.padStart(2, "0")}`;
  return isPlayableDay(normalized) ? normalized : undefined;
}

function isPlayableDay(value: unknown): value is PlayableDay {
  return typeof value === "string" && DAYS.includes(value as PlayableDay);
}
