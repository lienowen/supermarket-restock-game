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
  readonly onManualNavigation?: () => void;
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

const shadowWidth = (displayWidth: number): number => Phaser.Math.Clamp(displayWidth * 0.24, 110, 155);
const shadowHeight = (displayHeight: number): number => Phaser.Math.Clamp(displayHeight * 0.075, 28, 38);
const MAX_MOVEMENT_DELTA_MS = 50;

export class PlayerNavigationView {
  readonly controller: PlayerNavigationController;

  private readonly walkArea: Phaser.GameObjects.Rectangle;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly actor: Phaser.GameObjects.Image;
  private readonly keys?: NavigationKeys;
  private enabled = true;
  private currentPoseKey: string;
  private walkElapsedMs = 0;
  private walkFrame = 0;
  private moving = false;
  private lastVisualX: number;
  private destinationTween?: Phaser.Tweens.Tween;
  private activeDestination?: NavigationPoint;

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
    this.lastVisualX = config.start.x;

    scene.input.topOnly = true;
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
      shadowWidth(config.displaySize.width),
      shadowHeight(config.displaySize.height),
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

    this.syncVisual(true);
  }

  update(deltaMs: number): void {
    if (!this.enabled) return;
    const frameDelta = Phaser.Math.Clamp(deltaMs, 0, MAX_MOVEMENT_DELTA_MS);

    const horizontal = this.axis(this.keys?.left, this.keys?.a, this.keys?.right, this.keys?.d);
    const vertical = this.axis(this.keys?.up, this.keys?.w, this.keys?.down, this.keys?.s);
    if (horizontal !== 0 || vertical !== 0) {
      if (!this.moving || this.destinationTween) this.config.onManualNavigation?.();
      this.cancelDestinationMovement();
      this.setMoving(true);
      if (this.controller.moveDirection(horizontal, vertical, frameDelta)) this.syncVisual();
      this.updateWalkFrame(frameDelta);
      return;
    }

    if (this.destinationTween) {
      this.setMoving(true);
      this.updateWalkFrame(frameDelta);
      return;
    }

    this.setMoving(false);
  }

  snapshot(): PlayerNavigationSnapshot {
    const snapshot = this.controller.snapshot();
    return Object.freeze({
      position: snapshot.position,
      destination: this.activeDestination,
      moving: Boolean(this.activeDestination)
    });
  }

  position(): NavigationPoint {
    return this.controller.snapshot().position;
  }

  isNear(point: NavigationPoint, radius: number): boolean {
    return this.controller.isNear(point, radius);
  }

  setPosition(point: NavigationPoint): void {
    this.cancelDestinationMovement();
    this.controller.setPosition(point);
    this.setMoving(false);
    this.syncVisual(true);
  }

  setDestination(point: NavigationPoint): void {
    if (!this.enabled) return;
    this.cancelDestinationMovement();

    this.controller.setDestination(point);
    const destination = this.controller.snapshot().destination;
    if (!destination) return;
    const start = this.controller.snapshot().position;
    const distance = Math.hypot(destination.x - start.x, destination.y - start.y);
    if (distance <= 1) {
      this.controller.setPosition(destination);
      this.syncVisual(true);
      return;
    }

    this.activeDestination = Object.freeze({ ...destination });
    this.setMoving(true);
    const travel = { x: start.x, y: start.y };
    this.destinationTween = this.scene.tweens.add({
      targets: travel,
      x: destination.x,
      y: destination.y,
      duration: Math.max(1, (distance / this.config.speed) * 1000),
      ease: "Linear",
      onUpdate: () => {
        this.controller.setPosition(travel);
        this.syncVisual();
      },
      onComplete: () => {
        this.controller.setPosition(destination);
        this.activeDestination = undefined;
        this.destinationTween = undefined;
        this.setMoving(false);
        this.syncVisual(true);
      },
      onStop: () => {
        this.activeDestination = undefined;
        this.destinationTween = undefined;
      }
    });
  }

  setTexture(assetKey: string): void {
    this.currentPoseKey = assetKey;
    if (!this.moving || !this.canUseWalkFrames()) this.actor.setTexture(assetKey);
  }

  setDisplaySize(width: number, height: number): void {
    this.actor.setDisplaySize(width, height);
    this.shadow.setSize(shadowWidth(width), shadowHeight(height));
  }

  setVisible(visible: boolean): void {
    this.actor.setVisible(visible);
    this.shadow.setVisible(visible);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.cancelDestinationMovement();
      this.setMoving(false);
    }
  }

  destroy(): void {
    this.cancelDestinationMovement();
    this.walkArea.off("pointerdown", this.handleWalkAreaPointerDown, this);
    this.walkArea.destroy();
    this.actor.destroy();
    this.shadow.destroy();
  }

  private cancelDestinationMovement(): void {
    const tween = this.destinationTween;
    this.destinationTween = undefined;
    this.activeDestination = undefined;
    if (tween?.isPlaying()) tween.stop();
    this.controller.clearDestination();
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
    if (this.walkElapsedMs < 135) return;
    this.walkElapsedMs %= 135;
    this.walkFrame = (this.walkFrame + 1) % frames.length;
    this.actor.setTexture(frames[this.walkFrame] ?? this.currentPoseKey);
  }

  private handleWalkAreaPointerDown(pointer: Phaser.Input.Pointer): void {
    this.config.onManualNavigation?.();
    this.setDestination({ x: pointer.worldX, y: pointer.worldY });
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

  private syncVisual(force = false): void {
    const { position } = this.controller.snapshot();
    const movedX = position.x - this.lastVisualX;
    if (force || Math.abs(movedX) > 0.01) {
      if (movedX < -0.01) this.actor.setFlipX(true);
      else if (movedX > 0.01) this.actor.setFlipX(false);
    }
    this.lastVisualX = position.x;

    const depth = (this.config.baseDepth ?? 24) + position.y / 1000;
    this.actor.setPosition(position.x, position.y).setDepth(depth);
    this.shadow.setPosition(
      position.x + this.config.shadowOffset.x,
      position.y + this.config.shadowOffset.y
    ).setDepth(depth - 0.1);
  }
}
