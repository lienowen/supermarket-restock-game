import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeBox = {
  positionIndex: number;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
};

type RuntimeGameScene = Phaser.Scene & {
  boxes: RuntimeBox[];
};

type GameScenePrototype = {
  create: () => void;
  spawnBox: (productId: string, positionIndex: number, renewable: boolean) => RuntimeBox;
};

// Each row has its own floor-contact line. The small X correction follows the
// backroom perspective: objects on the left sit slightly lower on screen.
const ROW_GROUND_Y = [825, 960, 1088] as const;
const RIGHT_COLUMN_X = 265;
const PERSPECTIVE_SLOPE = 0.07;

const prototype = GameScene.prototype as unknown as GameScenePrototype;
const originalCreate = prototype.create;
const originalSpawnBox = prototype.spawnBox;

prototype.create = function createWithGroundedBoxes(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  scene.boxes.forEach(groundBox);
};

prototype.spawnBox = function spawnGroundedBox(
  productId: string,
  positionIndex: number,
  renewable: boolean
): RuntimeBox {
  const item = originalSpawnBox.call(this, productId, positionIndex, renewable);
  groundBox(item);
  return item;
};

function groundBox(item: RuntimeBox): void {
  const row = Math.min(ROW_GROUND_Y.length - 1, Math.floor(item.positionIndex / 2));
  const perspectiveOffset = Math.max(0, RIGHT_COLUMN_X - item.homeX) * PERSPECTIVE_SLOPE;
  const groundY = ROW_GROUND_Y[row] + perspectiveOffset;

  item.homeY = groundY;
  item.image
    .setOrigin(0.5, 1)
    .setPosition(item.homeX, groundY)
    .setDepth(16 + groundY / 10000);

  const shadowWidth = Phaser.Math.Clamp(item.image.displayWidth * 0.78, 82, 102);
  item.shadow
    .setPosition(item.homeX, groundY + 4)
    .setDisplaySize(shadowWidth, 18)
    .setFillStyle(0x101515, 0.32)
    .setDepth(15 + groundY / 10000)
    .setVisible(true);
}
