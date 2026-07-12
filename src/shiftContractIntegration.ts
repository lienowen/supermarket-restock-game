import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { GameScene } from "./scenes/GameScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";
import type { ShiftResult } from "./systems/StorefrontProgress";

const CONTRACT_STORAGE_PREFIX = "supermarket.shiftContract.";
const LAST_CONTRACT_RESULT_KEY = "supermarket.lastContractResult";

type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;

type ContractId =
  | "zero-misses"
  | "restock-pro"
  | "early-close"
  | "service-star"
  | "promo-rescue"
  | "supervisor-service"
  | "fault-response";

type ContractDefinition = {
  id: ContractId;
  title: string;
  description: string;
  shortDescription: string;
  reward: number;
};

type ContractResult = {
  day: LevelId;
  id: ContractId;
  title: string;
  reward: number;
  passed: boolean;
};

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  remainingSeconds: number;
  money: number;
  cart: Phaser.GameObjects.Container;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  __day2ServiceResolved?: boolean;
  __day2DamageResolved?: boolean;
  __day2BackStockSaves?: number;
  __day3EquipmentResolved?: boolean;
  __contractRestocks?: number;
  __contractRewarded?: boolean;
  __contractPanel?: Phaser.GameObjects.Container;
  __contractTitle?: Phaser.GameObjects.Text;
  __contractProgress?: Phaser.GameObjects.Text;
  __contractRewardText?: Phaser.GameObjects.Text;
};

type StorefrontPrototype = {
  createLobbyView: () => void;
  createResultView: (result: ShiftResult) => void;
  showToast: (message: string) => void;
};

type GamePrototype = {
  create: () => void;
  recordRestockCombo: () => void;
  endShift: () => void;
};

const DAY_CONTRACTS: Record<PlayableDay, ContractDefinition[]> = {
  day01: [
    {
      id: "restock-pro",
      title: "RESTOCK PROFESSIONAL",
      description: "Complete two real shelf refills after customers begin shopping.",
      shortDescription: "Complete 2 live restocks",
      reward: 25
    },
    {
      id: "zero-misses",
      title: "PERFECT AVAILABILITY",
      description: "Finish the whole shift without losing a customer to an empty shelf.",
      shortDescription: "Finish with 0 missed sales",
      reward: 30
    },
    {
      id: "early-close",
      title: "EFFICIENT SHIFT",
      description: "Finish the full sales target and closing duties with at least 45 seconds left.",
      shortDescription: "Close with 00:45 remaining",
      reward: 35
    }
  ],
  day02: [
    {
      id: "zero-misses",
      title: "PROMOTION CONTROL",
      description: "Run both store areas without losing a sale to unavailable stock.",
      shortDescription: "Finish with 0 missed sales",
      reward: 45
    },
    {
      id: "service-star",
      title: "SERVICE STAR",
      description: "Resolve the customer return and remove the damaged item during the same shift.",
      shortDescription: "Complete both service duties",
      reward: 35
    },
    {
      id: "promo-rescue",
      title: "PROMOTION RESCUE",
      description: "Use Back Stock for two emergency saves while promotion demand is active.",
      shortDescription: "Complete 2 Back Stock saves",
      reward: 40
    }
  ],
  day03: [
    {
      id: "supervisor-service",
      title: "SERVICE LEAD",
      description: "Finish the supervisor shift with at least two satisfied service customers.",
      shortDescription: "Satisfy 2 service customers",
      reward: 45
    },
    {
      id: "fault-response",
      title: "EQUIPMENT RECOVERY",
      description: "Complete the full checkout recovery procedure before closing the store.",
      shortDescription: "Restore failed checkout",
      reward: 40
    },
    {
      id: "zero-misses",
      title: "CONTROLLED FLOOR",
      description: "Manage the rush without losing any customer to unavailable stock.",
      shortDescription: "Finish with 0 missed sales",
      reward: 50
    }
  ]
};

installStorefrontContracts();
installGameplayContracts();

function installStorefrontContracts(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalLobby = prototype.createLobbyView;
  const originalResult = prototype.createResultView;
  const originalShowToast = prototype.showToast;

  prototype.createLobbyView = function createLobbyWithContract(): void {
    originalLobby.call(this);
    createContractBoard(this as unknown as RuntimeStorefront);
  };

  prototype.createResultView = function createResultWithContract(result: ShiftResult): void {
    originalResult.call(this, result);
    createContractResultCard(this as unknown as RuntimeStorefront, result);
  };

  prototype.showToast = function openContractFromStorefront(message: string): void {
    if (message.startsWith("CONTRACT")) {
      openContractPicker(this as unknown as RuntimeStorefront);
      return;
    }
    originalShowToast.call(this, message);
  };
}

function installGameplayContracts(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;
  const originalRestockCombo = prototype.recordRestockCombo;
  const originalEndShift = prototype.endShift;

  prototype.create = function createWithShiftContract(): void {
    originalCreate.call(this);
    const scene = this as unknown as RuntimeGame;
    scene.__contractRestocks = 0;
    scene.__contractRewarded = false;
    createGameplayContractPanel(scene);

    let lastRefresh = 0;
    const refresh = (): void => {
      if (scene.time.now - lastRefresh < 180) return;
      lastRefresh = scene.time.now;
      refreshGameplayContractPanel(scene);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, refresh);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, refresh);
      scene.__contractPanel?.destroy(true);
      scene.__contractPanel = undefined;
    });
  };

  prototype.recordRestockCombo = function countContractRestock(): void {
    const scene = this as unknown as RuntimeGame;
    if (scene.phase === "OPEN" || scene.phase === "RUSH") {
      scene.__contractRestocks = (scene.__contractRestocks ?? 0) + 1;
    }
    originalRestockCombo.call(this);
  };

  prototype.endShift = function endShiftWithContractReward(): void {
    const scene = this as unknown as RuntimeGame;
    if (canFinalizeShift(scene) && !scene.__contractRewarded) {
      scene.__contractRewarded = true;
      const contract = getSelectedContract(gameSession.day);
      const passed = evaluateContract(scene, contract);
      const reward = passed ? contract.reward : 0;
      if (reward > 0) gameSession.earnCoins(reward);
      writeContractResult({
        day: gameSession.day,
        id: contract.id,
        title: contract.title,
        reward,
        passed
      });
      refreshGameplayContractPanel(scene, true);
    }

    originalEndShift.call(this);
  };
}

function createContractBoard(scene: RuntimeStorefront): void {
  const day = resolvePlayableDay();
  const contract = getSelectedContract(day);

  const panel = scene.add.rectangle(300, 625, 490, 430, 0x10252a, 0.94)
    .setStrokeStyle(6, 0xffd75a)
    .setDepth(12);
  const eyebrow = scene.add.text(300, 445, "OPTIONAL SHIFT CONTRACT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(13);
  const title = scene.add.text(300, 510, contract.title, {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 420 }
  }).setOrigin(0.5).setDepth(13);
  const description = scene.add.text(300, 615, contract.description, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#d9e8e3",
    align: "center",
    lineSpacing: 8,
    wordWrap: { width: 410 }
  }).setOrigin(0.5).setDepth(13);
  const reward = scene.add.text(300, 730, `BONUS REWARD  +${contract.reward} COINS`, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#fff2a8",
    fontStyle: "bold",
    backgroundColor: "#6c4d17",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(13);
  const changeBackground = scene.add.rectangle(300, 835, 300, 76, 0x315f7d, 1)
    .setStrokeStyle(4, 0x9fcbe8)
    .setDepth(13)
    .setInteractive({ useHandCursor: true });
  const changeText = scene.add.text(300, 835, "CHOOSE CONTRACT", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(14);
  const unlock = scene.add.text(300, 910,
    day === "day01"
      ? "Complete Day 1 to unlock promotion duties"
      : day === "day02"
        ? "Complete Day 2 to qualify as Shift Supervisor"
        : "Supervisor contracts reward service and incident control", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#9fb6b2",
      align: "center",
      wordWrap: { width: 420 }
    }).setOrigin(0.5).setDepth(13);

  const open = (): void => openContractPicker(scene);
  changeBackground.on("pointerdown", open);
  changeText.setInteractive({ useHandCursor: true }).on("pointerdown", open);
  void panel;
  void eyebrow;
  void title;
  void description;
  void reward;
  void unlock;
}

function openContractPicker(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  const day = resolvePlayableDay();
  const selected = getSelectedContract(day);
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.82)
    .setInteractive()
    .setDepth(1000);
  const panel = scene.add.rectangle(665, 590, 1080, 800, 0x10252a, 0.99)
    .setStrokeStyle(7, 0xffd75a)
    .setDepth(1001);
  const title = scene.add.text(665, 245, `CHOOSE DAY ${Number(day.slice(-2))} CONTRACT`, {
    fontFamily: "Arial",
    fontSize: "39px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1002);
  const subtitle = scene.add.text(665, 305, "One optional goal · one bonus payout · failure never blocks the shift", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#cfe0da"
  }).setOrigin(0.5).setDepth(1002);

  const objects: Phaser.GameObjects.GameObject[] = [shade, panel, title, subtitle];
  getContracts(day).forEach((contract, index) => {
    const x = 345 + index * 320;
    const active = selected.id === contract.id;
    const card = scene.add.rectangle(x, 585, 285, 420, active ? 0x315f4b : 0x173238, 1)
      .setStrokeStyle(5, active ? 0xd9efad : 0x617d82)
      .setDepth(1002);
    const contractTitle = scene.add.text(x, 430, contract.title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 245 }
    }).setOrigin(0.5).setDepth(1003);
    const contractDescription = scene.add.text(x, 575, contract.description, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d8e7e2",
      align: "center",
      lineSpacing: 8,
      wordWrap: { width: 235 }
    }).setOrigin(0.5).setDepth(1003);
    const reward = scene.add.text(x, 700, `+${contract.reward} COINS`, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffd75a",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(1003);
    const action = scene.add.text(x, 760, active ? "SELECTED" : "SELECT", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: active ? "#4f8b4c" : "#315f7d",
      padding: { x: 24, y: 11 }
    }).setOrigin(0.5).setDepth(1003);
    const hit = scene.add.rectangle(x, 585, 300, 440, 0xffffff, 0.001)
      .setDepth(1004)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      setSelectedContract(day, contract.id);
      scene.modal?.destroy(true);
      scene.modal = undefined;
      scene.scene.restart({ showResult: false });
    });
    objects.push(card, contractTitle, contractDescription, reward, action, hit);
  });

  const closeBackground = scene.add.rectangle(665, 945, 260, 70, 0x34454a, 1)
    .setDepth(1003)
    .setInteractive({ useHandCursor: true });
  const closeText = scene.add.text(665, 945, "CLOSE", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1004);
  const close = (): void => {
    scene.modal?.destroy(true);
    scene.modal = undefined;
  };
  closeBackground.on("pointerdown", close);
  closeText.setInteractive({ useHandCursor: true }).on("pointerdown", close);
  objects.push(closeBackground, closeText);

  scene.modal = scene.add.container(0, 0, objects).setDepth(1000);
}

function createGameplayContractPanel(scene: RuntimeGame): void {
  const contract = getSelectedContract(gameSession.day);
  const background = scene.add.rectangle(0, 0, 470, 112, 0x102a2f, 0.96)
    .setStrokeStyle(4, 0xffd75a);
  const title = scene.add.text(0, -30, contract.title, {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff2a8",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const progress = scene.add.text(0, 5, "", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const reward = scene.add.text(0, 35, `CONTRACT BONUS  +${contract.reward}`, {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#9fd0bd",
    fontStyle: "bold"
  }).setOrigin(0.5);

  scene.__contractTitle = title;
  scene.__contractProgress = progress;
  scene.__contractRewardText = reward;
  scene.__contractPanel = scene.add.container(335, 260, [background, title, progress, reward])
    .setDepth(84)
    .setScale(0.92);
  refreshGameplayContractPanel(scene);
}

function refreshGameplayContractPanel(scene: RuntimeGame, final = false): void {
  const contract = getSelectedContract(gameSession.day);
  const state = getContractProgress(scene, contract);
  scene.__contractTitle?.setText(contract.title);
  scene.__contractProgress?.setText(state.text).setColor(state.failed ? "#ff9d91" : state.complete ? "#a9ef9d" : "#ffffff");
  scene.__contractRewardText?.setText(
    final
      ? state.complete
        ? `COMPLETE  +${contract.reward} COINS`
        : "CONTRACT FAILED · NO BONUS"
      : `CONTRACT BONUS  +${contract.reward}`
  );
}

function createContractResultCard(scene: RuntimeStorefront, shiftResult: ShiftResult): void {
  const result = readContractResult();
  if (!result || result.day !== shiftResult.day) return;

  const panel = scene.add.rectangle(320, 660, 480, 235, result.passed ? 0x193c2d : 0x492c2a, 0.97)
    .setStrokeStyle(6, result.passed ? 0x9bd58f : 0xd98778)
    .setDepth(13);
  const eyebrow = scene.add.text(320, 585, "SHIFT CONTRACT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: result.passed ? "#bceead" : "#ffc0b5",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(14);
  const title = scene.add.text(320, 630, result.title, {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 420 }
  }).setOrigin(0.5).setDepth(14);
  const status = scene.add.text(320, 710, result.passed ? "CONTRACT COMPLETE" : "CONTRACT FAILED", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: result.passed ? "#a9ef9d" : "#ff9d91",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(14);
  const reward = scene.add.text(320, 765, result.passed ? `BONUS PAID  +${result.reward} COINS` : "NO BONUS PAID", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff2a8",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(14);
  void panel;
  void eyebrow;
  void title;
  void status;
  void reward;
}

function getContractProgress(
  scene: RuntimeGame,
  contract: ContractDefinition
): { text: string; complete: boolean; failed: boolean } {
  const snapshot = gameSession.snapshot;
  switch (contract.id) {
    case "zero-misses": {
      const missed = snapshot.missedSales;
      return {
        text: missed === 0 ? "MISSED SALES  0 · PERFECT" : `MISSED SALES  ${missed} · FAILED`,
        complete: missed === 0,
        failed: missed > 0
      };
    }
    case "restock-pro": {
      const count = scene.__contractRestocks ?? 0;
      return {
        text: `LIVE RESTOCKS  ${Math.min(2, count)}/2`,
        complete: count >= 2,
        failed: false
      };
    }
    case "early-close": {
      const complete = scene.phase === "CLOSING" && scene.remainingSeconds >= 45;
      return {
        text: `TIME REMAINING  ${formatTime(scene.remainingSeconds)} · NEED 00:45`,
        complete,
        failed: scene.remainingSeconds < 45
      };
    }
    case "service-star": {
      const service = Boolean(scene.__day2ServiceResolved);
      const damage = Boolean(scene.__day2DamageResolved);
      return {
        text: `RETURN ${service ? "✓" : "○"}   DAMAGE ${damage ? "✓" : "○"}`,
        complete: service && damage,
        failed: false
      };
    }
    case "promo-rescue": {
      const count = scene.__day2BackStockSaves ?? 0;
      return {
        text: `BACK STOCK SAVES  ${Math.min(2, count)}/2`,
        complete: count >= 2,
        failed: false
      };
    }
    case "supervisor-service": {
      const count = snapshot.satisfiedCustomers;
      return {
        text: `SATISFIED SERVICE  ${Math.min(2, count)}/2`,
        complete: count >= 2,
        failed: false
      };
    }
    case "fault-response": {
      const complete = Boolean(scene.__day3EquipmentResolved);
      return {
        text: complete ? "CHECKOUT RESTORED  ✓" : "CHECKOUT RECOVERY  ○",
        complete,
        failed: false
      };
    }
  }
}

function evaluateContract(scene: RuntimeGame, contract: ContractDefinition): boolean {
  return getContractProgress(scene, contract).complete;
}

function canFinalizeShift(scene: RuntimeGame): boolean {
  if (scene.shiftEnded || scene.phase === "RESULT") return false;
  if (scene.phase !== "CLOSING") return scene.remainingSeconds <= 0;
  return scene.cart.x <= 620 && !scene.cartAtShelf && !scene.movingCart && !scene.restockBusy;
}

function getContracts(day: LevelId): ContractDefinition[] {
  return DAY_CONTRACTS[normalizeDay(day)];
}

function getSelectedContract(day: LevelId): ContractDefinition {
  const contracts = getContracts(day);
  const selected = readValue(`${CONTRACT_STORAGE_PREFIX}${day}`);
  return contracts.find((contract) => contract.id === selected) ?? contracts[0];
}

function setSelectedContract(day: LevelId, id: ContractId): void {
  writeValue(`${CONTRACT_STORAGE_PREFIX}${day}`, id);
}

function resolvePlayableDay(): PlayableDay {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
    return "day01";
  } catch {
    return normalizeDay(gameSession.day);
  }
}

function normalizeDay(day: LevelId): PlayableDay {
  if (day === "day03") return "day03";
  if (day === "day02") return "day02";
  return "day01";
}

function writeContractResult(result: ContractResult): void {
  writeValue(LAST_CONTRACT_RESULT_KEY, JSON.stringify(result));
}

function readContractResult(): ContractResult | undefined {
  const raw = readValue(LAST_CONTRACT_RESULT_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as ContractResult;
  } catch {
    return undefined;
  }
}

function readValue(key: string): string | undefined {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeValue(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // The selected contract remains the default when storage is unavailable.
  }
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
