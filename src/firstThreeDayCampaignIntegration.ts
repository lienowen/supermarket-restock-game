import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";
import { bestStarsFor } from "./systems/StorefrontProgress";

type PlayableDay = Extract<LevelId, "day01" | "day02" | "day03">;
type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";

type CampaignDefinition = {
  role: string;
  title: string;
  promise: string;
  duties: string[];
  selectorDuties: string[];
};

const CAMPAIGN: Record<PlayableDay, CampaignDefinition> = {
  day01: {
    role: "STOCK ASSOCIATE",
    title: "OPENING ROUTINE",
    promise: "Learn one complete opening shift from delivery bay to locked doors.",
    duties: [
      "Clock in and receive the delivery",
      "Unload and verify the delivery note",
      "Move stock into the backroom",
      "Fill every opening shelf position",
      "Test checkout and open the doors",
      "Serve 4 customers, refill 1 live gap and close"
    ],
    selectorDuties: ["Receive stock", "Open safely", "Live restock"]
  },
  day02: {
    role: "PROMOTION & CHECKOUT",
    title: "PROMOTION OPERATIONS",
    promise: "Run a second selling area while protecting checkout and customer service.",
    duties: [
      "Clock in and receive promotion inventory",
      "Stock the main drinks section",
      "Allocate stock to the promotion wing",
      "Operate checkout for the first 3 customers",
      "Process a return and remove damaged goods",
      "Complete the final checkout and close both areas"
    ],
    selectorDuties: ["Allocate promotion", "Operate checkout", "Handle return"]
  },
  day03: {
    role: "SHIFT SUPERVISOR",
    title: "SUPERVISOR SHIFT",
    promise: "Inspect the store, manage service decisions and recover a live equipment fault.",
    duties: [
      "Review the shift plan and delivery",
      "Walk the aisles for safety",
      "Check the cold case temperature",
      "Test checkout and authorize opening",
      "Manage waiting customers and substitutes",
      "Restore failed equipment, finish the rush and close"
    ],
    selectorDuties: ["Inspect the floor", "Manage service", "Restore equipment"]
  }
};

const ACTIVE_DAY_KEY = "supermarket.activeDay";

type RuntimeOpening = Phaser.Scene & {
  __campaignBriefingAccepted?: boolean;
  __campaignBriefing?: Phaser.GameObjects.Container;
};

type OpeningPrototype = {
  create: () => void;
  finishOpening: () => void;
};

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  showToast: (message: string) => void;
};

type StorefrontPrototype = {
  createLobbyView: () => void;
  openDaySelector: () => void;
  startShift: (day: LevelId) => void;
  setActiveDay: (day: LevelId) => void;
};

type RuntimeSlot = {
  product?: Phaser.GameObjects.Image;
};

type PausedProgressionState = {
  scene: Phaser.Scene;
  timePaused: boolean;
  inputEnabled: boolean;
};

type RuntimeGame = Phaser.Scene & {
  phase: ShiftPhase;
  shiftEnded: boolean;
  stocked: number;
  soldCount: number;
  shelfSlots: RuntimeSlot[];
  taskText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  purchaseEvent?: Phaser.Time.TimerEvent;
  __doorsUnlocked?: boolean;
  __registerChecked?: boolean;
  __day2ServiceResolved?: boolean;
  __day2DamageResolved?: boolean;
  __campaignLiveRestocks?: number;
  __campaignClosingGate?: boolean;
  __campaignDutyStrip?: Phaser.GameObjects.Container;
  __campaignDutyText?: Phaser.GameObjects.Text;
  __campaignInspectionDone?: boolean;
  __campaignInspectionPanel?: Phaser.GameObjects.Container;
  __campaignEquipmentTriggered?: boolean;
  __day3EquipmentResolved?: boolean;
  __campaignIncidentPanel?: Phaser.GameObjects.Container;
  __campaignPausedProgression?: PausedProgressionState;
  startCustomerLoop: (delay: number) => void;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
  updateHud: () => void;
};

type GamePrototype = {
  create: () => void;
  updateHud: () => void;
  openStore: () => void;
  advanceBusinessPhase: () => void;
  recordRestockCombo: () => void;
};

installOpeningBriefings();
installCampaignStorefront();
installCampaignGameplay();

function installOpeningBriefings(): void {
  const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
  const originalCreate = prototype.create;
  const originalFinish = prototype.finishOpening;

  prototype.create = function createWithEmployeeBriefing(): void {
    const scene = this as unknown as RuntimeOpening;
    scene.__campaignBriefingAccepted = false;
    scene.__campaignBriefing = undefined;
    originalCreate.call(this);
    createEmployeeBriefing(scene, readActiveDay());
  };

  prototype.finishOpening = function finishAfterBriefingAccepted(): void {
    const scene = this as unknown as RuntimeOpening;
    if (!scene.__campaignBriefingAccepted) {
      scene.cameras.main.shake(90, 0.002);
      return;
    }
    originalFinish.call(this);
  };
}

function createEmployeeBriefing(scene: RuntimeOpening, day: PlayableDay): void {
  const definition = CAMPAIGN[day];
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.9)
    .setInteractive()
    .setDepth(2000);
  const panel = scene.add.rectangle(665, 585, 1040, 850, 0x10252a, 0.995)
    .setStrokeStyle(8, 0xffd75a)
    .setDepth(2001);
  const dayText = scene.add.text(665, 225, `DAY ${Number(day.slice(-2))} · ${definition.role}`, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 3
  }).setOrigin(0.5).setDepth(2002);
  const title = scene.add.text(665, 290, definition.title, {
    fontFamily: "Arial",
    fontSize: "48px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(2002);
  const promise = scene.add.text(665, 355, definition.promise, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#cfe0da",
    align: "center",
    wordWrap: { width: 850 }
  }).setOrigin(0.5).setDepth(2002);
  const heading = scene.add.text(320, 425, "TODAY'S DUTY PLAN", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#9fd0bd",
    fontStyle: "bold",
    letterSpacing: 2
  }).setDepth(2002);
  const dutyText = scene.add.text(320, 475, definition.duties.map((duty, index) => `${index + 1}.  ${duty}`).join("\n"), {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#ffffff",
    lineSpacing: 17,
    wordWrap: { width: 720 }
  }).setDepth(2002);
  const startBackground = scene.add.rectangle(0, 0, 470, 92, 0x4f8b4c, 1)
    .setStrokeStyle(5, 0xbfe5a6)
    .setInteractive({ useHandCursor: true });
  const startText = scene.add.text(0, 0, day === "day03" ? "CLOCK IN AS SUPERVISOR" : "CLOCK IN & START DUTY", {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const start = scene.add.container(665, 930, [startBackground, startText]).setDepth(2003);

  const begin = (): void => {
    if (scene.__campaignBriefingAccepted) return;
    scene.__campaignBriefingAccepted = true;
    startBackground.disableInteractive();
    startText.setText("CLOCKED IN");
    scene.tweens.add({
      targets: scene.__campaignBriefing,
      alpha: 0,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 180,
      onComplete: () => {
        scene.__campaignBriefing?.destroy(true);
        scene.__campaignBriefing = undefined;
        (OpeningScene.prototype as unknown as OpeningPrototype).finishOpening.call(scene);
      }
    });
  };
  startBackground.on("pointerdown", begin);
  startText.setInteractive({ useHandCursor: true }).on("pointerdown", begin);

  scene.__campaignBriefing = scene.add.container(0, 0, [
    shade,
    panel,
    dayText,
    title,
    promise,
    heading,
    dutyText,
    start
  ]).setDepth(2000).setAlpha(0).setScale(0.985);
  scene.tweens.add({
    targets: scene.__campaignBriefing,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 220,
    ease: "Back.Out"
  });
}

function installCampaignStorefront(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalLobby = prototype.createLobbyView;
  const originalStartShift = prototype.startShift;

  prototype.createLobbyView = function createLobbyWithRoleCard(): void {
    originalLobby.call(this);
    const scene = this as unknown as RuntimeStorefront;
    createRoleCard(scene, readActiveDay());
  };

  prototype.openDaySelector = function openMatureThreeDaySelector(): void {
    const scene = this as unknown as RuntimeStorefront;
    if (scene.modal?.active) return;

    const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.84)
      .setInteractive()
      .setDepth(2200);
    const panel = scene.add.rectangle(665, 585, 1160, 780, 0x10252a, 0.995)
      .setStrokeStyle(7, 0x78a465)
      .setDepth(2201);
    const title = scene.add.text(665, 235, "EMPLOYEE CAREER · SELECT A SHIFT", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(2202);
    const subtitle = scene.add.text(665, 290, "Each day adds one professional responsibility. Later systems stay locked until the job is learned.", {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#cfe0da",
      align: "center",
      wordWrap: { width: 980 }
    }).setOrigin(0.5).setDepth(2202);

    const cards = (["day01", "day02", "day03"] as PlayableDay[]).map((day, index) =>
      createCampaignDayCard(scene, day, 335 + index * 330, 600)
    );
    const close = scene.add.text(665, 955, "CLOSE", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#34454a",
      padding: { x: 34, y: 13 }
    }).setOrigin(0.5).setDepth(2203).setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => {
      scene.modal?.destroy(true);
      scene.modal = undefined;
    });

    scene.modal = scene.add.container(0, 0, [shade, panel, title, subtitle, ...cards, close]).setDepth(2200);
  };

  prototype.startShift = function startOnlyUnlockedCampaignDay(day: LevelId): void {
    const scene = this as unknown as RuntimeStorefront;
    const playable = normalizeDay(day);
    if (!isDayUnlocked(playable)) {
      const previous = playable === "day03" ? "DAY 2" : "DAY 1";
      scene.showToast(`${playable.toUpperCase()} is locked. Complete ${previous} first.`);
      return;
    }
    originalStartShift.call(this, playable);
  };
}

function createRoleCard(scene: RuntimeStorefront, day: PlayableDay): void {
  const definition = CAMPAIGN[day];
  const unlocked = isDayUnlocked(day);
  const panel = scene.add.rectangle(300, 250, 500, 245, 0x10252a, 0.95)
    .setStrokeStyle(5, unlocked ? 0x78a465 : 0x657174)
    .setDepth(12);
  const eyebrow = scene.add.text(300, 165, `CURRENT ROLE · ${definition.role}`, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffd75a",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(13);
  const title = scene.add.text(300, 210, definition.title, {
    fontFamily: "Arial",
    fontSize: "30px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(13);
  const flow = scene.add.text(300, 285, definition.selectorDuties.join("  →  "), {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#d8e7df",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 430 }
  }).setOrigin(0.5).setDepth(13);
  const status = scene.add.text(300, 340, bestStarsFor(day) > 0 ? "TRAINED · REPLAY WITH CONTRACTS" : "NEW TRAINING SHIFT", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: bestStarsFor(day) > 0 ? "#bfe88a" : "#ffd98a",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(13);
  void panel;
  void eyebrow;
  void title;
  void flow;
  void status;
}

function createCampaignDayCard(
  scene: RuntimeStorefront,
  day: PlayableDay,
  x: number,
  y: number
): Phaser.GameObjects.Container {
  const definition = CAMPAIGN[day];
  const stars = bestStarsFor(day);
  const selected = readActiveDay() === day;
  const unlocked = isDayUnlocked(day);

  const background = scene.add.rectangle(0, 0, 300, 470, unlocked ? (selected ? 0x315f4b : 0x20343a) : 0x151d1f, 1)
    .setStrokeStyle(5, unlocked ? (selected ? 0xc7e78b : 0x6e858b) : 0x596366);
  const dayText = scene.add.text(0, -190, `DAY ${Number(day.slice(-2))}`, {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#f7e8a9",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const role = scene.add.text(0, -145, definition.role, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#9fd0bd",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 260 }
  }).setOrigin(0.5);
  const title = scene.add.text(0, -95, definition.title, {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 260 }
  }).setOrigin(0.5);
  const duties = scene.add.text(0, 25, definition.selectorDuties.map((duty) => `• ${duty}`).join("\n"), {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#dce9e5",
    lineSpacing: 11,
    align: "left"
  }).setOrigin(0.5);
  const starText = scene.add.text(0, 125, `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, {
    fontFamily: "Arial",
    fontSize: "30px",
    color: "#ffcc3f",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const action = scene.add.text(0, 190, unlocked ? (selected ? "SELECTED" : stars > 0 ? "REPLAY" : "START TRAINING") : "LOCKED", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: unlocked ? (selected ? "#4b7b55" : "#315f7d") : "#4a5355",
    padding: { x: 19, y: 10 }
  }).setOrigin(0.5);
  const lockReason = !unlocked
    ? scene.add.text(0, 155, day === "day03" ? "COMPLETE DAY 2" : "COMPLETE DAY 1", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffd98a",
        fontStyle: "bold"
      }).setOrigin(0.5)
    : undefined;
  const hit = scene.add.rectangle(0, 0, 320, 490, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
  const children: Phaser.GameObjects.GameObject[] = [background, dayText, role, title, duties, starText, action, hit];
  if (lockReason) children.splice(children.length - 1, 0, lockReason);
  const card = scene.add.container(x, y, children).setDepth(2202);

  hit.on("pointerover", () => card.setScale(1.02));
  hit.on("pointerout", () => card.setScale(1));
  hit.on("pointerdown", () => {
    if (!unlocked) {
      scene.showToast(day === "day03" ? "Complete Day 2 to qualify as Shift Supervisor." : "Complete Day 1 to unlock promotion duties.");
      return;
    }
    (StorefrontScene.prototype as unknown as StorefrontPrototype).setActiveDay.call(scene, day);
    scene.modal?.destroy(true);
    scene.modal = undefined;
    scene.scene.restart({ showResult: false });
  });
  return card;
}

function installCampaignGameplay(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;
  const originalUpdateHud = prototype.updateHud;
  const originalOpenStore = prototype.openStore;
  const originalAdvance = prototype.advanceBusinessPhase;
  const originalRestockCombo = prototype.recordRestockCombo;

  prototype.create = function createWithCampaignDuties(): void {
    originalCreate.call(this);
    const scene = this as unknown as RuntimeGame;
    scene.__campaignLiveRestocks = 0;
    scene.__campaignClosingGate = false;
    scene.__campaignInspectionDone = false;
    scene.__campaignEquipmentTriggered = false;
    scene.__day3EquipmentResolved = false;
    createDutyStrip(scene);

    let lastSync = 0;
    const monitor = (): void => {
      if (scene.time.now - lastSync < 160) return;
      lastSync = scene.time.now;
      syncDutyStrip(scene);
      if (
        gameSession.day === "day03" &&
        scene.phase === "RUSH" &&
        scene.soldCount >= LEVELS.day03.salesTargets.openToRush &&
        !scene.__campaignEquipmentTriggered &&
        !scene.shiftEnded
      ) {
        startDay3EquipmentIncident(scene, () => originalAdvance.call(scene));
      }
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
      restoreProgressionScene(scene);
      scene.__campaignDutyStrip?.destroy(true);
      scene.__campaignInspectionPanel?.destroy(true);
      scene.__campaignIncidentPanel?.destroy(true);
    });
    syncDutyStrip(scene);
  };

  prototype.updateHud = function updateHudWithCampaignIdentity(): void {
    originalUpdateHud.call(this);
    syncDutyStrip(this as unknown as RuntimeGame);
  };

  prototype.openStore = function openStoreWithSupervisorInspection(): void {
    const scene = this as unknown as RuntimeGame;
    if (gameSession.day !== "day03") {
      originalOpenStore.call(this);
      return;
    }
    if (scene.__campaignInspectionDone) {
      scene.__registerChecked = true;
      scene.__doorsUnlocked = true;
      originalOpenStore.call(this);
      return;
    }
    if (!scene.__campaignInspectionPanel?.active) showSupervisorInspection(scene);
  };

  prototype.advanceBusinessPhase = function advanceWithProfessionalClosingGates(): void {
    const scene = this as unknown as RuntimeGame;
    if (
      gameSession.day === "day01" &&
      scene.phase === "RUSH" &&
      scene.soldCount >= LEVELS.day01.salesTargets.rushToClosing &&
      (scene.__campaignLiveRestocks ?? 0) < 1
    ) {
      scene.purchaseEvent?.remove(false);
      scene.purchaseEvent = undefined;
      scene.__campaignClosingGate = true;
      scene.showPhaseBanner("FINAL FLOOR DUTY");
      scene.showTransientHint("Before closing, refill one shelf position emptied during trading.");
      scene.updateHud();
      return;
    }
    if (
      gameSession.day === "day03" &&
      scene.phase === "RUSH" &&
      scene.soldCount >= LEVELS.day03.salesTargets.rushToClosing &&
      !scene.__day3EquipmentResolved
    ) {
      if (!scene.__campaignEquipmentTriggered) startDay3EquipmentIncident(scene, () => originalAdvance.call(scene));
      return;
    }
    originalAdvance.call(this);
  };

  prototype.recordRestockCombo = function recordCampaignLiveRestock(): void {
    const scene = this as unknown as RuntimeGame;
    const live = scene.phase === "OPEN" || scene.phase === "RUSH";
    originalRestockCombo.call(this);
    if (!live || gameSession.day !== "day01") return;

    scene.__campaignLiveRestocks = (scene.__campaignLiveRestocks ?? 0) + 1;
    if (scene.__campaignClosingGate && scene.soldCount >= LEVELS.day01.salesTargets.rushToClosing) {
      scene.__campaignClosingGate = false;
      scene.showPhaseBanner("FLOOR READY TO CLOSE");
      originalAdvance.call(this);
    }
  };
}

function createDutyStrip(scene: RuntimeGame): void {
  const background = scene.add.rectangle(0, 0, 820, 52, 0x10252a, 0.96)
    .setStrokeStyle(3, 0xffd75a);
  const text = scene.add.text(0, 0, "", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);
  scene.__campaignDutyText = text;
  scene.__campaignDutyStrip = scene.add.container(665, 1035, [background, text]).setDepth(84);
}

function syncDutyStrip(scene: RuntimeGame): void {
  if (!scene.__campaignDutyText?.active) return;
  const day = normalizeDay(gameSession.day);
  const duty = resolveDuty(scene, day);
  scene.__campaignDutyText.setText(`DAY ${Number(day.slice(-2))} · ${CAMPAIGN[day].role} · DUTY ${duty.step}/6 · ${duty.label}`);
  scene.taskText?.setText(`DAY ${Number(day.slice(-2))} · DUTY ${duty.step}/6 · ${duty.label}`);

  if (scene.__campaignClosingGate) {
    scene.hintText?.setText("FINAL DUTY · Refill one live empty shelf before returning the cart and closing");
  } else if (scene.__campaignIncidentPanel?.active) {
    scene.hintText?.setText("SUPERVISOR INCIDENT · Restore checkout equipment before trading continues");
  }
}

function resolveDuty(scene: RuntimeGame, day: PlayableDay): { step: number; label: string } {
  if (scene.phase === "RESULT" || scene.shiftEnded) return { step: 6, label: "SHIFT COMPLETE" };
  if (scene.phase === "CLOSING") return { step: 6, label: day === "day02" ? "CLOSE BOTH SELLING AREAS" : "FINAL WALK & LOCK DOORS" };

  if (day === "day01") {
    if (scene.phase === "PREPARE") {
      return scene.stocked < scene.shelfSlots.length
        ? { step: 3, label: "STOCK OPENING SHELVES" }
        : { step: 4, label: "TEST REGISTER & OPEN" };
    }
    if (scene.__campaignClosingGate) return { step: 6, label: "REFILL ONE LIVE GAP" };
    return scene.soldCount < 2
      ? { step: 5, label: "SERVE FIRST CUSTOMERS" }
      : { step: 5, label: "SERVE RUSH & WATCH EMPTY SHELVES" };
  }

  if (day === "day02") {
    if (scene.phase === "PREPARE") {
      return scene.stocked < scene.shelfSlots.length
        ? { step: 2, label: "PREPARE MAIN STORE" }
        : { step: 3, label: "OPEN PROMOTION OPERATIONS" };
    }
    if (scene.soldCount < 3) return { step: 4, label: "OPERATE CHECKOUT · 3 CUSTOMERS" };
    if (!scene.__day2ServiceResolved) return { step: 5, label: "PROCESS CUSTOMER RETURN" };
    if (scene.soldCount < 5) return { step: 5, label: "CHECKOUT · 2 MORE CUSTOMERS" };
    if (!scene.__day2DamageResolved) return { step: 5, label: "REMOVE DAMAGED GOODS" };
    return { step: 6, label: "FINAL CHECKOUT" };
  }

  if (scene.phase === "PREPARE") {
    if (scene.stocked < scene.shelfSlots.length) return { step: 2, label: "STOCK & WALK THE FLOOR" };
    if (!scene.__campaignInspectionDone) return { step: 3, label: "SUPERVISOR OPENING INSPECTION" };
    return { step: 4, label: "AUTHORIZE OPENING" };
  }
  if (scene.__campaignIncidentPanel?.active) return { step: 6, label: "RESTORE CHECKOUT EQUIPMENT" };
  if (scene.phase === "OPEN") return { step: 5, label: "OBSERVE FLOW & HANDLE REQUESTS" };
  return { step: 5, label: "MANAGE RUSH, WAITING & SUBSTITUTES" };
}

function showSupervisorInspection(scene: RuntimeGame): void {
  const checks = [
    "AISLE SAFETY WALK",
    "COLD CASE · 3°C",
    "REGISTER & PAYMENT TEST"
  ];
  let completed = 0;

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.75)
    .setInteractive()
    .setDepth(2300);
  const panel = scene.add.rectangle(665, 590, 850, 700, 0xf1ead9, 0.995)
    .setStrokeStyle(8, 0x4f7358)
    .setDepth(2301);
  const eyebrow = scene.add.text(665, 315, "DAY 3 · SHIFT SUPERVISOR", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#6c7b72",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(2302);
  const title = scene.add.text(665, 365, "OPENING INSPECTION", {
    fontFamily: "Arial",
    fontSize: "42px",
    color: "#263a30",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(2302);
  const subtitle = scene.add.text(665, 420, "A supervisor authorizes opening only after safety, temperature and checkout checks pass.", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#53645c",
    align: "center",
    wordWrap: { width: 720 }
  }).setOrigin(0.5).setDepth(2302);
  const checklist = scene.add.text(430, 500, checks.map((check) => `○  ${check}`).join("\n"), {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#2f4438",
    fontStyle: "bold",
    lineSpacing: 24
  }).setDepth(2302);
  const status = scene.add.text(665, 690, "READY FOR SAFETY WALK", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#7c5523",
    fontStyle: "bold",
    backgroundColor: "#f0dfb9",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(2302);
  const buttonBackground = scene.add.rectangle(0, 0, 440, 88, 0x315f7d, 1)
    .setStrokeStyle(4, 0x9fcbe8)
    .setInteractive({ useHandCursor: true });
  const buttonText = scene.add.text(0, 0, "CHECK AISLE SAFETY", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const button = scene.add.container(665, 820, [buttonBackground, buttonText]).setDepth(2303);

  const performCheck = (): void => {
    if (completed >= checks.length) return;
    completed += 1;
    checklist.setText(checks.map((check, index) => `${index < completed ? "✓" : "○"}  ${check}`).join("\n"));
    if (completed === 1) {
      status.setText("AISLES CLEAR · NO TRIP HAZARDS").setColor("#285331").setBackgroundColor("#cce8c7");
      buttonText.setText("CHECK COLD CASE");
      return;
    }
    if (completed === 2) {
      status.setText("COLD CASE HOLDING AT 3°C").setColor("#285331").setBackgroundColor("#cce8c7");
      buttonText.setText("TEST REGISTER & PAYMENT");
      return;
    }

    status.setText("ALL OPENING CHECKS PASSED").setColor("#285331").setBackgroundColor("#cce8c7");
    buttonText.setText("AUTHORIZE STORE OPENING");
    buttonBackground.setFillStyle(0x4f8b4c).setStrokeStyle(4, 0xbfe5a6);
    buttonBackground.removeAllListeners("pointerdown");
    buttonBackground.on("pointerdown", authorize);
  };

  const authorize = (): void => {
    buttonBackground.disableInteractive();
    scene.__campaignInspectionDone = true;
    scene.__registerChecked = true;
    scene.__doorsUnlocked = true;
    scene.showPhaseBanner("OPENING AUTHORIZED");
    scene.__campaignInspectionPanel?.destroy(true);
    scene.__campaignInspectionPanel = undefined;
    scene.openStore();
  };

  buttonBackground.on("pointerdown", performCheck);
  buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
    if (completed >= checks.length) authorize();
    else performCheck();
  });

  scene.__campaignInspectionPanel = scene.add.container(0, 0, [
    shade,
    panel,
    eyebrow,
    title,
    subtitle,
    checklist,
    status,
    button
  ]).setDepth(2300);
}

function startDay3EquipmentIncident(scene: RuntimeGame, continuePhase: () => void): void {
  if (scene.__campaignEquipmentTriggered || scene.shiftEnded) return;
  scene.__campaignEquipmentTriggered = true;
  scene.purchaseEvent?.remove(false);
  scene.purchaseEvent = undefined;
  pauseProgressionScene(scene);
  scene.showPhaseBanner("REGISTER FAULT");

  const steps = ["RESTART BARCODE SCANNER", "TEST PAYMENT TERMINAL", "PRINT TEST RECEIPT"];
  let completed = 0;
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.68)
    .setInteractive()
    .setDepth(2400);
  const panel = scene.add.rectangle(665, 590, 820, 650, 0xf1ead9, 0.995)
    .setStrokeStyle(8, 0xd68b48)
    .setDepth(2401);
  const eyebrow = scene.add.text(665, 330, "LIVE SUPERVISOR INCIDENT", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#9a5b28",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(2402);
  const title = scene.add.text(665, 385, "CHECKOUT OFFLINE", {
    fontFamily: "Arial",
    fontSize: "43px",
    color: "#5b3327",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(2402);
  const subtitle = scene.add.text(665, 445, "New customers are paused. Restore the register in the correct operational sequence.", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#5b625e",
    align: "center",
    wordWrap: { width: 690 }
  }).setOrigin(0.5).setDepth(2402);
  const checklist = scene.add.text(430, 535, steps.map((step) => `○  ${step}`).join("\n"), {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#3d443f",
    fontStyle: "bold",
    lineSpacing: 22
  }).setDepth(2402);
  const status = scene.add.text(665, 715, "SCANNER NOT RESPONDING", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#8b3f31",
    fontStyle: "bold",
    backgroundColor: "#f0c9c1",
    padding: { x: 18, y: 10 }
  }).setOrigin(0.5).setDepth(2402);
  const buttonBackground = scene.add.rectangle(0, 0, 450, 88, 0x8a4d35, 1)
    .setStrokeStyle(4, 0xe0a181)
    .setInteractive({ useHandCursor: true });
  const buttonText = scene.add.text(0, 0, "RESTART SCANNER", {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const button = scene.add.container(665, 825, [buttonBackground, buttonText]).setDepth(2403);

  const repair = (): void => {
    if (completed >= steps.length) return;
    completed += 1;
    checklist.setText(steps.map((step, index) => `${index < completed ? "✓" : "○"}  ${step}`).join("\n"));
    if (completed === 1) {
      status.setText("SCANNER ONLINE").setColor("#285331").setBackgroundColor("#cce8c7");
      buttonText.setText("TEST PAYMENT TERMINAL");
      return;
    }
    if (completed === 2) {
      status.setText("PAYMENT APPROVED").setColor("#285331").setBackgroundColor("#cce8c7");
      buttonText.setText("PRINT TEST RECEIPT");
      return;
    }

    status.setText("REGISTER RESTORED").setColor("#285331").setBackgroundColor("#cce8c7");
    buttonText.setText("REOPEN CHECKOUT");
    buttonBackground.setFillStyle(0x4f8b4c).setStrokeStyle(4, 0xbfe5a6);
    buttonBackground.removeAllListeners("pointerdown");
    buttonBackground.on("pointerdown", finish);
  };

  const finish = (): void => {
    buttonBackground.disableInteractive();
    scene.__day3EquipmentResolved = true;
    restoreProgressionScene(scene);
    scene.__campaignIncidentPanel?.destroy(true);
    scene.__campaignIncidentPanel = undefined;
    scene.showPhaseBanner("CHECKOUT RESTORED");
    scene.showTransientHint("Equipment restored. Resume customer service and finish the shift.");
    if (scene.phase === "RUSH" && scene.soldCount >= LEVELS.day03.salesTargets.rushToClosing) {
      continuePhase();
    } else if (scene.phase === "OPEN" || scene.phase === "RUSH") {
      scene.startCustomerLoop(LEVELS.day03.customerIntervalsMs.rush);
    }
    scene.updateHud();
  };

  buttonBackground.on("pointerdown", repair);
  buttonText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
    if (completed >= steps.length) finish();
    else repair();
  });

  scene.__campaignIncidentPanel = scene.add.container(0, 0, [
    shade,
    panel,
    eyebrow,
    title,
    subtitle,
    checklist,
    status,
    button
  ]).setDepth(2400);
}

function pauseProgressionScene(scene: RuntimeGame): void {
  const progression = scene.scene.get("progression-customer") as Phaser.Scene;
  if (!progression?.scene?.isActive()) return;
  scene.__campaignPausedProgression = {
    scene: progression,
    timePaused: progression.time.paused,
    inputEnabled: progression.input.enabled
  };
  progression.time.paused = true;
  progression.tweens.pauseAll();
  progression.input.enabled = false;
}

function restoreProgressionScene(scene: RuntimeGame): void {
  const state = scene.__campaignPausedProgression;
  if (!state) return;
  if (state.scene.scene.isActive()) {
    state.scene.time.paused = state.timePaused;
    if (!state.timePaused) state.scene.tweens.resumeAll();
    state.scene.input.enabled = state.inputEnabled;
  }
  scene.__campaignPausedProgression = undefined;
}

function isDayUnlocked(day: PlayableDay): boolean {
  if (day === "day01") return true;
  if (day === "day02") return bestStarsFor("day01") > 0;
  return bestStarsFor("day02") > 0;
}

function readActiveDay(): PlayableDay {
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
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
