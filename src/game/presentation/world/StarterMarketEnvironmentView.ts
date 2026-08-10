import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";

/**
 * The authored level plate owns the supermarket environment.
 *
 * Runtime layers are reserved for gameplay state only: worker/customer actors,
 * products, cases, carts, spills, tools and interaction feedback. Static store
 * dressing is intentionally not composed here because the project backgrounds
 * already contain shelves, checkout lanes and coolers in one coherent
 * perspective/lighting pass.
 *
 * Scene emphasis is driven by gameplay configuration rather than concrete level
 * IDs, so future campaign levels inherit the same visual contract automatically.
 */
export class StarterMarketEnvironmentView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {}

  create(): void {
    this.createBase();

    if (this.isGuidedRestock()) {
      // First-time guided restock gets no non-gameplay overlay at all.
      document.body.dataset.sceneDressing = "background-only";
    } else if (this.isMemoryRestock()) {
      document.body.dataset.sceneDressing = "level-two-focused";
      this.createGameplayCalmWash(true);
    } else {
      document.body.dataset.sceneDressing = "campaign-background-led";
      this.createGameplayCalmWash(false);
    }

    this.registerRestockCoolerPresentation();
  }

  private isGuidedRestock(): boolean {
    return this.context.mode === "restock" &&
      this.context.campaignLevel.level.tuning.rush?.timeoutEnabled === false;
  }

  private isMemoryRestock(): boolean {
    return this.context.mode === "restock" &&
      this.context.campaignLevel.level.tuning.rush?.memoryPreview !== undefined;
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

  private createGameplayCalmWash(memoryRestock: boolean): void {
    const { scene, context } = this;

    // This neutral wash is the only non-gameplay environment layer. Memory
    // restock is slightly calmer because memorization needs the strongest focus.
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0x07110e,
      memoryRestock ? 0.06 : 0.025
    )
      .setDepth(4)
      .setName(memoryRestock ? "level-two-background-calm-wash" : "campaign-background-calm-wash");
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
