import Phaser from "phaser";

/**
 * Day 1 immersion layer.
 * Adds lightweight supermarket zoning visuals without replacing the existing gameplay loop.
 * The next GameScene pass will replace the old single-shelf layout with full navigation.
 */

const ZONES = [
  { name: "FRUIT", x: 900, y: 350 },
  { name: "VEGETABLE", x: 1110, y: 350 },
  { name: "DRINKS", x: 900, y: 650 },
  { name: "GRAINS", x: 1110, y: 650 }
];

export function installDayOneSupermarketVisuals(scene: Phaser.Scene): void {
  if (scene.registry.get("day1_visuals")) return;
  scene.registry.set("day1_visuals", true);

  const layer = scene.add.container(0, 0).setDepth(6);

  ZONES.forEach((zone) => {
    const marker = scene.add.rectangle(zone.x, zone.y, 180, 72, 0xffffff, 0.08)
      .setStrokeStyle(2, 0xffd75a);

    const label = scene.add.text(zone.x, zone.y, zone.name, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    layer.add([marker, label]);
  });
}
