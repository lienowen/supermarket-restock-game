import Phaser from "phaser";

export interface VirtualJoystickVector {
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
}

const BASE_X = 150;
const BASE_Y = 748;
const BASE_RADIUS = 76;
const KNOB_RADIUS = 34;
const MAX_TRAVEL = 46;
const DEAD_ZONE = 0.12;

/**
 * Screen-space movement control for touch devices. It emits only a normalized
 * movement vector; world navigation remains owned by PlayerNavigationController.
 */
export class VirtualJoystick {
  private readonly enabledForDevice: boolean;
  private readonly root?: Phaser.GameObjects.Container;
  private readonly knob?: Phaser.GameObjects.Arc;
  private pointerId?: number;
  private axisX = 0;
  private axisY = 0;
  private enabled = true;

  constructor(private readonly scene: Phaser.Scene) {
    this.enabledForDevice = this.shouldShow();
    if (!this.enabledForDevice) return;

    const outer = scene.add.circle(0, 0, BASE_RADIUS, 0x08110d, 0.48)
      .setStrokeStyle(3, 0xffffff, 0.22);
    const inner = scene.add.circle(0, 0, BASE_RADIUS - 15, 0xffffff, 0.035)
      .setStrokeStyle(1, 0xffffff, 0.12);
    this.knob = scene.add.circle(0, 0, KNOB_RADIUS, 0x66bd65, 0.94)
      .setStrokeStyle(4, 0xc6efb9, 0.76);

    const up = scene.add.text(0, -57, "▲", controlTextStyle()).setOrigin(0.5);
    const down = scene.add.text(0, 57, "▼", controlTextStyle()).setOrigin(0.5);
    const left = scene.add.text(-59, 0, "◀", controlTextStyle()).setOrigin(0.5);
    const right = scene.add.text(59, 0, "▶", controlTextStyle()).setOrigin(0.5);

    this.root = scene.add.container(BASE_X, BASE_Y, [outer, inner, up, down, left, right, this.knob])
      .setDepth(225)
      .setScrollFactor(0)
      .setName("virtual-movement-joystick");

    outer.setInteractive(new Phaser.Geom.Circle(0, 0, BASE_RADIUS), Phaser.Geom.Circle.Contains);
    inner.setInteractive(new Phaser.Geom.Circle(0, 0, BASE_RADIUS - 10), Phaser.Geom.Circle.Contains);
    this.knob.setInteractive(new Phaser.Geom.Circle(0, 0, KNOB_RADIUS + 18), Phaser.Geom.Circle.Contains);

    [outer, inner, this.knob].forEach((target) => {
      target.on("pointerdown", this.handlePointerDown, this);
    });
    scene.input.on("pointermove", this.handlePointerMove, this);
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.input.on("pointerupoutside", this.handlePointerUp, this);
    scene.input.on("gameout", this.reset, this);

    document.body.dataset.mobileMovementControl = "virtual-joystick";
  }

  vector(): VirtualJoystickVector {
    return Object.freeze({
      x: this.enabled ? this.axisX : 0,
      y: this.enabled ? this.axisY : 0,
      active: Boolean(this.enabled && this.pointerId !== undefined)
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root?.setAlpha(enabled ? 1 : 0.36);
    if (!enabled) this.reset();
  }

  destroy(): void {
    if (!this.enabledForDevice) return;
    this.scene.input.off("pointermove", this.handlePointerMove, this);
    this.scene.input.off("pointerup", this.handlePointerUp, this);
    this.scene.input.off("pointerupoutside", this.handlePointerUp, this);
    this.scene.input.off("gameout", this.reset, this);
    this.root?.destroy(true);
  }

  private shouldShow(): boolean {
    const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    return navigator.maxTouchPoints > 0 || coarsePointer;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || this.pointerId !== undefined) return;
    this.pointerId = pointer.id;
    this.updateFromPointer(pointer);
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || pointer.id !== this.pointerId) return;
    this.updateFromPointer(pointer);
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.reset();
  }

  private updateFromPointer(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - BASE_X;
    const dy = pointer.y - BASE_Y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) {
      this.axisX = 0;
      this.axisY = 0;
      this.knob?.setPosition(0, 0);
      return;
    }

    const limitedDistance = Math.min(distance, MAX_TRAVEL);
    const nx = dx / distance;
    const ny = dy / distance;
    this.knob?.setPosition(nx * limitedDistance, ny * limitedDistance);

    const strength = Phaser.Math.Clamp(distance / MAX_TRAVEL, 0, 1);
    if (strength < DEAD_ZONE) {
      this.axisX = 0;
      this.axisY = 0;
      return;
    }
    this.axisX = nx * strength;
    this.axisY = ny * strength;
  }

  private reset(): void {
    this.pointerId = undefined;
    this.axisX = 0;
    this.axisY = 0;
    this.knob?.setPosition(0, 0);
  }
}

function controlTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff",
    fontStyle: "bold"
  };
}
