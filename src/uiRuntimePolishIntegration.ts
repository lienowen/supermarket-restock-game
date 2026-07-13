import Phaser from "phaser";
import "./uiRuntimePolish.css";
import { AssetPaths, Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";


type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;
type AssetKey = keyof typeof AssetPaths;

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  openDaySelector: () => void;
  showToast: (message: string) => void;
  startShift: (day: LevelId) => void;
  __openingAssetsReady?: boolean;
  __openingAssetsLoading?: boolean;
  __openingStartPending?: boolean;
  __openingReadyCallbacks?: Array<() => void>;
  __openingLoadOverlay?: Phaser.GameObjects.Container;
  __openingLoadProgress?: Phaser.GameObjects.Text;
  __openingLoadBar?: Phaser.GameObjects.Rectangle;
};

type StorefrontPrototype = {
  create: (...args: unknown[]) => void;
  createLobbyView: () => void;
  startShift: (day: LevelId) => void;
};

type RuntimeOpening = Phaser.Scene & {
  __campaignBriefing?: Phaser.GameObjects.Container;
  __campaignBriefingAccepted?: boolean;
};

type OpeningPrototype = {
  create: (...args: unknown[]) => void;
};

type ContractDefinition = {
  title: string;
  description: string;
  reward: number;
};

const ROLE_COPY: Record<PlayableDay, {
  role: string;
  title: string;
  duties: string[];
  unlock: string;
}> = {
  day01: {
    role: "STOCK ASSOCIATE",
    title: "OPENING ROUTINE",
    duties: ["Receive stock", "Open safely", "Live restock"],
    unlock: "Complete Day 1 to unlock promotion duties"
  },
  day02: {
    role: "PROMOTION & CHECKOUT",
    title: "PROMOTION OPERATIONS",
    duties: ["Allocate promotion", "Operate checkout", "Handle return"],
    unlock: "Complete Day 2 to qualify as Shift Supervisor"
  },
  day03: {
    role: "SHIFT SUPERVISOR",
    title: "SUPERVISOR SHIFT",
    duties: ["Inspect the floor", "Manage service", "Restore equipment"],
    unlock: "Supervisor contracts reward service and incident control"
  }
};

const CONTRACTS: Record<PlayableDay, Record<string, ContractDefinition>> = {
  day01: {
    "restock-pro": {
      title: "RESTOCK PROFESSIONAL",
      description: "Complete two real shelf refills after customers begin shopping.",
      reward: 25
    },
    "zero-misses": {
      title: "PERFECT AVAILABILITY",
      description: "Finish the shift without losing a customer to an empty shelf.",
      reward: 30
    },
    "early-close": {
      title: "EFFICIENT SHIFT",
      description: "Finish the full shift with at least 45 seconds remaining.",
      reward: 35
    }
  },
  day02: {
    "zero-misses": {
      title: "PROMOTION CONTROL",
      description: "Run both store areas without losing a sale to unavailable stock.",
      reward: 45
    },
    "service-star": {
      title: "SERVICE STAR",
      description: "Resolve the return and damaged item during the same shift.",
      reward: 35
    },
    "promo-rescue": {
      title: "PROMOTION RESCUE",
      description: "Use Back Stock for two emergency promotion saves.",
      reward: 40
    }
  },
  day03: {
    "supervisor-service": {
      title: "SERVICE LEAD",
      description: "Finish with at least two satisfied service customers.",
      reward: 45
    },
    "fault-response": {
      title: "EQUIPMENT RECOVERY",
      description: "Complete the checkout recovery procedure before closing.",
      reward: 40
    },
    "zero-misses": {
      title: "CONTROLLED FLOOR",
      description: "Manage the rush without losing a customer to unavailable stock.",
      reward: 50
    }
  }
};

installStorefrontPolish();
removeDuplicateOpeningBriefing();

function installStorefrontPolish(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalCreate = prototype.create;
  const originalLobby = prototype.createLobbyView;
  const originalStartShift = prototype.startShift;

  prototype.create = function createWithOpeningAssetPreload(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeStorefront;
    scene.__openingAssetsReady = openingAssetKeys().every((key) => scene.textures.exists(key));
    scene.__openingAssetsLoading = false;
    scene.__openingStartPending = false;
    scene.__openingReadyCallbacks = [];
    scene.__openingLoadOverlay = undefined;
    scene.__openingLoadProgress = undefined;
    scene.__openingLoadBar = undefined;

    scene.time.delayedCall(350, () => prepareOpeningAssets(scene));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.__openingReadyCallbacks = [];
      scene.__openingLoadOverlay?.destroy(true);
      scene.__openingLoadOverlay = undefined;
      scene.__openingLoadProgress = undefined;
      scene.__openingLoadBar = undefined;
    });
  };

  prototype.createLobbyView = function createCleanReleaseLobby(): void {
    originalLobby.call(this);
    const scene = this as unknown as RuntimeStorefront;
    const day = readActiveDay();
    createCleanRoleAndContractCard(scene, day);
    createReliableLobbyHitAreas(scene, day);
  };

  prototype.startShift = function startShiftAfterOpeningAssets(day: LevelId): void {
    const scene = this as unknown as RuntimeStorefront;
    if (scene.__openingStartPending) return;

    if (openingAssetsReady(scene)) {
      originalStartShift.call(this, day);
      return;
    }

    scene.__openingStartPending = true;
    showOpeningLoadOverlay(scene, day);
    prepareOpeningAssets(scene, () => {
      if (!scene.scene.isActive()) return;
      scene.__openingStartPending = false;
      scene.__openingLoadOverlay?.destroy(true);
      scene.__openingLoadOverlay = undefined;
      scene.__openingLoadProgress = undefined;
      scene.__openingLoadBar = undefined;
      originalStartShift.call(this, day);
    });
  };
}

function openingAssetKeys(): AssetKey[] {
  return [...new Set([
    Assets.ui.openingStorefront,
    Assets.ui.openingShiftBadge,
    Assets.backgrounds.salesfloor,
    ...Object.values(Assets.delivery)
  ])] as AssetKey[];
}

function openingAssetsReady(scene: RuntimeStorefront): boolean {
  const ready = openingAssetKeys().every((key) => scene.textures.exists(key));
  scene.__openingAssetsReady = ready;
  return ready;
}

function prepareOpeningAssets(scene: RuntimeStorefront, onReady?: () => void): void {
  if (onReady) {
    scene.__openingReadyCallbacks ??= [];
    scene.__openingReadyCallbacks.push(onReady);
  }

  if (openingAssetsReady(scene)) {
    flushOpeningReadyCallbacks(scene);
    return;
  }
  if (scene.__openingAssetsLoading) return;

  const missing = openingAssetKeys().filter((key) => !scene.textures.exists(key));
  if (missing.length === 0) {
    scene.__openingAssetsReady = true;
    flushOpeningReadyCallbacks(scene);
    return;
  }

  scene.__openingAssetsLoading = true;
  missing.forEach((key) => scene.load.image(key, AssetPaths[key]));

  const onProgress = (progress: number): void => updateOpeningLoadOverlay(scene, progress);
  const onComplete = (): void => {
    scene.load.off("progress", onProgress);
    scene.__openingAssetsLoading = false;
    scene.__openingAssetsReady = openingAssetsReady(scene);
    updateOpeningLoadOverlay(scene, 1);
    flushOpeningReadyCallbacks(scene);
  };

  scene.load.on("progress", onProgress);
  scene.load.once("complete", onComplete);
  scene.load.start();
}

function flushOpeningReadyCallbacks(scene: RuntimeStorefront): void {
  const callbacks = scene.__openingReadyCallbacks ?? [];
  scene.__openingReadyCallbacks = [];
  callbacks.forEach((callback) => callback());
}

function showOpeningLoadOverlay(scene: RuntimeStorefront, day: LevelId): void {
  scene.__openingLoadOverlay?.destroy(true);
  const dayNumber = Number(day.slice(-2));
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.88)
    .setDepth(5000)
    .setInteractive();
  const panel = scene.add.rectangle(665, 590, 760, 340, 0x10252a, 0.995)
    .setStrokeStyle(7, 0x78a465)
    .setDepth(5001);
  const eyebrow = scene.add.text(665, 485, `DAY ${dayNumber} · SHIFT PREPARATION`, {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(5002);
  const title = scene.add.text(665, 545, "PREPARING YOUR SHIFT", {
    fontFamily: "Arial",
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(5002);
  const detail = scene.add.text(665, 600, "Loading the delivery bay, staff and receiving equipment.", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#cfe0da",
    align: "center"
  }).setOrigin(0.5).setDepth(5002);
  const track = scene.add.rectangle(405, 675, 520, 24, 0x263a3d, 1)
    .setOrigin(0, 0.5)
    .setStrokeStyle(2, 0x557175)
    .setDepth(5002);
  const bar = scene.add.rectangle(405, 675, 8, 20, 0x8ecf7f, 1)
    .setOrigin(0, 0.5)
    .setDepth(5003);
  const progress = scene.add.text(665, 730, "LOADING 0%", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(5002);

  scene.__openingLoadProgress = progress;
  scene.__openingLoadBar = bar;
  scene.__openingLoadOverlay = scene.add.container(0, 0, [shade, panel, eyebrow, title, detail, track, bar, progress])
    .setDepth(5000);
  updateOpeningLoadOverlay(scene, 0);
}

function updateOpeningLoadOverlay(scene: RuntimeStorefront, progress: number): void {
  const normalized = Phaser.Math.Clamp(progress, 0, 1);
  scene.__openingLoadProgress?.setText(`LOADING ${Math.round(normalized * 100)}%`);
  scene.__openingLoadBar?.setDisplaySize(Math.max(8, 520 * normalized), 20);
}

function createCleanRoleAndContractCard(scene: RuntimeStorefront, day: PlayableDay): void {
  const role = ROLE_COPY[day];
  const contract = readSelectedContract(day);
  const depth = 50;

  scene.add.rectangle(300, 500, 545, 760, 0x0d2428, 1)
    .setStrokeStyle(6, 0x78a465, 1)
    .setDepth(depth)
    .setInteractive();

  scene.add.text(300, 170, `CURRENT ROLE · ${role.role}`, {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2,
    align: "center"
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 220, role.title, {
    fontFamily: "Arial",
    fontSize: "32px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 470 }
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 292, role.duties.join("  →  "), {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#dce9e5",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 465 }
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 350, "NEW TRAINING SHIFT", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#ffd98a",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.rectangle(300, 392, 465, 2, 0x6d8b82, 0.7).setDepth(depth + 1);

  scene.add.text(300, 430, `DAY ${Number(day.slice(-2))} · OPTIONAL CONTRACT`, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 482, contract.title, {
    fontFamily: "Arial",
    fontSize: "29px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 460 }
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 555, contract.description, {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#d9e8e3",
    align: "center",
    lineSpacing: 7,
    wordWrap: { width: 440 }
  }).setOrigin(0.5).setDepth(depth + 1);

  scene.add.text(300, 650, `BONUS REWARD  +${contract.reward} COINS`, {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff2a8",
    fontStyle: "bold",
    backgroundColor: "#6c4d17",
    padding: { x: 16, y: 9 }
  }).setOrigin(0.5).setDepth(depth + 1);

  const contractButton = scene.add.rectangle(300, 738, 300, 72, 0x315f7d, 1)
    .setStrokeStyle(4, 0x9fcbe8)
    .setDepth(depth + 2)
    .setInteractive({ useHandCursor: true });
  scene.add.text(300, 738, "CHOOSE CONTRACT", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(depth + 3);
  contractButton.on("pointerdown", () => scene.showToast("CONTRACT"));

  scene.add.text(300, 815, role.unlock, {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#b7cbc6",
    align: "center",
    wordWrap: { width: 450 }
  }).setOrigin(0.5).setDepth(depth + 1);
}

function createReliableLobbyHitAreas(scene: RuntimeStorefront, day: PlayableDay): void {
  createInvisibleButton(scene, 965, 770, 430, 122, () => scene.startShift(day));
  createInvisibleButton(scene, 180, 1080, 225, 86, () => scene.openDaySelector());
  createInvisibleButton(scene, 415, 1080, 225, 86, () => scene.showToast("UPGRADES"));
  createInvisibleButton(scene, 650, 1080, 225, 86, () => scene.showToast("STORE"));
  createInvisibleButton(scene, 885, 1080, 225, 86, () => scene.showToast("COLLECTION"));
  createInvisibleButton(scene, 1120, 1080, 225, 86, () => scene.showToast("SETTINGS"));
}

function createInvisibleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  action: () => void
): void {
  const hit = scene.add.rectangle(x, y, width, height, 0xffffff, 0.001)
    .setDepth(60)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerdown", action);
}

function removeDuplicateOpeningBriefing(): void {
  const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithoutDuplicateBriefing(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeOpening;
    if (!scene.__campaignBriefing?.active) return;
    scene.__campaignBriefing.destroy(true);
    scene.__campaignBriefing = undefined;
    scene.__campaignBriefingAccepted = true;
  };
}

function readActiveDay(): PlayableDay {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
  } catch {
    // Use the first day when browser storage is unavailable.
  }
  return "day01";
}

function readSelectedContract(day: PlayableDay): ContractDefinition {
  const dayContracts = CONTRACTS[day];
  const fallbackId = Object.keys(dayContracts)[0];
  try {
    const stored = globalThis.localStorage?.getItem(`supermarket.shiftContract.${day}`);
    return dayContracts[stored ?? fallbackId] ?? dayContracts[fallbackId];
  } catch {
    return dayContracts[fallbackId];
  }
}
