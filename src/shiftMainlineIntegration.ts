import Phaser from "phaser";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { gameSession } from "./systems/GameSession";

type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";

type RuntimeGameScene = Phaser.Scene & {
  phase: ShiftPhase;
  shiftEnded: boolean;
  soldCount: number;
  stocked: number;
  shelfSlots: unknown[];
  purchaseEvent?: Phaser.Time.TimerEvent;
  customerSequence: number;
  taskText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  __activeMainCustomers?: number;
  __day2CheckoutCount?: number;
  __day2ServiceResolved?: boolean;
  __day2DamageResolved?: boolean;
  __day2PromotionComplete?: boolean;
  startCustomerLoop: (delay: number) => void;
  updateHud: () => void;
};

type GamePrototype = {
  create: () => void;
  updateHud: () => void;
  customerPurchase: () => void;
};

type RuntimePromotionWing = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  objectiveText?: Phaser.GameObjects.Text;
  refreshHud: () => void;
};

type PromotionWingPrototype = {
  hideMainStore: () => void;
  restoreMainStore: () => void;
  refreshHud: () => void;
};

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = gamePrototype.create;
const originalUpdateHud = gamePrototype.updateHud;
const originalCustomerPurchase = gamePrototype.customerPurchase;

gamePrototype.create = function createWithShiftMainline(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  scene.__activeMainCustomers = 0;
  scene.__day2CheckoutCount = 0;
  scene.__day2ServiceResolved = false;
  scene.__day2DamageResolved = false;
  scene.__day2PromotionComplete = false;
  scene.updateHud();
};

gamePrototype.customerPurchase = function purchaseWithCustomerLimit(): void {
  const scene = this as unknown as RuntimeGameScene;

  // Room 2 owns the customer flow while it is visible. Keeping the hidden main
  // store loop alive was consuming stock and sales behind the player's back.
  if (gameSession.day === "day02" && scene.scene.isActive("promotion-wing")) return;
  if ((scene.__activeMainCustomers ?? 0) >= 2) return;

  const sequenceBefore = scene.customerSequence;
  originalCustomerPurchase.call(this);
  if (scene.customerSequence === sequenceBefore) return;

  scene.__activeMainCustomers = (scene.__activeMainCustomers ?? 0) + 1;
  scene.time.delayedCall(1_700, () => {
    scene.__activeMainCustomers = Math.max(0, (scene.__activeMainCustomers ?? 1) - 1);
  });
};

gamePrototype.updateHud = function updateGuidedShiftTask(): void {
  originalUpdateHud.call(this);
  const scene = this as unknown as RuntimeGameScene;
  const task = resolveMainlineTask(scene);
  if (!task) return;

  scene.taskText.setText(task.title);
  scene.hintText.setText(task.instruction);
};

const wingPrototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;
const originalHideMainStore = wingPrototype.hideMainStore;
const originalRestoreMainStore = wingPrototype.restoreMainStore;
const originalRefreshWingHud = wingPrototype.refreshHud;

wingPrototype.hideMainStore = function hideMainStoreAndPauseCustomers(): void {
  originalHideMainStore.call(this);
  const wing = this as unknown as RuntimePromotionWing;
  wing.gameScene?.purchaseEvent?.remove(false);
  if (wing.gameScene) wing.gameScene.purchaseEvent = undefined;
};

wingPrototype.restoreMainStore = function restoreMainStoreCustomerFlow(): void {
  originalRestoreMainStore.call(this);
  const wing = this as unknown as RuntimePromotionWing;
  const game = wing.gameScene;
  if (!game || game.shiftEnded || (game.phase !== "OPEN" && game.phase !== "RUSH")) return;

  const pace = game.phase === "RUSH"
    ? LEVELS[gameSession.day].customerIntervalsMs.rush
    : LEVELS[gameSession.day].customerIntervalsMs.open;
  game.startCustomerLoop(pace);
};

wingPrototype.refreshHud = function refreshPromotionMainlineHud(): void {
  originalRefreshWingHud.call(this);
  const wing = this as unknown as RuntimePromotionWing;
  const game = wing.gameScene;
  if (!game || !wing.objectiveText) return;

  const task = resolveDayTwoPromotionTask(game);
  wing.objectiveText.setText(task.title);
};

function resolveMainlineTask(scene: RuntimeGameScene): { title: string; instruction: string } | undefined {
  if (scene.shiftEnded || scene.phase === "RESULT") return undefined;

  if (gameSession.day === "day01") {
    if (scene.phase === "PREPARE") {
      return {
        title: `STEP 1/4 · STOCK THE DRINK SHELF · ${scene.stocked}/${scene.shelfSlots.length}`,
        instruction: "LOAD BOXES → MOVE CART RIGHT → TAP THE MATCHING EMPTY SHELF"
      };
    }
    if (scene.phase === "OPEN") {
      return {
        title: `STEP 2/4 · SERVE OPENING CUSTOMERS · ${scene.soldCount}/2`,
        instruction: "WATCH THE SHELF · RESTOCK ONLY WHEN A PRODUCT SELLS"
      };
    }
    if (scene.phase === "RUSH") {
      return {
        title: `STEP 3/4 · FINISH THE CUSTOMER WAVE · ${scene.soldCount}/4`,
        instruction: "ONLY TWO CUSTOMERS ENTER AT ONCE · KEEP THE SHELF AVAILABLE"
      };
    }
    return {
      title: "STEP 4/4 · CLOSE THE STORE",
      instruction: "DRAG THE CART LEFT INTO THE BACKROOM"
    };
  }

  if (gameSession.day === "day02") {
    if (scene.phase === "PREPARE") {
      return {
        title: `STEP 1/6 · PREPARE THE MAIN STORE · ${scene.stocked}/${scene.shelfSlots.length}`,
        instruction: "FINISH THE OPENING SHELF BEFORE THE PROMOTION ROOM UNLOCKS"
      };
    }

    if (scene.phase === "CLOSING") {
      return {
        title: "FINAL STEP · COMPLETE THE CLOSING CHECK",
        instruction: "RETURN THE CART TO THE BACKROOM"
      };
    }

    if (scene.__day2PromotionComplete) {
      return {
        title: "PROMOTION SHIFT COMPLETE",
        instruction: "RETURN TO THE MAIN STORE AND FINISH CLOSING"
      };
    }

    if (!scene.scene.isActive("promotion-wing")) {
      return {
        title: "STEP 2/6 · ENTER THE PROMOTION WING",
        instruction: "OPEN ROOM 2/2 AND START THE CONTROLLED PROMOTION SHIFT"
      };
    }

    return resolveDayTwoPromotionTask(scene);
  }

  return undefined;
}

function resolveDayTwoPromotionTask(scene: RuntimeGameScene): { title: string; instruction: string } {
  const checkoutCount = scene.__day2CheckoutCount ?? 0;

  if (checkoutCount < 3) {
    return {
      title: `STEP 3/6 · CHECK OUT PROMOTION CUSTOMERS · ${checkoutCount}/3`,
      instruction: "KEEP PROMO STOCK AVAILABLE → TAP CASH REGISTER WHEN A CUSTOMER QUEUES"
    };
  }

  if (!scene.__day2ServiceResolved) {
    return {
      title: "STEP 4/6 · HANDLE THE CUSTOMER RETURN",
      instruction: "CUSTOMERS ARE PAUSED · TAP THE SERVICE DESK REQUEST"
    };
  }

  if (checkoutCount < 5) {
    return {
      title: `STEP 5/6 · CONTINUE THE PROMOTION SHIFT · ${checkoutCount - 3}/2`,
      instruction: "SERVE TWO MORE CUSTOMERS · KEEP THE QUEUE BELOW TWO"
    };
  }

  if (!scene.__day2DamageResolved) {
    return {
      title: "STEP 6/6 · REMOVE THE DAMAGED ITEM",
      instruction: "CUSTOMERS ARE PAUSED · TAP THE DAMAGED GOODS BIN"
    };
  }

  if (checkoutCount < 6) {
    return {
      title: "FINAL CUSTOMER · CHECKOUT 5/6",
      instruction: "SERVE ONE FINAL CUSTOMER TO COMPLETE THE PROMOTION SHIFT"
    };
  }

  return {
    title: "PROMOTION SHIFT COMPLETE · 6/6",
    instruction: "RETURNING TO THE MAIN STORE"
  };
}
