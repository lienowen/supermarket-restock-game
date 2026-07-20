import Phaser from "phaser";
import {
  PlayerNavigationController,
  type NavigationBounds,
  type NavigationPoint,
  type PlayerNavigationSnapshot
} from "../../application/PlayerNavigationController";

export interface PlayerNavigationViewConfig {
  readonly start: NavigationPoint;
  readonly bounds: NavigationBounds;
  readonly speed: number;
  readonly assetKey: string;
  readonly displaySize: { readonly width: number; readonly height: number };
  readonly shadowOffset: NavigationPoint;
  readonly name: string;
  readonly baseDepth?: number;
}

type NavigationKeys = {
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly w: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly d: Phaser.Input.Keyboard.Key;
};

type CartoonActorParts = {
  readonly leftArm: Phaser.GameObjects.Rectangle;
  readonly rightArm: Phaser.GameObjects.Rectangle;
  readonly leftHand: Phaser.GameObjects.Arc;
  readonly rightHand: Phaser.GameObjects.Arc;
  readonly carriedBox: Phaser.GameObjects.Container;
};

const ACTOR_BASE_WIDTH = 150;
const ACTOR_BASE_HEIGHT = 260;

export class PlayerNavigationView {
  readonly controller: PlayerNavigationController;

  private readonly walkArea: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly actor: Phaser.GameObjects.Container;
  private readonly actorParts: CartoonActorParts;
  private readonly keys?: NavigationKeys;
  private destinationTween?: Phaser.Tweens.Tween;
  private enabled = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: PlayerNavigationViewConfig
  ) {
    this.controller = new PlayerNavigationController({
      start: config.start,
      bounds: config.bounds,
      speed: config.speed
    });

    scene.input.topOnly = false;
    this.walkArea = scene.add.rectangle(
      config.bounds.x + config.bounds.width / 2,
      config.bounds.y + config.bounds.height / 2,
      config.bounds.width,
      config.bounds.height,
      0xffffff,
      0.001
    )
      .setName(`${config.name}-walk-area`)
      .setDepth(8)
      .setInteractive({ useHandCursor: true });
    this.walkArea.on("pointerdown", this.handleWalkAreaPointerDown, this);

    this.shadow = scene.add.ellipse(
      config.start.x + config.shadowOffset.x,
      config.start.y + config.shadowOffset.y,
      150,
      34,
      0x18261f,
      0.24
    ).setDepth((config.baseDepth ?? 24) - 1);

    const cartoonActor = this.createCartoonActor();
    this.actor = cartoonActor.container
      .setPosition(config.start.x, config.start.y)
      .setDepth(config.baseDepth ?? 24)
      .setName(config.name);
    this.actorParts = cartoonActor.parts;
    this.setDisplaySize(config.displaySize.width, config.displaySize.height);
    this.applyPose(config.assetKey);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      this.keys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        d: Phaser.Input.Keyboard.KeyCodes.D
      }) as NavigationKeys;
    }

    window.addEventListener("mousedown", this.handleWindowMouseDown, true);
    window.addEventListener("click", this.handleWindowClick, true);
    window.addEventListener("touchstart", this.handleWindowTouchStart, { capture: true, passive: true });
    this.syncVisual();
  }

  update(deltaMs: number): void {
    if (!this.enabled) return;

    const horizontal = this.axis(this.keys?.left, this.keys?.a, this.keys?.right, this.keys?.d);
    const vertical = this.axis(this.keys?.up, this.keys?.w, this.keys?.down, this.keys?.s);
    if (horizontal !== 0 || vertical !== 0) {
      this.stopDestinationTween();
      if (this.controller.moveDirection(horizontal, vertical, deltaMs)) this.syncVisual();
      return;
    }

    if (this.destinationTween) return;
    if (this.controller.update(deltaMs)) this.syncVisual();
  }

  snapshot(): PlayerNavigationSnapshot {
    return this.controller.snapshot();
  }

  position(): NavigationPoint {
    return this.snapshot().position;
  }

  isNear(point: NavigationPoint, radius: number): boolean {
    return this.controller.isNear(point, radius);
  }

  setPosition(point: NavigationPoint): void {
    this.stopDestinationTween();
    this.controller.setPosition(point);
    this.syncVisual();
  }

  setDestination(point: NavigationPoint): void {
    if (!this.enabled) return;

    this.stopDestinationTween();
    this.controller.setDestination(point);
    const destination = this.controller.snapshot().destination;
    if (!destination) return;

    const start = this.controller.snapshot().position;
    const distance = Math.hypot(destination.x - start.x, destination.y - start.y);
    if (distance <= 1) {
      this.controller.setPosition(destination);
      this.syncVisual();
      return;
    }

    const duration = Math.max(1, (distance / this.config.speed) * 1000);
    this.destinationTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.InOut",
      onUpdate: (tween) => {
        const progress = Number(tween.getValue() ?? 0);
        this.controller.setPosition({
          x: Phaser.Math.Linear(start.x, destination.x, progress),
          y: Phaser.Math.Linear(start.y, destination.y, progress)
        });
        this.syncVisual();
      },
      onComplete: () => {
        this.controller.setPosition(destination);
        this.destinationTween = undefined;
        this.syncVisual();
      }
    });
  }

  setTexture(assetKey: string): void {
    this.applyPose(assetKey);
  }

  setDisplaySize(width: number, height: number): void {
    this.actor.setScale(width / ACTOR_BASE_WIDTH, height / ACTOR_BASE_HEIGHT);
  }

  setVisible(visible: boolean): void {
    this.actor.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopDestinationTween();
      this.controller.clearDestination();
    }
  }

  destroy(): void {
    this.stopDestinationTween();
    window.removeEventListener("mousedown", this.handleWindowMouseDown, true);
    window.removeEventListener("click", this.handleWindowClick, true);
    window.removeEventListener("touchstart", this.handleWindowTouchStart, true);
    this.walkArea.off("pointerdown", this.handleWalkAreaPointerDown, this);
    this.walkArea.destroy();
    this.actor.destroy(true);
    this.shadow.destroy();
  }

  private createCartoonActor(): { container: Phaser.GameObjects.Container; parts: CartoonActorParts } {
    const { scene } = this;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const backHair = scene.add.ellipse(0, -80, 70, 82, 0x56351f, 1);
    const neck = scene.add.rectangle(0, -42, 24, 24, 0xf0b382, 1);
    const leftLeg = scene.add.rectangle(-20, 82, 25, 78, 0x263e3a, 1);
    const rightLeg = scene.add.rectangle(20, 82, 25, 78, 0x263e3a, 1);
    const leftShoe = scene.add.ellipse(-24, 126, 42, 20, 0xf4efe4, 1).setStrokeStyle(3, 0x9f9b92, 0.55);
    const rightShoe = scene.add.ellipse(24, 126, 42, 20, 0xf4efe4, 1).setStrokeStyle(3, 0x9f9b92, 0.55);
    const torso = scene.add.rectangle(0, 18, 88, 116, 0xf7f1df, 1).setStrokeStyle(3, 0xd7cfba, 0.75);
    const apron = scene.add.polygon(0, 24, [-39, -45, 39, -45, 34, 58, -34, 58], 0x2f8a58, 1)
      .setStrokeStyle(3, 0x195a38, 0.82);
    const apronPocket = scene.add.rectangle(0, 49, 42, 28, 0x3fa56b, 1).setStrokeStyle(2, 0xd8f1df, 0.3);
    const badge = scene.add.circle(23, -3, 7, 0xffd95e, 1).setStrokeStyle(2, 0x9c7120, 0.8);

    const leftArm = scene.add.rectangle(-55, 10, 24, 88, 0xf7f1df, 1).setStrokeStyle(3, 0xd7cfba, 0.65);
    const rightArm = scene.add.rectangle(55, 10, 24, 88, 0xf7f1df, 1).setStrokeStyle(3, 0xd7cfba, 0.65);
    const leftHand = scene.add.circle(-55, 58, 13, 0xf0b382, 1).setStrokeStyle(2, 0xb97750, 0.45);
    const rightHand = scene.add.circle(55, 58, 13, 0xf0b382, 1).setStrokeStyle(2, 0xb97750, 0.45);

    const head = scene.add.circle(0, -88, 40, 0xf2b98a, 1).setStrokeStyle(3, 0xb97750, 0.55);
    const leftEye = scene.add.circle(-14, -92, 4, 0x2e302d, 1);
    const rightEye = scene.add.circle(14, -92, 4, 0x2e302d, 1);
    const smile = scene.add.arc(0, -78, 13, 15, 165, false, 0x8d4d39, 1);
    const fringe = scene.add.arc(0, -103, 38, 190, 350, false, 0x56351f, 1);
    const capBrim = scene.add.ellipse(3, -126, 70, 18, 0x2f8a58, 1).setStrokeStyle(2, 0x195a38, 0.8);
    const capTop = scene.add.arc(-2, -130, 34, 180, 360, false, 0x3fa56b, 1);

    const boxBody = scene.add.rectangle(0, 39, 92, 66, 0xd89b52, 1).setStrokeStyle(4, 0x8e5d2d, 0.9);
    const boxTape = scene.add.rectangle(0, 39, 16, 66, 0xf2cf86, 0.9);
    const boxMark = scene.add.text(0, 39, "↑", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#79502b",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const carriedBox = scene.add.container(0, 0, [boxBody, boxTape, boxMark]).setVisible(false);

    objects.push(
      backHair,
      leftLeg,
      rightLeg,
      leftShoe,
      rightShoe,
      neck,
      torso,
      leftArm,
      rightArm,
      apron,
      apronPocket,
      badge,
      head,
      leftEye,
      rightEye,
      smile,
      fringe,
      capBrim,
      capTop,
      leftHand,
      rightHand,
      carriedBox
    );

    return {
      container: scene.add.container(0, 0, objects),
      parts: { leftArm, rightArm, leftHand, rightHand, carriedBox }
    };
  }

  private applyPose(assetKey: string): void {
    const carrying = assetKey.includes("carry");
    const pushing = assetKey.includes("push");
    const { leftArm, rightArm, leftHand, rightHand, carriedBox } = this.actorParts;

    leftArm.setPosition(carrying ? -48 : pushing ? -48 : -55, carrying ? 22 : pushing ? 28 : 10)
      .setAngle(carrying ? -35 : pushing ? -48 : 0);
    rightArm.setPosition(carrying ? 48 : pushing ? 48 : 55, carrying ? 22 : pushing ? 28 : 10)
      .setAngle(carrying ? 35 : pushing ? 48 : 0);
    leftHand.setPosition(carrying ? -35 : pushing ? -26 : -55, carrying ? 46 : pushing ? 67 : 58);
    rightHand.setPosition(carrying ? 35 : pushing ? 26 : 55, carrying ? 46 : pushing ? 67 : 58);
    carriedBox.setVisible(carrying);
    this.actor.setAngle(pushing ? -2 : 0);
  }

  private handleWalkAreaPointerDown(pointer: Phaser.Input.Pointer): void {
    this.setDestination({ x: pointer.x, y: pointer.y });
  }

  private readonly handleWindowMouseDown = (event: MouseEvent): void => {
    this.setDestinationFromClient(event.clientX, event.clientY);
  };

  private readonly handleWindowClick = (event: MouseEvent): void => {
    this.setDestinationFromClient(event.clientX, event.clientY);
  };

  private readonly handleWindowTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    if (touch) this.setDestinationFromClient(touch.clientX, touch.clientY);
  };

  private setDestinationFromClient(clientX: number, clientY: number): void {
    if (!this.enabled) return;

    const canvas = this.scene.game.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const appRect = document.getElementById("app")?.getBoundingClientRect();
    const rectangle = this.contains(canvasRect, clientX, clientY)
      ? canvasRect
      : appRect && this.contains(appRect, clientX, clientY)
        ? appRect
        : undefined;
    if (!rectangle || rectangle.width <= 0 || rectangle.height <= 0) return;

    const logicalWidth = Number(this.scene.game.config.width) || this.scene.scale.gameSize.width;
    const logicalHeight = Number(this.scene.game.config.height) || this.scene.scale.gameSize.height;
    const x = (clientX - rectangle.left) * (logicalWidth / rectangle.width);
    const y = (clientY - rectangle.top) * (logicalHeight / rectangle.height);
    const { bounds } = this.config;
    if (
      x < bounds.x ||
      x > bounds.x + bounds.width ||
      y < bounds.y ||
      y > bounds.y + bounds.height
    ) return;
    this.setDestination({ x, y });
  }

  private contains(rectangle: DOMRect, clientX: number, clientY: number): boolean {
    return (
      rectangle.width > 0 &&
      rectangle.height > 0 &&
      clientX >= rectangle.left &&
      clientX <= rectangle.right &&
      clientY >= rectangle.top &&
      clientY <= rectangle.bottom
    );
  }

  private stopDestinationTween(): void {
    this.destinationTween?.stop();
    this.destinationTween = undefined;
  }

  private axis(
    negativePrimary?: Phaser.Input.Keyboard.Key,
    negativeSecondary?: Phaser.Input.Keyboard.Key,
    positivePrimary?: Phaser.Input.Keyboard.Key,
    positiveSecondary?: Phaser.Input.Keyboard.Key
  ): number {
    const negative = Boolean(negativePrimary?.isDown || negativeSecondary?.isDown);
    const positive = Boolean(positivePrimary?.isDown || positiveSecondary?.isDown);
    return Number(positive) - Number(negative);
  }

  private syncVisual(): void {
    const { position } = this.snapshot();
    const depth = (this.config.baseDepth ?? 24) + position.y / 1000;
    this.actor.setPosition(position.x, position.y).setDepth(depth);
    this.shadow.setPosition(
      position.x + this.config.shadowOffset.x,
      position.y + this.config.shadowOffset.y
    ).setDepth(depth - 0.1);
  }
}
