import Phaser from "phaser";
import { Assets } from "./assets";
import { GAME_RULES, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";

type CartVisualState = "EMPTY" | "LOADING" | "READY" | "FULL";

type RuntimeGameScene = Phaser.Scene & {
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  cartCountText: Phaser.GameObjects.Text;
  loadedProducts: ProductId[];
  __cartStateLabel?: Phaser.GameObjects.Text;
  __cartInventoryText?: Phaser.GameObjects.Text;
  __cartArtworkState?: CartVisualState;
  __cartArtworkSignature?: string;
  __cartArtworkHandler?: () => void;
};

type GameScenePrototype = {
  create: () => void;
};

const CART_TEXTURES: Record<CartVisualState, string> = {
  EMPTY: Assets.props.cartEmpty,
  LOADING: Assets.props.cartLoading,
  READY: Assets.props.cartReady,
  FULL: Assets.props.cartFull
};

const STATE_COLORS: Record<CartVisualState, string> = {
  EMPTY: "#344140",
  LOADING: "#8a6420",
  READY: "#2f7d45",
  FULL: "#1f6f8b"
};

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithCartLoadArtwork(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;

  installCartInventoryText(scene);
  updateCartArtwork(scene, true);

  if (scene.__cartArtworkHandler) {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene.__cartArtworkHandler);
  }

  const handler = (): void => {
    if (!scene.cart?.active || !scene.cartSprite?.active) return;
    updateCartArtwork(scene);
  };

  scene.__cartArtworkHandler = handler;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, handler);
    if (scene.__cartArtworkHandler === handler) scene.__cartArtworkHandler = undefined;
    scene.__cartInventoryText?.destroy();
    scene.__cartInventoryText = undefined;
    scene.__cartArtworkState = undefined;
    scene.__cartArtworkSignature = undefined;
  });
};

function installCartInventoryText(scene: RuntimeGameScene): void {
  scene.__cartInventoryText?.destroy();

  const inventoryText = scene.add.text(0, -210, "NO STOCK", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    lineSpacing: 2,
    backgroundColor: "#152020",
    padding: { x: 7, y: 4 }
  }).setOrigin(0.5);

  scene.cart.add(inventoryText);
  scene.__cartInventoryText = inventoryText;

  // Keep the labels above the visible cart contents without enlarging the hit delay.
  scene.__cartStateLabel?.setY(-270);
  scene.cartCountText.setPosition(98, -235);
}

function updateCartArtwork(scene: RuntimeGameScene, force = false): void {
  const counts = countProducts(scene.loadedProducts);
  const count = scene.loadedProducts.length;
  const state = resolveArtworkState(count);
  const signature = `${state}:${counts.cola}:${counts.water}:${counts.milk}`;

  if (!force && signature === scene.__cartArtworkSignature) return;

  if (force || state !== scene.__cartArtworkState) {
    const requestedTexture = CART_TEXTURES[state];
    const texture = scene.textures.exists(requestedTexture) ? requestedTexture : Assets.props.cart;
    scene.cartSprite.setTexture(texture).clearTint().setOrigin(0.5, 1).setPosition(0, 0);
    fitCartSprite(scene.cartSprite);
    scene.__cartArtworkState = state;
  }

  const color = STATE_COLORS[state];
  scene.cartCountText
    .setText(`${count}/${GAME_RULES.cartCapacity}`)
    .setBackgroundColor(color);
  scene.__cartStateLabel
    ?.setText(state)
    .setBackgroundColor(color)
    .setY(-270);
  scene.__cartInventoryText
    ?.setText(formatInventory(counts, count))
    .setBackgroundColor(color)
    .setY(-210);

  scene.__cartArtworkSignature = signature;
}

function resolveArtworkState(count: number): CartVisualState {
  if (count <= 0) return "EMPTY";
  if (count >= GAME_RULES.cartCapacity) return "FULL";
  if (count >= 3) return "READY";
  return "LOADING";
}

function countProducts(products: ProductId[]): Record<ProductId, number> {
  const counts: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };
  for (const productId of products) counts[productId] += 1;
  return counts;
}

function formatInventory(counts: Record<ProductId, number>, total: number): string {
  if (total <= 0) return "NO STOCK";
  return `COLA x${counts.cola}  WATER x${counts.water}\nMILK x${counts.milk}`;
}

function fitCartSprite(image: Phaser.GameObjects.Image): void {
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  image.setScale(Math.min(276 / sourceWidth, 250 / sourceHeight));
}
