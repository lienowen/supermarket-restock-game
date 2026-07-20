import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";

export type ActionFeedbackKind = "interact" | "restock" | "scan";

const COPY: Record<ActionFeedbackKind, string> = {
  interact: "DONE!",
  restock: "STOCKED!",
  scan: "BEEP!"
};

const COLORS: Record<ActionFeedbackKind, number> = {
  interact: 0xffc94f,
  restock: 0x62c77d,
  scan: 0x67d7e5
};

export function playActionFeedback(
  scene: Phaser.Scene,
  position: NavigationPoint,
  kind: ActionFeedbackKind
): void {
  const color = COLORS[kind];
  const ring = scene.add.circle(position.x, position.y - 54, 26, color, 0.12)
    .setStrokeStyle(5, color, 0.95)
    .setDepth(150);
  const label = scene.add.text(position.x, position.y - 132, COPY[kind], {
    fontFamily: "Arial",
    fontSize: kind === "scan" ? "23px" : "20px",
    color: `#${color.toString(16).padStart(6, "0")}`,
    fontStyle: "bold",
    stroke: "#17332a",
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(151).setScale(0.72);

  const particles = Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 6;
    return scene.add.circle(position.x, position.y - 54, 5, color, 0.9)
      .setDepth(149)
      .setData("targetX", position.x + Math.cos(angle) * 74)
      .setData("targetY", position.y - 54 + Math.sin(angle) * 48);
  });

  scene.tweens.add({
    targets: ring,
    radius: 74,
    alpha: 0,
    duration: 360,
    ease: "Quad.Out",
    onComplete: () => ring.destroy()
  });
  scene.tweens.add({
    targets: label,
    y: position.y - 160,
    scaleX: 1,
    scaleY: 1,
    alpha: { from: 1, to: 0 },
    duration: 620,
    hold: 170,
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
      duration: 420,
      ease: "Quad.Out",
      onComplete: () => particle.destroy()
    });
  });
}
