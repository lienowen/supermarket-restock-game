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
  const banner = scene.add.rectangle(config.centreX, config.centreY, 610, 142, config.hudColor, 0.95)
    .setStrokeStyle(4, config.accentColor, 1)
    .setDepth(120)
    .setScale(0.82);
  const title = scene.add.text(config.centreX, config.centreY - 23, config.title, {
    fontFamily: "Arial",
    fontSize: "32px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(121);
  const reward = scene.add.text(
    config.centreX,
    config.centreY + 27,
    `+${config.stars} STAR   +${config.coins} COINS`,
    {
      fontFamily: "Arial",
      fontSize: "21px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold"
    }
  ).setOrigin(0.5).setDepth(121);

  [banner, title, reward].forEach((object) => object.setAlpha(0));
  scene.tweens.add({
    targets: [banner, title, reward],
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 420,
    ease: "Back.Out"
  });

  for (let index = 0; index < 22; index += 1) {
    const sparkle = scene.add.circle(
      config.sparkleOriginX,
      config.sparkleOriginY,
      3 + (index % 4),
      index % 2 === 0 ? config.accentColor : 0xffffff,
      1
    ).setDepth(90);
    scene.tweens.add({
      targets: sparkle,
      x: config.sparkleOriginX - 195 + Math.random() * 390,
      y: config.sparkleOriginY - 270 + Math.random() * 500,
      alpha: 0,
      duration: 850 + Math.random() * 650,
      ease: "Cubic.Out",
      onComplete: () => sparkle.destroy()
    });
  }
}
