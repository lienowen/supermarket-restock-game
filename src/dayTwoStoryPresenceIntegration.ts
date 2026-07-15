import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type ProductId = "cola" | "water" | "milk";
type StoryView = "overview" | "drinks" | "stockroom" | "checkout";

type RuntimeBox = {
  productId: ProductId;
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
};

type RuntimeSlot = {
  productId: ProductId;
  product?: Phaser.GameObjects.Image;
};

type StoryButton = {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
};

type StoryController = {
  view: StoryView;
  transitioning: boolean;
  customerBusy: boolean;
  background: Phaser.GameObjects.Image;
  overviewHotspot: StoryButton;
  overviewButton: StoryButton;
  stockroomButton: StoryButton;
  returnButton: StoryButton;
  closeButton: StoryButton;
  restockHit: Phaser.GameObjects.Rectangle;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  boxes: RuntimeBox[];
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  selectedBox?: RuntimeBox;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  soldCount: number;
  __dayTwoStory?: StoryController;
  __dayTwoPresence?: PresenceController;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type PresenceController = {
  guideOutline: Phaser.GameObjects.Rectangle;
  guideLabel: Phaser.GameObjects.Text;
  cargo: Phaser.GameObjects.Image[];
  customer?: Phaser.GameObjects.Image;
  restockVisual?: Phaser.GameObjects.Image;
  restockRunning: boolean;
  lastSignature: string;
  timer: Phaser.Time.TimerEvent;
  postUpdate: () => void;
};

const STOCK_BOX_POINTS = [
  { x: 150, y: 510 },
  { x: 300, y: 510 },
  { x: 150, y: 675 },
  { x: 300, y: 675 }
+] as const;

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createDayTwoStoryPresence(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02" || !scene.__dayTwoStory) return;
  installPresence(scene);
};

function installPresence(scene: RuntimeGame): void {
  destroyExisting(scene);
  const story = scene.__dayTwoStory;
  if (!story) return;

  const cargo = [
    mark(scene.add.image(-34, -108, Assets.props.boxCola).setOrigin(0.5, 1).setDisplaySize(58, 58)),
    mark(scene.add.image(34, -108, Assets.props.boxCola).setOrigin(0.5, 1).setDisplaySize(58, 58))
  ];
  cargo.forEach((image) => image.setVisible(false));
  scene.cart.add(cargo);

  const guideOutline = mark(
    scene.add.rectangle(0, 0, 180, 72, 0xffffff, 0)
      .setStrokeStyle(4, 0xffd75a, 1)
      .setDepth(9_020)
      .setVisible(false)
  );
  const guideLabel = mark(
    scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#17231d",
      fontStyle: "bold",
      align: "center",
      backgroundColor: "#ffe071",
      padding: { x: 14, y: 8 },
      wordWrap: { width: 320 }
    }).setOrigin(0.5).setDepth(9_030).setVisible(false)
  );

  const presence: PresenceController = {
    guideOutline,
    guideLabel,
    cargo,
    restockRunning: false,
    lastSignature: "",
    timer: undefined as unknown as Phaser.Time.TimerEvent,
    postUpdate: () => applyActorPresence(scene, presence)
  };
  scene.__dayTwoPresence = presence;

  story.restockHit.on("pointerdown", () => {
    scene.time.delayedCall(0, () => startRestockAnimation(scene, presence));
  });

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, presence.postUpdate);
  presence.timer = scene.time.addEvent({
    delay: 100,
    loop: true,
    callback: () => synchronizePresence(scene, presence)
  });

  synchronizePresence(scene, presence, true);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => destroyExisting(scene));
}

function synchronizePresence(scene: RuntimeGame, presence: PresenceController, force = false): void {
  const story = scene.__dayTwoStory;
  if (!story || gameSession.day !== "day02" || !scene.scene.isActive()) return;

  const signature = [
    story.view,
    story.transitioning ? "1" : "0",
    story.customerBusy ? "1" : "0",
    scene.phase,
    scene.cartAtShelf ? "1" : "0",
    scene.movingCart ? "1" : "0",
    scene.restockBusy ? "1" : "0",
    scene.loadedProducts.join(","),
    scene.boxes.map((box) => (box.loaded ? "1" : "0")).join(""),
    scene.shelfSlots.filter((slot) => slot.productId === "cola" && slot.product).length.toString(),
    scene.soldCount.toString(),
    scene.selectedBox ? "1" : "0"
  ].join("|");

  if (!force && signature === presence.lastSignature) return;
  presence.lastSignature = signature;

  updateCargo(scene, presence);
  updateCustomer(scene, presence);
  updateGuide(scene, presence);
  applyActorPresence(scene, presence);
}

function applyActorPresence(scene: RuntimeGame, presence: PresenceController): void {
  const story = scene.__dayTwoStory;
  if (!story || scene.shiftEnded || story.transitioning) return;

  if (!presence.restockRunning) {
    if (story.view === "overview") {
      showWorker(scene, Assets.characters.workerIdle, 465, 995, 160, 320);
      scene.cart.setVisible(false);
    } else if (story.view === "drinks") {
      showWorker(scene, Assets.characters.workerIdle, scene.cartAtShelf ? 350 : 260, 995, 160, 320);
      scene.cart
        .setVisible(scene.cartAtShelf)
        .setPosition(485, 995)
        .setScale(0.62)
        .setDepth(38);
    } else if (story.view === "stockroom") {
      if (scene.selectedBox) {
        scene.worker.setVisible(true).setTexture(Assets.characters.workerCarry).setDisplaySize(165, 330).setDepth(42);
      } else {
        showWorker(scene, Assets.characters.workerIdle, 650, 960, 165, 330);
      }
      scene.cart.setVisible(true).setPosition(510, 940).setScale(0.66).setDepth(38);
      ensureStockroomBoxes(scene);
    } else {
      showWorker(scene, Assets.characters.workerIdle, 1045, 955, 155, 310);
      scene.cart.setVisible(true).setPosition(810, 965).setScale(0.58).setDepth(38);
    }
  }
}

function showWorker(
  scene: RuntimeGame,
  texture: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  scene.worker
    .setVisible(true)
    .setTexture(texture)
    .setOrigin(0.5, 1)
    .setPosition(x, y)
    .setDisplaySize(width, height)
    .setDepth(42)
    .clearTint();
}

function ensureStockroomBoxes(scene: RuntimeGame): void {
  let colaIndex = 0;
  scene.boxes.forEach((box) => {
    if (box.productId !== "cola" || box.loaded) return;
    const point = STOCK_BOX_POINTS[colaIndex % STOCK_BOX_POINTS.length];
    colaIndex += 1;
    box.homeX = point.x;
    box.homeY = point.y;
    box.image
      .setVisible(true)
      .setPosition(point.x, point.y)
      .setOrigin(0.5, 1)
      .setDisplaySize(112, 112)
      .setDepth(30 + point.y / 10_000);
    box.shadow
      .setVisible(true)
      .setPosition(point.x, point.y + 3)
      .setDisplaySize(78, 16)
      .setAlpha(0.18)
      .setDepth(29 + point.y / 10_000);
    if (box.image.input) {
      box.image.input.enabled = !scene.cartAtShelf && !scene.movingCart && !scene.restockBusy;
    }
  });
}

function updateCargo(scene: RuntimeGame, presence: PresenceController): void {
  const count = Math.min(2, scene.loadedProducts.filter((product) => product === "cola").length);
  presence.cargo.forEach((image, index) => image.setVisible(index < count));
}

function updateCustomer(scene: RuntimeGame, presence: PresenceController): void {
  const story = scene.__dayTwoStory;
  if (!story) return;

  if (story.customerBusy && !presence.customer) {
    const key = scene.soldCount % 2 === 0 ? Assets.characters.customer01Idle : Assets.characters.customer02Idle;
    const customer = mark(
      scene.add.image(1370, 990, key)
        .setOrigin(0.5, 1)
        .setDisplaySize(145, 300)
        .setDepth(43)
    );
    presence.customer = customer;
    scene.tweens.add({ targets: customer, x: 1080, duration: 520, ease: "Sine.Out" });
    return;
  }

  if (!story.customerBusy && presence.customer) {
    const customer = presence.customer;
    presence.customer = undefined;
    scene.tweens.add({
      targets: customer,
      x: 1370,
      alpha: 0,
      duration: 420,
      ease: "Sine.In",
      onComplete: () => customer.destroy()
    });
  }
}

function startRestockAnimation(scene: RuntimeGame, presence: PresenceController): void {
  const story = scene.__dayTwoStory;
  if (!story || story.view !== "drinks" || !scene.restockBusy || presence.restockRunning) return;

  presence.restockRunning = true;
  const filledBefore = scene.shelfSlots.filter((slot) => slot.productId === "cola" && slot.product).length;
  const targetY = filledBefore === 0 ? 610 : 790;

  showWorker(scene, Assets.characters.workerCarry, 420, 995, 170, 340);
  const caseSprite = mark(
    scene.add.image(scene.cart.x, scene.cart.y - 105, Assets.props.boxCola)
      .setOrigin(0.5, 1)
      .setDisplaySize(105, 105)
      .setDepth(48)
  );
  presence.restockVisual = caseSprite;

  scene.tweens.add({
    targets: [scene.worker, caseSprite],
    x: 720,
    duration: 360,
    ease: "Sine.InOut",
    onComplete: () => {
      scene.worker.setTexture(Assets.characters.workerRestock).setDisplaySize(175, 350).setPosition(720, 995);
      scene.tweens.add({
        targets: caseSprite,
        x: 930,
        y: targetY,
        scaleX: caseSprite.scaleX * 0.65,
        scaleY: caseSprite.scaleY * 0.65,
        alpha: 0.25,
        duration: 320,
        ease: "Cubic.Out",
        onComplete: () => {
          caseSprite.destroy();
          presence.restockVisual = undefined;
          scene.time.delayedCall(180, () => {
            presence.restockRunning = false;
            synchronizePresence(scene, presence, true);
          });
        }
      });
    }
  });
}

function updateGuide(scene: RuntimeGame, presence: PresenceController): void {
  const story = scene.__dayTwoStory;
  if (!story || story.transitioning || scene.shiftEnded) {
    hideGuide(presence);
    return;
  }

  if (story.view === "overview") {
    showGuide(presence, story.overviewHotspot.container, "步骤 1 · 进入饮料区");
    return;
  }

  if (story.view === "drinks") {
    const filled = scene.shelfSlots.filter((slot) => slot.productId === "cola" && slot.product).length;
    const colaOnCart = scene.loadedProducts.filter((product) => product === "cola").length;
    if (!scene.cartAtShelf || colaOnCart === 0) {
      showGuide(presence, story.stockroomButton.container, "步骤 2 · 去仓库拿可乐");
      return;
    }
    if (filled < 2) {
      showGuide(presence, story.restockHit, "步骤 3 · 点击空位补货");
      return;
    }
    hideGuide(presence);
    return;
  }

  if (story.view === "stockroom") {
    const required = scene.phase === "PREPARE" ? 2 : 1;
    const colaOnCart = scene.loadedProducts.filter((product) => product === "cola").length;
    if (scene.selectedBox) {
      showGuide(presence, scene.cart, "把纸箱拖到推车");
      return;
    }
    if (colaOnCart < required) {
      const target = scene.boxes.find((box) => box.productId === "cola" && !box.loaded && box.image.visible);
      if (target) showGuide(presence, target.image, `装载可乐箱 · ${colaOnCart}/${required}`);
      else hideGuide(presence);
      return;
    }
    showGuide(presence, story.returnButton.container, "货物已齐 · 返回饮料区");
    return;
  }

  showGuide(presence, story.closeButton.container, "完成今日工作");
}

function showGuide(
  presence: PresenceController,
  target: Phaser.GameObjects.GameObject & { getBounds: () => Phaser.Geom.Rectangle },
  text: string
): void {
  const bounds = target.getBounds();
  const width = Math.max(90, bounds.width + 18);
  const height = Math.max(60, bounds.height + 16);
  presence.guideOutline
    .setVisible(true)
    .setPosition(bounds.centerX, bounds.centerY)
    .setDisplaySize(width, height);

  const labelY = bounds.top > 285 ? bounds.top - 36 : bounds.bottom + 36;
  presence.guideLabel.setVisible(true).setText(text).setPosition(bounds.centerX, labelY);
}

function hideGuide(presence: PresenceController): void {
  presence.guideOutline.setVisible(false);
  presence.guideLabel.setVisible(false);
}

function destroyExisting(scene: RuntimeGame): void {
  const existing = scene.__dayTwoPresence;
  if (!existing) return;
  existing.timer?.remove(false);
  scene.events.off(Phaser.Scenes.Events.POST_UPDATE, existing.postUpdate);
  existing.customer?.destroy();
  existing.restockVisual?.destroy();
  existing.guideOutline.destroy();
  existing.guideLabel.destroy();
  existing.cargo.forEach((image) => image.destroy());
  scene.__dayTwoPresence = undefined;
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoPresence", true);
  return object;
}
