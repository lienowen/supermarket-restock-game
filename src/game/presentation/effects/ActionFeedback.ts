import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";

export type ActionFeedbackKind = "interact" | "restock" | "scan" | "mistake";

export interface ActionFeedbackOptions {
  readonly label?: string;
  readonly emphasis?: number;
}

const COPY: Record<ActionFeedbackKind, string> = {
  interact: "DONE!",
  restock: "STOCKED!",
  scan: "BEEP!",
  mistake: "WRONG SHELF"
};

const COLORS: Record<ActionFeedbackKind, number> = {
  interact: 0xffc94f,
  restock: 0x62c77d,
  scan: 0x67d7e5,
  mistake: 0xe45d52
};

export function playActionFeedback(
  scene: Phaser.Scene,
  position: NavigationPoint,
  kind: ActionFeedbackKind,
  options: ActionFeedbackOptions = {}
): void {
  const color = COLORS[kind];
  const emphasis = Phaser.Math.Clamp(options.emphasis ?? 1, 1, 1.5);
  const ring = scene.add.circle(position.x, position.y - 54, 26, color, 0.12)
    .setStrokeStyle(5, color, 0.95)
    .setDepth(150);
  const label = scene.add.text(position.x, position.y - 132, options.label ?? COPY[kind], {
    fontFamily: "Arial",
    fontSize: kind === "scan" ? "23px" : `${Math.round(20 * emphasis)}px`,
    color: `#${color.toString(16).padStart(6, "0")}`,
    fontStyle: "bold",
    stroke: "#17332a",
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(151).setScale(0.72);

  const particleCount = Math.round(6 * emphasis);
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = (Math.PI * 2 * index) / particleCount;
    return scene.add.circle(position.x, position.y - 54, 5, color, 0.9)
      .setDepth(149)
      .setData("targetX", position.x + Math.cos(angle) * 74 * emphasis)
      .setData("targetY", position.y - 54 + Math.sin(angle) * 48 * emphasis);
  });

  scene.tweens.add({
    targets: ring,
    radius: 74 * emphasis,
    alpha: 0,
    duration: kind === "mistake" ? 240 : 360,
    ease: "Quad.Out",
    onComplete: () => ring.destroy()
  });
  scene.tweens.add({
    targets: label,
    y: position.y - 160 - (emphasis - 1) * 30,
    scaleX: emphasis,
    scaleY: emphasis,
    alpha: { from: 1, to: 0 },
    duration: kind === "mistake" ? 460 : 620,
    hold: kind === "mistake" ? 40 : 170,
    ease: "Back.Out",
    onComplete: () => label.destroy()
  });
  particles.forEach((particle) => {
    scene.tweens.add({
      targets: particle,
      x: Number(particle.getData("targetX")),
      y: Number(particle.getData("targetY")),
      alpha: 0,
      scaleX: 0.4,
      scaleY: 0.4,
      duration: kind === "mistake" ? 280 : 420,
      ease: "Quad.Out",
      onComplete: () => particle.destroy()
    });
  });
}
