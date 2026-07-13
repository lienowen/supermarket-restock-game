import Phaser from "phaser";
import "./uiRuntimePolish.css";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";


type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  openDaySelector: () => void;
  showToast: (message: string) => void;
  startShift: (day: LevelId) => void;
};

type StorefrontPrototype = {
  createLobbyView: () => void;
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
  const originalLobby = prototype.createLobbyView;

  prototype.createLobbyView = function createCleanReleaseLobby(): void {
    originalLobby.call(this);
    const scene = this as unknown as RuntimeStorefront;
    const day = readActiveDay();
    createCleanRoleAndContractCard(scene, day);
    createReliableLobbyHitAreas(scene, day);
  };
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
