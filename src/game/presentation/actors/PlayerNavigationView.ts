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

export class PlayerNavigationView {
  readonly controller: PlayerNavigationController;

  private readonly walkArea: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly actor: Phaser.GameObjects.Image;
  private readonly keys?: NavigationKeys;
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
      190,
      44,
      0x000000,
      0.28
    ).setDepth((config.baseDepth ?? 24) - 1);
    this.actor = scene.add.image(config.start.x, config.start.y, config.assetKey)
      .setDisplaySize(config.displaySize.width, config.displaySize.height)
      .setDepth(config.baseDepth ?? 24)
      .setName(config.name);

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

    window.addEventListener("pointerdown", this.handleWindowPointerDown, true);
    this.syncVisual();
  }

  update(deltaMs: number): void {
    if (!this.enabled) return;

    const horizontal = this.axis(this.keys?.left, this.keys?.a, this.keys?.right, this.keys?.d);
    const vertical = this.axis(this.keys?.up, this.keys?.w, this.keys?.down, this.keys?.s);
    const moved = horizontal !== 0 || vertical !== 0
      ? this.controller.moveDirection(horizontal, vertical, deltaMs)
      : this.controller.update(deltaMs);

    if (moved) this.syncVisual();
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
    this.controller.setPosition(point);
    this.syncVisual();
  }

  setDestination(point: NavigationPoint): void {
    if (!this.enabled) return;
    this.controller.setDestination(point);
  }

  setTexture(assetKey: string): void {
    this.actor.setTexture(assetKey);
  }

  setDisplaySize(width: number, height: number): void {
    this.actor.setDisplaySize(width, height);
  }

  setVisible(visible: boolean): void {
    this.actor.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.controller.clearDestination();
  }

  destroy(): void {
    window.removeEventListener("pointerdown", this.handleWindowPointerDown, true);
    this.walkArea.off("pointerdown", this.handleWalkAreaPointerDown, this);
    this.walkArea.destroy();
    this.actor.destroy();
    this.shadow.destroy();
  }

  private handleWalkAreaPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    this.controller.setDestination({ x: pointer.x, y: pointer.y });
  }

  private readonly handleWindowPointerDown = (event: PointerEvent): void => {
    this.setDestinationFromClient(event.clientX, event.clientY);
  };

  private setDestinationFromClient(clientX: number, clientY: number): void {
    if (!this.enabled) return;
    const canvas = this.scene.game.canvas;
    const rectangle = canvas.getBoundingClientRect();
    if (rectangle.width <= 0 || rectangle.height <= 0) return;
    if (
      clientX < rectangle.left ||
      clientX > rectangle.right ||
      clientY < rectangle.top ||
      clientY > rectangle.bottom
    ) return;

    const x = (clientX - rectangle.left) * (this.scene.scale.gameSize.width / rectangle.width);
    const y = (clientY - rectangle.top) * (this.scene.scale.gameSize.height / rectangle.height);
    const { bounds } = this.config;
    if (
      x < bounds.x ||
      x > bounds.x + bounds.width ||
      y < bounds.y ||
      y > bounds.y + bounds.height
    ) return;
    this.controller.setDestination({ x, y });
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
