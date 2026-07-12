import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";
import type { ShiftResult } from "./systems/StorefrontProgress";

const CONTRACT_KEY = "supermarket.shiftContract.day03";
const RESULT_KEY = "supermarket.lastSupervisorContractResult";

type SupervisorContractId = "equipment-recovery" | "service-lead" | "rush-control";

type SupervisorContract = {
  id: SupervisorContractId;
  title: string;
  description: string;
  progressLabel: string;
  reward: number;
};

type SupervisorContractResult = {
  id: SupervisorContractId;
  title: string;
  passed: boolean;
  reward: number;
};

const CONTRACTS: SupervisorContract[] = [
  {
    id: "equipment-recovery",
    title: "EQUIPMENT RECOVERY",
    description: "Restore the live checkout failure before completing the supervisor shift.",
    progressLabel: "Restore the failed register",
    reward: 50
  },
  {
    id: "service-lead",
    title: "SERVICE LEAD",
    description: "Successfully satisfy at least two customers through waiting or substitute decisions.",
    progressLabel: "Satisfy 2 service customers",
    reward: 45
  },
  {
    id: "rush-control",
    title: "RUSH CONTROL",
    description: "Complete all eight sales without losing a customer to unavailable stock.",
    progressLabel: "8 sales · 0 missed sales",
    reward: 55
  }
];

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  showToast: (message: string) => void;
};

type StorefrontPrototype = {
  createLobbyView: () => void;
  createResultView: (result: ShiftResult) => void;
  showToast: (message: string) => void;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  remainingSeconds: number;
  soldCount: number;
  cart: Phaser.GameObjects.Container;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  __day3EquipmentResolved?: boolean;
  __contractRewarded?: boolean;
  __contractPanel?: Phaser.GameObjects.Container;
  __supervisorContractRewarded?: boolean;
  __supervisorContractPanel?: Phaser.GameObjects.Container;
  __supervisorContractProgress?: Phaser.GameObjects.Text;
  __supervisorContractReward?: Phaser.GameObjects.Text;
};

type GamePrototype = {
  create: () => void;
  endShift: () => void;
};

installSupervisorStorefrontContract();
installSupervisorGameplayContract();

function installSupervisorStorefrontContract(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalLobby = prototype.createLobbyView;
  const originalResult = prototype.createResultView;
  const originalShowToast = prototype.showToast;

  prototype.createLobbyView = function createLobbyWithSupervisorContract(): void {
    originalLobby.call(this);
    if (readActiveDay() !== "day03") return;
    createSupervisorContractBoard(this as unknown as RuntimeStorefront);
  };

  prototype.createResultView = function createResultWithSupervisorContract(result: ShiftResult): void {
    originalResult.call(this, result);
    if (result.day !== "day03") return;
    createSupervisorContractResult(this as unknown as RuntimeStorefront);
  };

  prototype.showToast = function showSupervisorContractPicker(message: string): void {
    if (message.startsWith("CONTRACT") && readActiveDay() === "day03") {
      openSupervisorContractPicker(this as unknown as RuntimeStorefront);
      return;
    }
    originalShowToast.call(this, message);
  };
}

function installSupervisorGameplayContract(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;
  const originalEndShift = prototype.endShift;

  prototype.create = function createWithSupervisorContract(): void {
    originalCreate.call(this);
    const scene = this as unknown as RuntimeGame;
    if (gameSession.day !== "day03") return;

    scene.__contractPanel?.destroy(true);
    scene.__contractPanel = undefined;
    scene.__contractRewarded = true;
    scene.__supervisorContractRewarded = false;
    createSupervisorGameplayPanel(scene);

    let lastRefresh = 0;
    const refresh = (): void => {
      if (scene.time.now - lastRefresh < 180) return;
      lastRefresh = scene.time.now;
      refreshSupervisorGameplayPanel(scene);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, refresh);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, refresh);
      scene.__supervisorContractPanel?.destroy(true);
      scene.__supervisorContractPanel = undefined;
    });
  };

  prototype.endShift = function endShiftWithSupervisorContract(): void {
    const scene = this as unknown as RuntimeGame;
    if (
      gameSession.day === "day03" &&
      !scene.__supervisorContractRewarded &&
      canFinalizeShift(scene)
    ) {
      scene.__supervisorContractRewarded = true;
      const contract = selectedContract();
      const passed = evaluateSupervisorContract(scene, contract);
      const reward = passed ? contract.reward : 0;
      if (reward > 0) gameSession.earnCoins(reward);
      writeResult({
        id: contract.id,
        title: contract.title,
        passed,
        reward
      });
      refreshSupervisorGameplayPanel(scene, true);
    }
    originalEndShift.call(this);
  };
}

function createSupervisorContractBoard(scene: RuntimeStorefront): void {
  const contract = selectedContract();
  const panel = scene.add.rectangle(300, 625, 500, 430, 0x10252a, 1)
    .setStrokeStyle(6, 0xffd75a)
    .setDepth(30);
  const eyebrow = scene.add.text(300, 455, "DAY 3 · SUPERVISOR CONTRACT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(31);
  const title = scene.add.text(300, 520, contract.title, {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 420 }
  }).setOrigin(0.5).setDepth(31);
  const description = scene.add.text(300, 625, contract.description, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#d9e8e2",
    align: "center",
    lineSpacing: 8,
    wordWrap: { width: 410 }
  }).setOrigin(0.5).setDepth(31);
  const reward = scene.add.text(300, 730, `SUPERVISOR BONUS  +${contract.reward} COINS`, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#fff2a8",
    fontStyle: "bold",
    backgroundColor: "#6c4d17",
    padding: { x: 16, y: 10 }
  }).setOrigin(0.5).setDepth(31);
  const buttonBackground = scene.add.rectangle(300, 835, 310, 76, 0x315f7d, 1)
    .setStrokeStyle(4, 0x9fcbe8)
    .setDepth(31)
    .setInteractive({ useHandCursor: true });
  const buttonText = scene.add.text(300, 835, "CHOOSE CONTRACT", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(32);
  const open = (): void => openSupervisorContractPicker(scene);
  buttonBackground.on("pointerdown", open);
  buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", open);
  void panel;
  void eyebrow;
  void title;
  void description;
  void reward;
}

function openSupervisorContractPicker(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  const selected = selectedContract();
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.84)
    .setInteractive()
    .setDepth(2600);
  const panel = scene.add.rectangle(665, 590, 1100, 800, 0x10252a, 0.995)
    .setStrokeStyle(7, 0xffd75a)
    .setDepth(2601);
  const title = scene.add.text(665, 245, "CHOOSE A SUPERVISOR CONTRACT", {
    fontFamily: "Arial",
    fontSize: "39px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(2602);
  const subtitle = scene.add.text(665, 305, "Select one optional leadership target for this shift.", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#cfe0da"
  }).setOrigin(0.5).setDepth(2602);
  const objects: Phaser.GameObjects.GameObject[] = [shade, panel, title, subtitle];

  CONTRACTS.forEach((contract, index) => {
    const x = 345 + index * 320;
    const active = contract.id === selected.id;
    const card = scene.add.rectangle(x, 585, 285, 420, active ? 0x315f4b : 0x173238, 1)
      .setStrokeStyle(5, active ? 0xd9efad : 0x617d82)
      .setDepth(2602);
    const contractTitle = scene.add.text(x, 430, contract.title, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 245 }
    }).setOrigin(0.5).setDepth(2603);
    const contractDescription = scene.add.text(x, 575, contract.description, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#d8e7e2",
      align: "center",
      lineSpacing: 8,
      wordWrap: { width: 235 }
    }).setOrigin(0.5).setDepth(2603);
    const reward = scene.add.text(x, 700, `+${contract.reward} COINS`, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffd75a",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(2603);
    const action = scene.add.text(x, 760, active ? "SELECTED" : "SELECT", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: active ? "#4f8b4c" : "#315f7d",
      padding: { x: 24, y: 11 }
    }).setOrigin(0.5).setDepth(2603);
    const hit = scene.add.rectangle(x, 585, 300, 440, 0xffffff, 0.001)
      .setDepth(2604)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      writeValue(CONTRACT_KEY, contract.id);
      scene.modal?.destroy(true);
      scene.modal = undefined;
      scene.scene.restart({ showResult: false });
    });
    objects.push(card, contractTitle, contractDescription, reward, action, hit);
  });

  const close = scene.add.text(665, 945, "CLOSE", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#34454a",
    padding: { x: 34, y: 13 }
  }).setOrigin(0.5).setDepth(2603).setInteractive({ useHandCursor: true });
  close.on("pointerdown", () => {
    scene.modal?.destroy(true);
    scene.modal = undefined;
  });
  objects.push(close);
  scene.modal = scene.add.container(0, 0, objects).setDepth(2600);
}

function createSupervisorGameplayPanel(scene: RuntimeGame): void {
  const contract = selectedContract();
  const background = scene.add.rectangle(0, 0, 490, 112, 0x102a2f, 0.97)
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
  const reward = scene.add.text(0, 35, `SUPERVISOR BONUS  +${contract.reward}`, {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#9fd0bd",
    fontStyle: "bold"
  }).setOrigin(0.5);
  scene.__supervisorContractProgress = progress;
  scene.__supervisorContractReward = reward;
  scene.__supervisorContractPanel = scene.add.container(335, 260, [background, title, progress, reward])
    .setDepth(86)
    .setScale(0.92);
  refreshSupervisorGameplayPanel(scene);
}

function refreshSupervisorGameplayPanel(scene: RuntimeGame, final = false): void {
  const contract = selectedContract();
  const state = supervisorProgress(scene, contract);
  scene.__supervisorContractProgress
    ?.setText(state.text)
    .setColor(state.complete ? "#a9ef9d" : state.failed ? "#ff9d91" : "#ffffff");
  scene.__supervisorContractReward?.setText(
    final
      ? state.complete
        ? `COMPLETE  +${contract.reward} COINS`
        : "CONTRACT FAILED · NO BONUS"
      : `SUPERVISOR BONUS  +${contract.reward}`
  );
}

function createSupervisorContractResult(scene: RuntimeStorefront): void {
  const result = readResult();
  if (!result) return;
  const panel = scene.add.rectangle(320, 660, 500, 240, result.passed ? 0x193c2d : 0x492c2a, 1)
    .setStrokeStyle(6, result.passed ? 0x9bd58f : 0xd98778)
    .setDepth(35);
  const eyebrow = scene.add.text(320, 585, "SUPERVISOR CONTRACT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: result.passed ? "#bceead" : "#ffc0b5",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(36);
  const title = scene.add.text(320, 635, result.title, {
    fontFamily: "Arial",
    fontSize: "26px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 430 }
  }).setOrigin(0.5).setDepth(36);
  const status = scene.add.text(320, 710, result.passed ? "CONTRACT COMPLETE" : "CONTRACT FAILED", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: result.passed ? "#a9ef9d" : "#ff9d91",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(36);
  const reward = scene.add.text(320, 765, result.passed ? `BONUS PAID  +${result.reward} COINS` : "NO BONUS PAID", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff2a8",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(36);
  void panel;
  void eyebrow;
  void title;
  void status;
  void reward;
}

function supervisorProgress(
  scene: RuntimeGame,
  contract: SupervisorContract
): { text: string; complete: boolean; failed: boolean } {
  const snapshot = gameSession.snapshot;
  if (contract.id === "equipment-recovery") {
    const complete = Boolean(scene.__day3EquipmentResolved);
    return {
      text: complete ? "REGISTER RESTORED  ✓" : "REGISTER RECOVERY  ○",
      complete,
      failed: scene.phase === "CLOSING" && !complete
    };
  }
  if (contract.id === "service-lead") {
    const count = snapshot.satisfiedCustomers;
    return {
      text: `SATISFIED CUSTOMERS  ${Math.min(2, count)}/2`,
      complete: count >= 2,
      failed: false
    };
  }
  const complete = scene.soldCount >= 8 && snapshot.missedSales === 0;
  return {
    text: `SALES ${Math.min(8, scene.soldCount)}/8 · MISSED ${snapshot.missedSales}`,
    complete,
    failed: snapshot.missedSales > 0
  };
}

function evaluateSupervisorContract(scene: RuntimeGame, contract: SupervisorContract): boolean {
  return supervisorProgress(scene, contract).complete;
}

function selectedContract(): SupervisorContract {
  const selected = readValue(CONTRACT_KEY);
  return CONTRACTS.find((contract) => contract.id === selected) ?? CONTRACTS[0];
}

function canFinalizeShift(scene: RuntimeGame): boolean {
  if (scene.shiftEnded || scene.phase === "RESULT") return false;
  if (scene.phase !== "CLOSING") return scene.remainingSeconds <= 0;
  return scene.cart.x <= 620 && !scene.cartAtShelf && !scene.movingCart && !scene.restockBusy;
}

function readActiveDay(): string {
  try {
    return globalThis.localStorage?.getItem("supermarket.activeDay") ?? "day01";
  } catch {
    return "day01";
  }
}

function writeResult(result: SupervisorContractResult): void {
  writeValue(RESULT_KEY, JSON.stringify(result));
}

function readResult(): SupervisorContractResult | undefined {
  const raw = readValue(RESULT_KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as SupervisorContractResult;
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
    // Storage is optional. The current shift still uses the default contract.
  }
}
