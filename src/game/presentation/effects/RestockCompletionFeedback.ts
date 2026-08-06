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

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const colorHex = (color: number): string => (
  `#${color.toString(16).padStart(6, "0")}`
);

export function playRestockCompletionFeedback(
  scene: Phaser.Scene,
  config: RestockCompletionFeedbackConfig
): void {
  if (isFirstDelivery()) {
    playFirstDeliveryCompletion(scene, config);
    return;
  }
  playStandardCompletion(scene, config);
}

function playFirstDeliveryCompletion(
  scene: Phaser.Scene,
  config: RestockCompletionFeedbackConfig
): void {
  const panelBackground = scene.add.graphics();
  panelBackground.fillStyle(config.hudColor, 0.96);
  panelBackground.fillRoundedRect(-280, -72, 560, 144, 26);
  panelBackground.lineStyle(5, config.accentColor, 1);
  panelBackground.strokeRoundedRect(-280, -72, 560, 144, 26);

  const title = scene.add.text(0, -32, config.title || "DELIVERY COMPLETE", {
    fontFamily: "Arial, sans-serif",
    fontSize: "29px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#17332a",
    strokeThickness: 7,
    align: "center"
  }).setOrigin(0.5);

  const reward = scene.add.text(0, 27, "★ +0    +0 COINS", {
    fontFamily: "Arial, sans-serif",
    fontSize: "25px",
    color: colorHex(config.accentColor),
    fontStyle: "bold",
    stroke: "#17332a",
    strokeThickness: 6
  }).setOrigin(0.5);

  const panel = scene.add.container(config.centreX, config.centreY, [
    panelBackground,
    title,
    reward
  ])
    .setDepth(145)
    .setAlpha(0)
    .setScale(0.82)
    .setName("first-delivery-reward-banner");

  const rewardCounter = { coins: 0, stars: 0 };
  scene.tweens.add({
    targets: rewardCounter,
    coins: config.coins,
    stars: config.stars,
    duration: 620,
    ease: "Cubic.Out",
    onUpdate: () => {
      reward.setText(
        `★ +${Math.round(rewardCounter.stars)}    +${Math.round(rewardCounter.coins)} COINS`
      );
    }
  });

  scene.tweens.add({
    targets: panel,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 260,
    hold: 760,
    yoyo: true,
    ease: "Back.Out",
    onComplete: () => panel.destroy(true)
  });

  const ring = scene.add.circle(
    config.sparkleOriginX,
    config.sparkleOriginY - 40,
    32,
    config.accentColor,
    0.08
  ).setStrokeStyle(6, config.accentColor, 0.9).setDepth(141);

  scene.tweens.add({
    targets: ring,
    radius: 126,
    alpha: 0,
    duration: 680,
    ease: "Quad.Out",
    onComplete: () => ring.destroy()
  });

  for (let index = 0; index < 24; index += 1) {
    const sparkle = scene.add.circle(
      config.sparkleOriginX,
      config.sparkleOriginY,
      3 + (index % 4),
      index % 3 === 0 ? 0x62c77d : index % 2 === 0 ? config.accentColor : 0xffffff,
      1
    ).setDepth(140);
    scene.tweens.add({
      targets: sparkle,
      x: config.sparkleOriginX - 205 + Math.random() * 410,
      y: config.sparkleOriginY - 285 + Math.random() * 510,
      alpha: 0,
      scaleX: 0.35,
      scaleY: 0.35,
      duration: 760 + Math.random() * 440,
      ease: "Cubic.Out",
      onComplete: () => sparkle.destroy()
    });
  }

  const walletX = scene.cameras.main.width - 126;
  const walletY = 54;
  for (let index = 0; index < 9; index += 1) {
    const coin = scene.add.circle(
      config.sparkleOriginX + (index % 3 - 1) * 12,
      config.sparkleOriginY - 28 + Math.floor(index / 3) * 10,
      7,
      config.accentColor,
      1
    )
      .setStrokeStyle(2, 0xfff3bf, 1)
      .setDepth(143)
      .setScale(0.72);

    scene.tweens.add({
      targets: coin,
      x: walletX + (index % 3 - 1) * 8,
      y: walletY + Math.floor(index / 3) * 5,
      scaleX: 0.28,
      scaleY: 0.28,
      alpha: 0,
      delay: 140 + index * 45,
      duration: 560,
      ease: "Cubic.In",
      onComplete: () => coin.destroy()
    });
  }

  scene.cameras.main.flash(150, 98, 199, 125, false);
  document.body.dataset.levelOneRewardFeedback = "banner-countup-wallet-coins";
}

function playStandardCompletion(
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
      color: colorHex(config.accentColor),
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
