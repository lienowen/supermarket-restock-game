import Phaser from "phaser";

export interface RestockCompletionFeedbackConfig {
  readonly title: string;
  readonly coins: number;
  readonly stars: number;
  readonly hudColor: number;
  readonly accentColor: number;
  readonly centreX: number;
  readonly centreY: number;
  readonly sparkleOriginX: number;
  readonly sparkleOriginY: number;
}

export function playRestockCompletionFeedback(
  scene: Phaser.Scene,
  config: RestockCompletionFeedbackConfig
): void {
  const reward = scene.add.text(
    config.sparkleOriginX,
    config.sparkleOriginY - 116,
    `★ +${config.stars}    +${config.coins} COINS`,
    {
      fontFamily: "Arial",
      fontSize: "25px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#173b2a",
      strokeThickness: 7
    }
  ).setOrigin(0.5).setDepth(132).setScale(0.7);

  const ring = scene.add.circle(
    config.sparkleOriginX,
    config.sparkleOriginY - 40,
    32,
    config.accentColor,
    0.08
  ).setStrokeStyle(6, config.accentColor, 0.88).setDepth(131);

  scene.tweens.add({
    targets: reward,
    y: config.sparkleOriginY - 165,
    scaleX: 1,
    scaleY: 1,
    alpha: { from: 1, to: 0 },
    duration: 920,
    hold: 180,
    ease: "Back.Out",
    onComplete: () => reward.destroy()
  });
  scene.tweens.add({
    targets: ring,
    radius: 118,
    alpha: 0,
    duration: 640,
    ease: "Quad.Out",
    onComplete: () => ring.destroy()
  });

  for (let index = 0; index < 22; index += 1) {
    const sparkle = scene.add.circle(
      config.sparkleOriginX,
      config.sparkleOriginY,
      3 + (index % 4),
      index % 3 === 0 ? 0x62c77d : index % 2 === 0 ? config.accentColor : 0xffffff,
      1
    ).setDepth(130);
    scene.tweens.add({
      targets: sparkle,
      x: config.sparkleOriginX - 195 + Math.random() * 390,
      y: config.sparkleOriginY - 270 + Math.random() * 500,
      alpha: 0,
      scaleX: 0.35,
      scaleY: 0.35,
      duration: 760 + Math.random() * 520,
      ease: "Cubic.Out",
      onComplete: () => sparkle.destroy()
    });
  }
}
