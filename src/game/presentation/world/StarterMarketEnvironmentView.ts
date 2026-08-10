import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";

const PURE_BACKGROUND_LEVEL_IDS = new Set(["starter-level-001"]);
const BACKGROUND_LED_LEVEL_IDS = new Set([
  "starter-level-002",
  "starter-level-003",
  "starter-level-004",
  "starter-level-005",
  "starter-level-006",
  "starter-level-007",
  "starter-level-008",
  "starter-level-009",
  "starter-level-010"
]);

/**
 * The authored level plate owns the supermarket environment.
 *
 * Runtime layers are reserved for gameplay state only: worker/customer actors,
 * products, cases, carts, spills, tools and interaction feedback. Static store
 * dressing is intentionally not composed here because the project backgrounds
 * already contain the shelves, checkout lanes and coolers in one coherent
 * perspective/lighting pass.
 */
export class StarterMarketEnvironmentView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {}

  create(): void {
    this.createBase();

    const levelId = this.context.campaignLevel.level.id;
    if (PURE_BACKGROUND_LEVEL_IDS.has(levelId)) {
      document.body.dataset.sceneDressing = "background-only";
    } else if (BACKGROUND_LED_LEVEL_IDS.has(levelId)) {
      document.body.dataset.sceneDressing = levelId === "starter-level-002"
        ? "level-two-focused"
        : "campaign-background-led";
      this.createGameplayCalmWash();
    } else {
      // Future campaign levels default to the same safe rule instead of silently
      // reintroducing decorative runtime shelves/customers.
      document.body.dataset.sceneDressing = "campaign-background-led";
      this.createGameplayCalmWash();
    }

    this.registerRestockCoolerPresentation();
  }

  private createBase(): void {
    const { scene, context } = this;
    const environmentKey = context.levelAssets.environment.key;
    const keepsAuthoredOrientation =
      environmentKey === "environment-starter-market-restock-hd-v3" ||
      environmentKey.startsWith("environment-project-");

    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      environmentKey
    )
      .setOrigin(0.5)
      .setDisplaySize(context.world.width, context.world.height)
      .setFlipX(context.mode === "restock" && !keepsAuthoredOrientation)
      .setDepth(-30)
      .setName("commercial-supermarket-salesfloor");
  }

  private createGameplayCalmWash(): void {
    const { scene, context } = this;
    const isLevelTwo = context.campaignLevel.level.id === "starter-level-002";

    // A neutral wash is the only non-gameplay layer. L2 remains slightly calmer
    // because its memory task needs the strongest single-focus hierarchy.
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0x07110e,
      isLevelTwo ? 0.06 : 0.025
    )
      .setDepth(4)
      .setName(isLevelTwo ? "level-two-background-calm-wash" : "campaign-background-calm-wash");
  }

  private registerRestockCoolerPresentation(): void {
    if (this.context.mode !== "restock") {
      document.body.dataset.restockCoolerBackground = "not-applicable";
      delete document.body.dataset.restockCoolerAsset;
      return;
    }

    document.body.dataset.restockCoolerBackground = this.context.levelAssets.environment.key === "environment-project-restock-v2"
      ? "project-v2"
      : "production-v3-hd";
    document.body.dataset.restockCoolerAsset = "background-integrated-gameplay-only";
  }
}
