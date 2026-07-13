import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { PromotionWingScene } from "./scenes/PromotionWingScene";

const RealPromotionAssets = {
  room: "promotion-real-room",
  displayEmpty: "promotion-real-display-empty",
  displayStocked: "promotion-real-display-stocked",
  stockEntryDoor: "promotion-real-stock-entry-door",
  checkoutCounter: "promotion-real-checkout-counter",
  groceryShelf: "promotion-real-grocery-shelf",
  damagedGoodsCart: "promotion-real-damaged-goods-cart"
} as const;

const RealPromotionPaths: Record<(typeof RealPromotionAssets)[keyof typeof RealPromotionAssets], string> = {
  [RealPromotionAssets.room]: "assets/day02/promotion/promotion_wing_background.png",
  [RealPromotionAssets.displayEmpty]: "assets/day02/promotion/promo_display_empty.png",
  [RealPromotionAssets.displayStocked]: "assets/day02/promotion/promo_display_stocked.png",
  [RealPromotionAssets.stockEntryDoor]: "assets/day02/promotion/stock_entry_door.png",
  [RealPromotionAssets.checkoutCounter]: "assets/day02/promotion/checkout_counter.png",
  [RealPromotionAssets.groceryShelf]: "assets/day02/promotion/grocery_shelf_stocked.png",
  [RealPromotionAssets.damagedGoodsCart]: "assets/day02/promotion/damaged_goods_cart.png"
};

type WingSlot = {
  index: number;
  x: number;
  y: number;
  product?: Phaser.GameObjects.Image;
  missing: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Rectangle;
  reserved: boolean;
};

type RuntimePromotionWing = Phaser.Scene & {
  featuredProduct: ProductId;
  slots: WingSlot[];
  worker?: Phaser.GameObjects.Image;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  restockSlot: (slot: WingSlot) => void;
};

type PromotionWingPrototype = {
  preload: () => void;
  createExpandedRoom: () => void;
  createDisplayIslands: () => void;
  createWorker: () => void;
  placeProduct: (slot: WingSlot, animate: boolean) => void;
};

const prototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;
const originalPreload = prototype.preload;
const originalCreateExpandedRoom = prototype.createExpandedRoom;

prototype.preload = function preloadRealisticPromotionAssets(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;

  Object.entries(RealPromotionPaths).forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.createExpandedRoom = function createRealisticPromotionRoom(): void {
  originalCreateExpandedRoom.call(this);
  const scene = this as unknown as RuntimePromotionWing;

  replaceRoomBackground(scene);
  replaceRoomFixtures(scene);
  addSupermarketDepth(scene);

  document.body.dataset.promotionWingVisual = "ready";
};

prototype.createDisplayIslands = function createRealisticPromotionDisplays(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const fixtures = [450, 680, 910];

  fixtures.forEach((x, fixtureIndex) => {
    scene.add.ellipse(x, 900, 220, 30, 0x101515, 0.22).setDepth(3);
    scene.add.image(x, 685, RealPromotionAssets.displayEmpty)
      .setDisplaySize(220, 430)
      .setDepth(5);

    [585, 745].forEach((y, rowIndex) => {
      const index = fixtureIndex * 2 + rowIndex;
      const missing = scene.add.text(x, y + 42, "TAP TO RESTOCK", {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#ffe7a0",
        fontStyle: "bold",
        backgroundColor: "#6d3518",
        padding: { x: 9, y: 5 }
      }).setOrigin(0.5).setDepth(9);

      const hitArea = scene.add.rectangle(x, y + 35, 162, 150, 0xffffff, 0.001)
        .setDepth(18)
        .setInteractive({ useHandCursor: true });

      const slot: WingSlot = {
        index,
        x,
        y,
        missing,
        hitArea,
        reserved: false
      };

      hitArea.on("pointerdown", () => scene.restockSlot(slot));
      scene.slots.push(slot);
    });
  });
};

prototype.createWorker = function createRealisticPromotionWorker(): void {
  const scene = this as unknown as RuntimePromotionWing;
  scene.worker = scene.add.image(250, 1065, Assets.characters.workerIdle)
    .setOrigin(0.5, 1)
    .setDepth(20);
  scene.fitImage(scene.worker, 165, 325);
};

prototype.placeProduct = function placeRealisticPromotionProducts(slot: WingSlot, animate: boolean): void {
  const scene = this as unknown as RuntimePromotionWing;
  const definition = PRODUCTS[scene.featuredProduct];

  slot.product?.destroy();

  const products = [-34, 0, 34].map((offset) => {
    const image = scene.add.image(slot.x + offset, slot.y + 92, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(9);
    scene.fitImage(image, 44, 94);
    return image;
  });

  const primary = products[1];
  const companions = [products[0], products[2]];
  primary.setData("promotionCompanions", companions);
  primary.once("destroy", () => {
    companions.forEach((image) => {
      if (image.active) image.destroy();
    });
  });

  slot.product = primary;
  slot.missing.setVisible(false);

  if (!animate) return;

  products.forEach((image) => image.setAlpha(0).setScale(image.scaleX * 0.78, image.scaleY * 0.78));
  scene.tweens.add({
    targets: products,
    alpha: 1,
    scaleX: products[0].scaleX / 0.78,
    scaleY: products[0].scaleY / 0.78,
    duration: 190,
    ease: "Back.Out"
  });
};

function replaceRoomBackground(scene: RuntimePromotionWing): void {
  const background = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.promotion.roomBg
  ) as Phaser.GameObjects.Image | undefined;

  background
    ?.setTexture(RealPromotionAssets.room)
    .setPosition(665, 591)
    .setDisplaySize(1330, 1182)
    .setAlpha(1)
    .clearTint()
    .setDepth(0);

  const banner = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.promotion.dayBanner
  );
  banner?.destroy();
}

function replaceRoomFixtures(scene: RuntimePromotionWing): void {
  const images = scene.children.list.filter((child): child is Phaser.GameObjects.Image =>
    child instanceof Phaser.GameObjects.Image
  );

  const oldServiceDesk = images.find((image) => image.texture.key === Assets.promotion.serviceDesk);
  oldServiceDesk?.destroy();

  const checkout = images.find((image) => image.texture.key === Assets.promotion.checkoutCounter);
  checkout
    ?.setTexture(RealPromotionAssets.checkoutCounter)
    .setPosition(1125, 825)
    .setDisplaySize(300, 300)
    .clearTint()
    .setDepth(10);

  const damagedGoods = images.find((image) => image.texture.key === Assets.promotion.damagedGoodsBin);
  damagedGoods
    ?.setTexture(RealPromotionAssets.damagedGoodsCart)
    .setPosition(1190, 1000)
    .setDisplaySize(160, 195)
    .clearTint()
    .setDepth(12);

  scene.add.image(225, 825, RealPromotionAssets.checkoutCounter)
    .setDisplaySize(250, 230)
    .setDepth(8);
  scene.add.text(225, 700, "CUSTOMER SERVICE", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#254a3f",
    padding: { x: 12, y: 6 }
  }).setOrigin(0.5).setDepth(11);
}

function addSupermarketDepth(scene: RuntimePromotionWing): void {
  scene.add.image(105, 595, RealPromotionAssets.stockEntryDoor)
    .setDisplaySize(155, 420)
    .setDepth(3);

  scene.add.image(1215, 555, RealPromotionAssets.groceryShelf)
    .setDisplaySize(195, 390)
    .setDepth(3);

  scene.add.image(330, 545, RealPromotionAssets.displayStocked)
    .setDisplaySize(155, 285)
    .setAlpha(0.96)
    .setDepth(3);
}
