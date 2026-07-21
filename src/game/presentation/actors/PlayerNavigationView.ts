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
  readonly walkAssetKeys?: readonly [string, string];
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
  private destinationFrame?: number;
  private enabled = true;
  private currentPoseKey: string;
  private walkElapsedMs = 0;
  private walkFrame = 0;
  private moving = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: PlayerNavigationViewConfig
  ) {
    this.controller = new PlayerNavigationController({
      start: config.start,
      bounds: config.bounds,
      speed: config.speed
    });
    this.currentPoseKey = config.assetKey;

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
      Math.max(88, config.displaySize.width * 0.62),
      Math.max(20, config.displaySize.height * 0.105),
      0x18261f,
      0.22
    ).setDepth((config.baseDepth ?? 24) - 1);

    this.actor = scene.add.image(config.start.x, config.start.y, config.assetKey)
      .setOrigin(0.5, 0.96)
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
      this.stopDestinationMovement();
      this.setMoving(true);
      if (this.controller.moveDirection(horizontal, vertical, deltaMs)) this.syncVisual();
      this.updateWalkFrame(deltaMs);
      return;
    }

    if (this.destinationFrame === undefined) this.setMoving(false);
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
    this.stopDestinationMovement();
    this.controller.setPosition(point);
    this.syncVisual();
  }

  setDestination(point: NavigationPoint): void {
    if (!this.enabled) return;

    this.stopDestinationMovement();
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

    this.setMoving(true);
    const duration = Math.max(1, (distance / this.config.speed) * 1000);
    const startedAt = performance.now();
    let previousAt = startedAt;
    const animate = (now: number): void => {
      if (!this.enabled) {
        this.destinationFrame = undefined;
        this.setMoving(false);
        return;
      }

      const progress = Phaser.Math.Clamp((now - startedAt) / duration, 0, 1);
      this.controller.setPosition({
        x: Phaser.Math.Linear(start.x, destination.x, progress),
        y: Phaser.Math.Linear(start.y, destination.y, progress)
      });
      this.updateWalkFrame(now - previousAt);
      previousAt = now;
      this.syncVisual();

      if (progress >= 1) {
        this.controller.setPosition(destination);
        this.destinationFrame = undefined;
        this.setMoving(false);
        this.syncVisual();
        return;
      }
      this.destinationFrame = window.requestAnimationFrame(animate);
    };

    this.destinationFrame = window.requestAnimationFrame(animate);
  }

  setTexture(assetKey: string): void {
    this.currentPoseKey = assetKey;
    if (!this.moving || !this.canUseWalkFrames()) this.actor.setTexture(assetKey);
  }

  setDisplaySize(width: number, height: number): void {
    this.actor.setDisplaySize(width, height);
    this.shadow.setSize(Math.max(88, width * 0.62), Math.max(20, height * 0.105));
  }

  setVisible(visible: boolean): void {
    this.actor.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopDestinationMovement();
      this.controller.clearDestination();
      this.setMoving(false);
    }
  }

  destroy(): void {
    this.stopDestinationMovement();
    window.removeEventListener("mousedown", this.handleWindowMouseDown, true);
    window.removeEventListener("click", this.handleWindowClick, true);
    window.removeEventListener("touchstart", this.handleWindowTouchStart, true);
    this.walkArea.off("pointerdown", this.handleWalkAreaPointerDown, this);
    this.walkArea.destroy();
    this.actor.destroy();
    this.shadow.destroy();
  }

  private setMoving(moving: boolean): void {
    if (this.moving === moving) return;
    this.moving = moving;
    this.walkElapsedMs = 0;
    this.walkFrame = 0;
    if (!moving || !this.canUseWalkFrames()) {
      this.actor.setTexture(this.currentPoseKey);
    } else {
      this.actor.setTexture(this.config.walkAssetKeys?.[0] ?? this.currentPoseKey);
    }
  }

  private canUseWalkFrames(): boolean {
    return Boolean(
      this.config.walkAssetKeys &&
      this.currentPoseKey === this.config.assetKey
    );
  }

  private updateWalkFrame(deltaMs: number): void {
    if (!this.moving || !this.canUseWalkFrames()) return;
    const frames = this.config.walkAssetKeys;
    if (!frames) return;
    this.walkElapsedMs += deltaMs;
    if (this.walkElapsedMs < 155) return;
    this.walkElapsedMs = 0;
    this.walkFrame = (this.walkFrame + 1) % frames.length;
    this.actor.setTexture(frames[this.walkFrame] ?? this.currentPoseKey);
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

  private stopDestinationMovement(): void {
    if (this.destinationFrame !== undefined) {
      window.cancelAnimationFrame(this.destinationFrame);
      this.destinationFrame = undefined;
    }
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
