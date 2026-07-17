import Phaser from "phaser";

/**
 * Day 1 immersion helpers.
 * Keeps the first-day supermarket presentation separate from gameplay logic.
 */
export function addDayOneImmersionLayer(scene: Phaser.Scene): void {
  const zones = [
    { name: "FRUIT MARKET", x: 180, y: 300 },
    { name: "FRESH VEGETABLES", x: 470, y: 300 },
    { name: "DRINKS", x: 760, y: 300 },
    { name: "GRAINS", x: 1050, y: 300 }
  ];

  zones.forEach((zone) => {
    scene.add.rectangle(zone.x, zone.y, 230, 80, 0x17302a, 0.72)
      .setStrokeStyle(3, 0xf5d46c)
      .setDepth(20);

    scene.add.text(zone.x, zone.y, zone.name, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 200 }
    })
      .setOrigin(0.5)
      .setDepth(21);
  });

  scene.add.text(665, 250, "DAY 1 - OPEN YOUR SUPERMARKET", {
    fontFamily: "Arial",
    fontSize: "34px",
    color: "#ffe68a",
    fontStyle: "bold"
  })
    .setOrigin(0.5)
    .setDepth(22);
}
