import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const scenePath = resolve("src/game-v2/presentation/ImmersiveDayOneScene.ts");
let source = readFileSync(scenePath, "utf8");

source = source.replace(
  'document.body.dataset.gameArchitecture = "immersive-v2";',
  'document.body.dataset.gameArchitecture = "architecture-v3";'
);
source = source.replace('version: "immersive-v2",', 'version: "architecture-v3",');

const startMarker = "  private createCoolerWall(): void {";
const endMarker = "\n  private createFloorRoute(): void {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("Could not locate cooler renderer block");
}

const coolerRenderer = `  private createCoolerWall(): void {
    const coolerKey = V2_ASSETS.fixtures.beverageCooler.key;

    if (this.textures.exists(coolerKey)) {
      this.add.image(1260, 493, coolerKey)
        .setDisplaySize(555, 700)
        .setDepth(0)
        .setName("v3-beverage-cooler-prototype");
    } else {
      this.add.rectangle(1260, 478, 555, 700, 0x263033, 1)
        .setStrokeStyle(10, 0x646c6f, 1)
        .setDepth(0);
    }

    this.add.rectangle(1260, 132, 555, 68, 0x365d2e, 1).setDepth(3);
    this.add.text(1260, 119, "BEVERAGES", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#f0e6cf",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(4);
    this.add.text(1260, 151, "COLD DRINKS", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#e8dfca"
    }).setOrigin(0.5).setDepth(4);

    const shelfYs = [320, 405, 490, 575, 660, 745];
    shelfYs.forEach((y, rowIndex) => {
      this.createAmbientCoolerStock(y, rowIndex);
      this.coolerRows.push(this.createRestockRow(y, rowIndex));
    });
  }

  private createAmbientCoolerStock(y: number, rowIndex: number): void {
    const productKeys = [
      V2_ASSETS.products.colaBottle.key,
      V2_ASSETS.products.milkBottle.key,
      V2_ASSETS.products.waterBottle.key
    ];
    const positions = [1038, 1071, 1104, 1396, 1429, 1462, 1495];

    positions.forEach((x, index) => {
      this.add.image(x, y, productKeys[(rowIndex + index) % productKeys.length])
        .setDisplaySize(25, 62)
        .setDepth(3);
    });
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let index = 0; index < 6; index += 1) {
      const x = 1140 + index * 39;
      objects.push(
        this.add.image(x, y, V2_ASSETS.products.colaBottle.key)
          .setDisplaySize(27, 66)
      );
    }
    return this.add.container(0, 0, objects)
      .setAlpha(0.12)
      .setDepth(5)
      .setName(\`v2-cooler-row-\${rowIndex}\`);
  }
`;

source = `${source.slice(0, start)}${coolerRenderer}${source.slice(end)}`;

const targetGuard = `    if (!this.target || !this.targetArrow) return;\n    const world = DAY_ONE_CONTENT.world;`;
const upgradedTargetGuard = `    if (!this.target || !this.targetArrow) return;\n    if (snapshot.step === "complete") {\n      this.target.setVisible(false).disableInteractive();\n      this.targetArrow.setVisible(false);\n      return;\n    }\n    this.target.setVisible(true);\n    this.targetArrow.setVisible(true);\n    const world = DAY_ONE_CONTENT.world;`;

if (source.includes(targetGuard)) {
  source = source.replace(targetGuard, upgradedTargetGuard);
} else if (!source.includes('this.target.setVisible(false).disableInteractive();')) {
  throw new Error("Could not locate target visibility guard");
}

writeFileSync(scenePath, source, "utf8");
