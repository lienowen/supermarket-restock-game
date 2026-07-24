import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import type { CleanLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

export interface CleaningTaskViewConfig {
  readonly fixtureAssetKey: string;
  readonly cleaningCartAssetKey: string;
  readonly wetFloorSignAssetKey: string;
  readonly toolPoint: NavigationPoint;
  readonly spotPositions: readonly NavigationPoint[];
  readonly visual: CleanLevelVisualPreset;
}

/**
 * Reusable cleaning presentation. Gameplay owns which spill is active; this
 * view owns how the supplies station and floor mess read to the player.
 */
export class CleaningTaskView {
  private readonly staticObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly spills: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CleaningTaskViewConfig
  ) {}

  create(): readonly Phaser.GameObjects.Container[] {
    if (this.staticObjects.length > 0 || this.spills.length > 0) {
      return Object.freeze([...this.spills]);
    }

    const { scene, config } = this;
    const { visual } = config;
    const fixture = scene.add.image(
      visual.fixture.position.x,
      visual.fixture.position.y,
      config.fixtureAssetKey
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.fixture.size.width, visual.fixture.size.height)
      .setDepth(2)
      .setName("cleaning-supplies-fixture");
    const cart = scene.add.image(
      config.toolPoint.x,
      config.toolPoint.y,
      config.cleaningCartAssetKey
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.cartSize.width, visual.cartSize.height)
      .setDepth(20)
      .setName("cleaning-cart-tool");
    const sign = scene.add.image(
      config.toolPoint.x + visual.signOffset.x,
      config.toolPoint.y + visual.signOffset.y,
      config.wetFloorSignAssetKey
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.signSize.width, visual.signSize.height)
      .setDepth(20)
      .setName("wet-floor-sign-tool");
    this.staticObjects.push(fixture, cart, sign);

    config.spotPositions.forEach((point, index) => {
      this.spills.push(this.createSpill(point, index));
    });
    return Object.freeze([...this.spills]);
  }

  destroy(): void {
    this.staticObjects.splice(0).forEach((object) => object.destroy());
    this.spills.splice(0).forEach((spill) => spill.destroy(true));
  }

  private createSpill(
    point: NavigationPoint,
    index: number
  ): Phaser.GameObjects.Container {
    const { scene, config } = this;
    const visual = config.visual;
    const width = visual.spillBaseSize.width + (index % 2) * 16;
    const height = visual.spillBaseSize.height + (index % 3) * 5;

    const shadow = scene.add.ellipse(
      3,
      5,
      width * 1.05,
      height * 0.94,
      0x273a3f,
      0.22
    );
    const base = scene.add.ellipse(
      0,
      0,
      width,
      height,
      visual.spillColor,
      0.5
    ).setStrokeStyle(2, visual.spillEdgeColor, 0.58);
    const leftLobe = scene.add.ellipse(
      -width * 0.27,
      -height * 0.04,
      width * 0.56,
      height * 0.72,
      visual.spillColor,
      0.42
    );
    const rightLobe = scene.add.ellipse(
      width * 0.25,
      height * 0.08,
      width * 0.48,
      height * 0.62,
      visual.spillColor,
      0.4
    );
    const shine = scene.add.ellipse(
      -width * 0.18,
      -height * 0.15,
      width * 0.22,
      Math.max(5, height * 0.16),
      visual.spillHighlightColor,
      0.5
    );

    return scene.add.container(point.x, point.y, [
      shadow,
      base,
      leftLobe,
      rightLobe,
      shine
    ])
      .setDepth(9)
      .setAngle([-5, 4, -2, 6][index % 4] ?? 0)
      .setName(`clean-spill-${index + 1}`);
  }
}
