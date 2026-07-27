import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  applyCommercialLevelCompletion,
  createDefaultCommercialProfile,
  type CommercialProfileSnapshot,
  type CommercialUpgradeId
} from "../../application/CommercialProfile";
import {
  COMMERCIAL_UPGRADES,
  commercialLevelCoinReward,
  commercialMoveLimitBonus,
  commercialUndoLimit,
  commercialUpgradeCost,
  purchaseCommercialUpgrade
} from "../../application/CommercialUpgrades";
import { COMMERCIAL_VERTICAL_SLICE_LEVELS } from "../../content/commercial/commercialShelfSortLevels";
import { BrowserCommercialProfileStore } from "../../infrastructure/browser/BrowserCommercialProfileStore";
import {
  commercialProductAsset,
  commercialProductAssetsForLevels
} from "../assets/CommercialProductAssets";
import { tightenCommercialProductImage } from "../assets/CommercialProductTextureCrop";
import {
  createShelfSortState,
  moveShelfProduct,
  shelfSortProgress,
  type ShelfBayState,
  type ShelfSortLevelDefinition,
  type ShelfSortState
} from "../../systems/shelfSort/ShelfSortEngine";

const GAME_WIDTH = 750;
const GAME_HEIGHT = 1334;
const BOARD_TOP = 304;
const BOARD_HEIGHT = 770;
const BOARD_SIDE_PADDING = 48;
const BOARD_GAP = 14;
const CONTROL_TOP = 1160;

interface SceneStartData {
  readonly levelIndex?: number;
}

interface ShelfBayView {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;
}

const clampLevelIndex = (index: number): number => {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(COMMERCIAL_VERTICAL_SLICE_LEVELS.length - 1, Math.floor(index)));
};

const levelIndexFromLocation = (): number | undefined => {
  const value = new URLSearchParams(window.location.search).get("commercialLevel");
  if (!value) return undefined;
  return clampLevelIndex(Number(value) - 1);
};

const fallbackProductColor = (productId: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < productId.length; index += 1) {
    hash ^= productId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const red = 105 + (Math.abs(hash) % 105);
  const green = 105 + (Math.abs(hash >> 8) % 105);
  const blue = 105 + (Math.abs(hash >> 16) % 105);
  return (red << 16) | (green << 8) | blue;
};

const fallbackProductLabel = (productId: string): string => productId
  .split("-")
  .map((part) => part.slice(0, 1).toUpperCase())
  .join("")
  .slice(0, 3);

export class CommercialShelfSortScene extends Phaser.Scene {
  private levelIndex = 0;
  private level!: ShelfSortLevelDefinition;
  private state!: ShelfSortState;
  private selectedBayId?: string;
  private readonly history: ShelfSortState[] = [];
  private readonly bayViews: ShelfBayView[] = [];
  private readonly profileStore = new BrowserCommercialProfileStore();
  private profile: CommercialProfileSnapshot = createDefaultCommercialProfile();
  private undoUses = 0;
  private movesText?: Phaser.GameObjects.Text;
  private setsText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private walletText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private progressBar?: Phaser.GameObjects.Graphics;
  private completionLayer?: Phaser.GameObjects.Container;
  private levelPickerLayer?: Phaser.GameObjects.Container;
  private storeLayer?: Phaser.GameObjects.Container;

  constructor() {
    super("commercial-shelf-sort");
  }

  init(data: SceneStartData = {}): void {
    this.profile = this.profileStore.load();
    const queryLevelIndex = levelIndexFromLocation();
    const requestedLevelIndex = data.levelIndex ?? queryLevelIndex ?? this.profile.currentLevelIndex;
    const canOpenLockedLevel = queryLevelIndex !== undefined || (
      new URLSearchParams(window.location.search).get("test") === "1"
    );
    this.levelIndex = clampLevelIndex(canOpenLockedLevel
      ? requestedLevelIndex
      : Math.min(requestedLevelIndex, this.profile.unlockedLevelIndex));

    const configuredLevel = COMMERCIAL_VERTICAL_SLICE_LEVELS[this.levelIndex];
    if (!configuredLevel) throw new Error(`Commercial shelf-sort level ${this.levelIndex + 1} is missing`);
    const moveLimitBonus = commercialMoveLimitBonus(this.profile);
    this.level = Object.freeze({
      ...configuredLevel,
      moveLimit: configuredLevel.moveLimit === undefined
        ? undefined
        : configuredLevel.moveLimit + moveLimitBonus
    });
    this.state = createShelfSortState(this.level);
    this.selectedBayId = undefined;
    this.undoUses = 0;
    this.history.length = 0;
  }

  preload(): void {
    for (const asset of commercialProductAssetsForLevels(COMMERCIAL_VERTICAL_SLICE_LEVELS)) {
      if (!this.textures.exists(asset.textureKey)) this.load.image(asset.textureKey, asset.path);
    }
  }

  create(): void {
    document.body.dataset.gameScene = "commercial-shelf-sort";
    document.body.dataset.activeMode = "shelf-restock-puzzle";
    document.body.dataset.activeLevel = this.level.id;
    document.body.dataset.commercialLevel = String(this.levelIndex + 1);
    document.body.dataset.commercialCoins = String(this.profile.coins);
    document.body.dataset.commercialStars = String(this.profile.totalStars);
    document.body.dataset.commercialVisuals = "commercial-shelf-v2";
    document.body.dataset.commercialUpgrades = JSON.stringify(this.profile.upgrades);

    this.cameras.main.setBackgroundColor("#f5ecd7");
    this.createBackground();
    this.createHeader();
    this.createControls();
    this.renderBoard();
    this.syncHud(this.levelIndex === 0
      ? "Tap a product shelf, then tap an open shelf."
      : "Match three identical products to clear the store.");
    this.createTutorialPulse();

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      game: "shelf-rush-market",
      version: "commercial-rebuild-v2",
      campaign: "commercial-vertical-slice",
      level: this.level.id,
      mode: "shelf-restock-puzzle"
    });
    crazyGamesPlatform.reportProgress((this.levelIndex / COMMERCIAL_VERTICAL_SLICE_LEVELS.length) * 100);
  }

  private createBackground(): void {
    const background = this.add.graphics().setDepth(-20);
    background.fillStyle(0xf7efdc, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    background.fillStyle(0x1f5646, 1);
    background.fillRect(0, 0, GAME_WIDTH, 252);
    background.fillStyle(0x174538, 1);
    background.fillRect(0, 0, GAME_WIDTH, 18);

    for (let x = -20; x < GAME_WIDTH + 40; x += 86) {
      background.fillStyle(((x / 86) % 2 === 0) ? 0xf4c85b : 0xfff3cf, 1);
      background.fillRoundedRect(x, 18, 86, 24, 0);
    }

    background.fillStyle(0xd8c6a1, 0.42);
    background.fillRect(0, 1092, GAME_WIDTH, GAME_HEIGHT - 1092);
    background.lineStyle(2, 0xb9a984, 0.32);
    for (let y = 1118; y < GAME_HEIGHT; y += 48) background.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 28; x < GAME_WIDTH; x += 92) background.lineBetween(x, 1092, x - 55, GAME_HEIGHT);

    background.fillStyle(0x000000, 0.12);
    background.fillRoundedRect(24, 290, 702, 806, 34);
    background.fillStyle(0xfffbf1, 1);
    background.fillRoundedRect(28, 284, 694, 806, 34);
    background.lineStyle(3, 0xe1d3b7, 1);
    background.strokeRoundedRect(28, 284, 694, 806, 34);

    background.fillStyle(0xe9dcc0, 0.52);
    background.fillRoundedRect(48, 312, 654, 750, 28);
  }

  private createHeader(): void {
    this.add.text(38, 58, "SHELF RUSH", {
      fontFamily: "Arial, sans-serif",
      fontSize: "27px",
      fontStyle: "bold",
      color: "#ffd86b",
      letterSpacing: 3
    });

    this.add.text(38, 96, this.level.title, {
      fontFamily: "Arial, sans-serif",
      fontSize: "43px",
      fontStyle: "bold",
      color: "#ffffff"
    });

    this.createHeaderPill(38, 158, 126, 54, `LEVEL ${this.levelIndex + 1}`, 0xffd86b, 0x20382f);
    this.createHeaderPill(178, 158, 148, 54, "MOVES", 0xffffff, 0x20382f);
    this.createHeaderPill(340, 158, 148, 54, "SETS", 0xffffff, 0x20382f);
    this.createHeaderPill(502, 158, 210, 54, "WALLET", 0xffffff, 0x20382f);

    this.movesText = this.add.text(252, 185, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "19px",
      fontStyle: "bold",
      color: "#1f4237"
    }).setOrigin(0.5);

    this.setsText = this.add.text(414, 185, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "19px",
      fontStyle: "bold",
      color: "#1f4237"
    }).setOrigin(0.5);

    this.walletText = this.add.text(607, 185, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#1f4237"
    }).setOrigin(0.5);

    this.progressBar = this.add.graphics();
    this.feedbackText = this.add.text(GAME_WIDTH / 2, 264, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#36584d",
      align: "center",
      wordWrap: { width: 650 }
    }).setOrigin(0.5);

    this.scoreText = this.add.text(690, 70, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "17px",
      fontStyle: "bold",
      color: "#c5e3d8",
      align: "right"
    }).setOrigin(1, 0);
  }

  private createHeaderPill(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fillColor: number,
    textColor: number
  ): void {
    const pill = this.add.graphics();
    pill.fillStyle(fillColor, 1);
    pill.fillRoundedRect(x, y, width, height, 18);
    pill.lineStyle(2, 0xffffff, 0.18);
    pill.strokeRoundedRect(x, y, width, height, 18);
    this.add.text(x + width / 2, y + 13, label, {
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: `#${textColor.toString(16).padStart(6, "0")}`,
      letterSpacing: 1
    }).setOrigin(0.5);
  }

  private createControls(): void {
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.13);
    panel.fillRoundedRect(24, CONTROL_TOP + 6, 702, 146, 32);
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(24, CONTROL_TOP, 702, 146, 32);
    panel.lineStyle(2, 0xd9ccb1, 1);
    panel.strokeRoundedRect(24, CONTROL_TOP, 702, 146, 32);

    this.createNavButton(52, 1178, 148, 104, "↶", "UNDO", () => this.undo());
    this.createNavButton(218, 1178, 148, 104, "↻", "RESTART", () => this.restartLevel());
    this.createNavButton(384, 1178, 148, 104, "▦", "LEVELS", () => this.showLevelPicker());
    this.createNavButton(550, 1178, 148, 104, "◆", "STORE", () => this.showStore(), true);
  }

  private createNavButton(
    x: number,
    y: number,
    width: number,
    height: number,
    icon: string,
    label: string,
    onClick: () => void,
    primary = false
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x + width / 2, y + height / 2);
    const background = this.add.graphics();
    background.fillStyle(primary ? 0xf4bd49 : 0xf5f0e5, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
    background.lineStyle(2, primary ? 0xd79d26 : 0xd8ccb5, 1);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 22);

    const iconText = this.add.text(0, -14, icon, {
      fontFamily: "Arial, sans-serif",
      fontSize: "34px",
      fontStyle: "bold",
      color: "#245143"
    }).setOrigin(0.5);

    const labelText = this.add.text(0, 29, label, {
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#245143",
      letterSpacing: 1
    }).setOrigin(0.5);

    container.add([background, iconText, labelText]);
    container.setSize(width, height).setInteractive({ useHandCursor: true });
    container.on("pointerover", () => container.setScale(1.025));
    container.on("pointerout", () => container.setScale(1));
    container.on("pointerdown", () => {
      this.tweens.add({
        targets: container,
        scaleX: 0.94,
        scaleY: 0.94,
        duration: 70,
        yoyo: true,
        onComplete: onClick
      });
    });
    return container;
  }

  private renderBoard(): void {
    this.bayViews.splice(0).forEach((view) => view.container.destroy(true));

    const columns = this.level.layoutId === "2x2" ? 2 : this.level.layoutId === "4x3" ? 4 : 3;
    const rows = Math.ceil(this.state.bays.length / columns);
    const availableWidth = GAME_WIDTH - BOARD_SIDE_PADDING * 2;
    const bayWidth = (availableWidth - BOARD_GAP * (columns - 1)) / columns;
    const bayHeight = Math.min(244, (BOARD_HEIGHT - BOARD_GAP * (rows - 1)) / rows);
    const gridHeight = rows * bayHeight + BOARD_GAP * (rows - 1);
    const gridTop = BOARD_TOP + (BOARD_HEIGHT - gridHeight) / 2;

    this.state.bays.forEach((bayState, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = BOARD_SIDE_PADDING + bayWidth / 2 + column * (bayWidth + BOARD_GAP);
      const y = gridTop + bayHeight / 2 + row * (bayHeight + BOARD_GAP);
      const container = this.createBayView(bayState, x, y, bayWidth, bayHeight);
      this.bayViews.push({ id: bayState.id, container });

      container.setScale(0.96);
      container.setAlpha(0.72);
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 130,
        delay: Math.min(90, index * 12),
        ease: "Back.easeOut"
      });
    });
  }

  private createBayView(
    bayState: ShelfBayState,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const selected = bayState.id === this.selectedBayId;
    const container = this.add.container(x, y - (selected ? 5 : 0));
    container.setData("shelfBayId", bayState.id);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x5d3d26, 0.2);
    shadow.fillRoundedRect(-width / 2 + 2, -height / 2 + 8, width - 4, height, 18);

    const frame = this.add.graphics();
    if (selected) {
      frame.fillStyle(0xffd665, 0.34);
      frame.fillRoundedRect(-width / 2 - 7, -height / 2 - 7, width + 14, height + 14, 23);
    }
    frame.fillStyle(bayState.locked ? 0x8c8a82 : 0xb96f3e, 1);
    frame.fillRoundedRect(-width / 2, -height / 2, width, height, 18);
    frame.lineStyle(selected ? 4 : 2, selected ? 0xffc62d : 0x7c472c, 1);
    frame.strokeRoundedRect(-width / 2, -height / 2, width, height, 18);

    frame.fillStyle(bayState.locked ? 0x4c504d : 0xfff7df, 1);
    frame.fillRoundedRect(-width / 2 + 8, -height / 2 + 9, width - 16, height - 29, 13);

    frame.fillStyle(0xffffff, 0.42);
    frame.fillRoundedRect(-width / 2 + 13, -height / 2 + 14, width - 26, 10, 5);

    const shelfLip = this.add.graphics();
    shelfLip.fillStyle(0x7d4428, 1);
    shelfLip.fillRoundedRect(-width / 2 - 2, height / 2 - 28, width + 4, 28, 7);
    shelfLip.fillStyle(0xd58a50, 1);
    shelfLip.fillRoundedRect(-width / 2 + 3, height / 2 - 28, width - 6, 9, 4);
    shelfLip.lineStyle(2, 0x61331f, 0.8);
    shelfLip.lineBetween(-width / 2 + 5, height / 2 - 5, width / 2 - 5, height / 2 - 5);

    container.add([shadow, frame, shelfLip]);
    this.addProductSlots(container, bayState, width, height);

    if (selected) {
      const selectedTag = this.add.text(0, -height / 2 - 12, "SELECTED", {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#1f4237",
        backgroundColor: "#ffd665",
        padding: { x: 10, y: 5 }
      }).setOrigin(0.5);
      container.add(selectedTag);
    }

    if (bayState.locked) {
      const lockShade = this.add.rectangle(0, -2, width - 16, height - 31, 0x24332e, 0.72);
      const lockText = this.add.text(0, -2, "LOCKED", {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.max(14, Math.min(22, width * 0.11))}px`,
        fontStyle: "bold",
        color: "#ffffff",
        letterSpacing: 2
      }).setOrigin(0.5);
      container.add([lockShade, lockText]);
    }

    container.setSize(width, height).setInteractive({ useHandCursor: !bayState.locked });
    container.on("pointerdown", () => this.handleBaySelection(bayState.id));
    return container;
  }

  private addProductSlots(
    container: Phaser.GameObjects.Container,
    bayState: ShelfBayState,
    width: number,
    height: number
  ): void {
    const usableWidth = width - 22;
    const slotWidth = usableWidth / 3;
    const baseline = height / 2 - 27;
    const targetHeight = Math.max(58, height - 48);

    for (let index = 0; index < 3; index += 1) {
      const slotX = -usableWidth / 2 + slotWidth / 2 + index * slotWidth;
      const separator = this.add.graphics();
      if (index > 0) {
        separator.lineStyle(1, 0xc9b996, 0.45);
        separator.lineBetween(slotX - slotWidth / 2, -height / 2 + 28, slotX - slotWidth / 2, height / 2 - 34);
      }
      container.add(separator);

      const productId = bayState.items[index];
      if (!productId) {
        const emptyMark = this.add.ellipse(slotX, baseline - 2, Math.max(18, slotWidth * 0.44), 8, 0xb9a986, 0.18);
        container.add(emptyMark);
        continue;
      }

      const asset = commercialProductAsset(productId);
      const productShadow = this.add.ellipse(
        slotX,
        baseline - 2,
        Math.max(22, slotWidth * 0.72),
        Math.max(7, height * 0.055),
        0x3f2b1e,
        0.22
      );
      container.add(productShadow);

      if (asset && this.textures.exists(asset.textureKey)) {
        const image = this.add.image(slotX, baseline, asset.textureKey);
        image.setData("productId", productId);
        image.setData("displayName", asset.displayName);
        container.add(image);

        tightenCommercialProductImage(image);
        image.setOrigin(0.5, 1);
        const textureWidth = Math.max(1, image.width);
        const textureHeight = Math.max(1, image.height);
        const scale = Math.min(
          (slotWidth * 0.94) / textureWidth,
          targetHeight / textureHeight
        );
        image.setScale(scale);
        image.setPosition(slotX, baseline);
      } else {
        const product = this.add.graphics();
        product.fillStyle(fallbackProductColor(productId), 1);
        product.fillRoundedRect(
          slotX - slotWidth * 0.38,
          baseline - targetHeight * 0.72,
          slotWidth * 0.76,
          targetHeight * 0.72,
          12
        );
        product.lineStyle(3, 0xffffff, 0.35);
        product.strokeRoundedRect(
          slotX - slotWidth * 0.38,
          baseline - targetHeight * 0.72,
          slotWidth * 0.76,
          targetHeight * 0.72,
          12
        );
        const text = this.add.text(slotX, baseline - targetHeight * 0.36, fallbackProductLabel(productId), {
          fontFamily: "Arial, sans-serif",
          fontSize: `${Math.max(14, Math.min(23, slotWidth * 0.28))}px`,
          fontStyle: "bold",
          color: "#ffffff"
        }).setOrigin(0.5);
        container.add([product, text]);
      }
    }
  }

  private createTutorialPulse(): void {
    if (this.levelIndex !== 0 || this.profile.completedLevelIds.includes(this.level.id)) return;
    const firstBay = this.bayViews[0]?.container;
    if (!firstBay) return;
    this.tweens.add({
      targets: firstBay,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 620,
      yoyo: true,
      repeat: 4,
      ease: "Sine.easeInOut"
    });
  }

  private modalOpen(): boolean {
    return Boolean(this.levelPickerLayer || this.storeLayer || this.completionLayer);
  }

  private handleBaySelection(bayId: string): void {
    if (this.state.status !== "playing" || this.modalOpen()) return;
    const bay = this.state.bays.find((candidate) => candidate.id === bayId);
    if (!bay || bay.locked) return;

    if (!this.selectedBayId) {
      if (bay.items.length === 0) {
        this.syncHud("Choose a shelf with a product first.");
        return;
      }
      this.selectedBayId = bayId;
      this.renderBoard();
      this.syncHud("Good. Now choose an open destination shelf.");
      return;
    }

    if (this.selectedBayId === bayId) {
      this.selectedBayId = undefined;
      this.renderBoard();
      this.syncHud("Selection cancelled.");
      return;
    }

    const previousState = this.state;
    const result = moveShelfProduct(this.state, this.selectedBayId, bayId);
    if (!result.accepted) {
      this.syncHud(this.copyForRejectReason(result.reason));
      return;
    }

    this.history.push(previousState);
    this.state = result.state;
    this.selectedBayId = undefined;
    this.renderBoard();
    this.syncHud(result.clearedProductId ? "Perfect match! Three products cleared." : "Product moved.");

    if (this.state.status === "complete") this.showCompletion(true);
    if (this.state.status === "failed") this.showCompletion(false);
  }

  private copyForRejectReason(reason: string | undefined): string {
    switch (reason) {
      case "destination-full": return "That shelf is full. Pick another destination.";
      case "destination-locked": return "That shelf is locked.";
      case "source-empty": return "That shelf is empty.";
      default: return "That move is not available.";
    }
  }

  private syncHud(message: string): void {
    const limit = this.state.moveLimit === undefined ? "∞" : String(this.state.moveLimit);
    const undoRemaining = Math.max(0, commercialUndoLimit(this.profile) - this.undoUses);
    this.movesText?.setText(`${this.state.moves} / ${limit}`);
    this.setsText?.setText(`${this.state.completedSets} / ${this.state.targetSetCount}`);
    this.walletText?.setText(`● ${this.profile.coins}   ★ ${this.profile.totalStars}`);
    this.scoreText?.setText(`SCORE ${this.state.score}\nUNDO ${undoRemaining}`);
    this.feedbackText?.setText(message);

    document.body.dataset.commercialCoins = String(this.profile.coins);
    document.body.dataset.commercialStars = String(this.profile.totalStars);
    document.body.dataset.commercialUpgrades = JSON.stringify(this.profile.upgrades);

    const progress = shelfSortProgress(this.state);
    this.progressBar?.clear();
    this.progressBar?.fillStyle(0x0e3328, 0.68);
    this.progressBar?.fillRoundedRect(38, 230, 674, 10, 5);
    this.progressBar?.fillStyle(0xffcf56, 1);
    this.progressBar?.fillRoundedRect(38, 230, Math.max(10, 674 * progress), 10, 5);
  }

  private undo(): void {
    if (this.state.status !== "playing" || this.modalOpen()) return;
    const undoLimit = commercialUndoLimit(this.profile);
    if (this.undoUses >= undoLimit) {
      this.syncHud("No undo charges left. Upgrade Smart Scanner in Store.");
      return;
    }
    const previous = this.history.pop();
    if (!previous) {
      this.syncHud("There is no move to undo.");
      return;
    }
    this.undoUses += 1;
    this.state = previous;
    this.selectedBayId = undefined;
    this.renderBoard();
    this.syncHud("Last move undone.");
  }

  private restartLevel(): void {
    if (this.modalOpen()) return;
    crazyGamesPlatform.gameplayStop();
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  private createModalShell(titleText: string, accent: number, height = 960): {
    readonly layer: Phaser.GameObjects.Container;
    readonly card: Phaser.GameObjects.Graphics;
  } {
    const layer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1000);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12221d, 0.84).setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.18);
    card.fillRoundedRect(-327, -height / 2 + 8, 654, height, 34);
    card.fillStyle(0xfffbf1, 1);
    card.fillRoundedRect(-327, -height / 2, 654, height, 34);
    card.lineStyle(4, accent, 1);
    card.strokeRoundedRect(-327, -height / 2, 654, height, 34);
    const ribbon = this.add.graphics();
    ribbon.fillStyle(accent, 1);
    ribbon.fillRoundedRect(-327, -height / 2, 654, 112, 32);
    ribbon.fillRect(-327, -height / 2 + 72, 654, 40);
    const title = this.add.text(0, -height / 2 + 56, titleText, {
      fontFamily: "Arial, sans-serif",
      fontSize: "34px",
      fontStyle: "bold",
      color: "#20483b"
    }).setOrigin(0.5);
    layer.add([shade, card, ribbon, title]);
    return { layer, card };
  }

  private createModalButton(
    layer: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    label: string,
    onClick: () => void,
    primary = true
  ): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const background = this.add.graphics();
    background.fillStyle(primary ? 0xf2bd49 : 0xe9e1cf, 1);
    background.fillRoundedRect(-width / 2, -37, width, 74, 20);
    background.lineStyle(2, primary ? 0xd79a22 : 0xcbbda2, 1);
    background.strokeRoundedRect(-width / 2, -37, width, 74, 20);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial, sans-serif",
      fontSize: "21px",
      fontStyle: "bold",
      color: "#20483b"
    }).setOrigin(0.5);
    button.add([background, text]);
    button.setSize(width, 74).setInteractive({ useHandCursor: true });
    button.on("pointerdown", onClick);
    layer.add(button);
    return button;
  }

  private showLevelPicker(): void {
    if (this.modalOpen()) return;
    crazyGamesPlatform.gameplayStop();
    const { layer } = this.createModalShell("CHOOSE A LEVEL", 0xffcf56, 1030);
    const progress = this.add.text(
      0,
      -420,
      `${this.profile.completedLevelIds.length}/${COMMERCIAL_VERTICAL_SLICE_LEVELS.length} complete  •  ${this.profile.totalStars} stars`,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#527166"
      }
    ).setOrigin(0.5);
    layer.add(progress);

    COMMERCIAL_VERTICAL_SLICE_LEVELS.forEach((level, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = column === 0 ? -156 : 156;
      const y = -320 + row * 137;
      const unlocked = index <= this.profile.unlockedLevelIndex;
      const stars = this.profile.starsByLevel[level.id] ?? 0;
      const button = this.add.container(x, y);
      const background = this.add.graphics();
      background.fillStyle(unlocked ? 0xffffff : 0xe9e4d9, 1);
      background.fillRoundedRect(-137, -52, 274, 104, 20);
      background.lineStyle(3, index === this.levelIndex ? 0xffbe32 : 0xd8ccb5, 1);
      background.strokeRoundedRect(-137, -52, 274, 104, 20);
      const badge = this.add.graphics();
      badge.fillStyle(unlocked ? 0x2a604f : 0x9b9d98, 1);
      badge.fillCircle(-95, 0, 31);
      const number = this.add.text(-95, 0, unlocked ? String(index + 1) : "×", {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#ffffff"
      }).setOrigin(0.5);
      const name = this.add.text(-50, -24, level.title, {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: unlocked ? "#274d41" : "#8d928d",
        wordWrap: { width: 170 }
      });
      const rating = this.add.text(-50, 14, stars > 0 ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "Not cleared", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: stars > 0 ? "#e9a91e" : "#9b9d98"
      });
      button.add([background, badge, number, name, rating]);
      button.setSize(274, 104);
      if (unlocked) {
        button.setInteractive({ useHandCursor: true });
        button.on("pointerdown", () => {
          layer.destroy(true);
          this.levelPickerLayer = undefined;
          this.scene.restart({ levelIndex: index });
        });
      }
      layer.add(button);
    });

    this.createModalButton(layer, 0, 445, 370, "BACK TO GAME", () => {
      layer.destroy(true);
      this.levelPickerLayer = undefined;
      crazyGamesPlatform.gameplayStart();
    });
    this.levelPickerLayer = layer;
  }

  private showStore(): void {
    if (this.modalOpen()) return;
    crazyGamesPlatform.gameplayStop();
    const { layer } = this.createModalShell("STORE UPGRADES", 0xf2bd49, 1010);
    const balance = this.add.text(0, -406, `● ${this.profile.coins} COINS`, {
      fontFamily: "Arial, sans-serif",
      fontSize: "23px",
      fontStyle: "bold",
      color: "#a56b00"
    }).setOrigin(0.5);
    layer.add(balance);

    const upgradeIds: readonly CommercialUpgradeId[] = ["moveBuffer", "undoCapacity", "coinBoost"];
    upgradeIds.forEach((upgradeId, index) => {
      const definition = COMMERCIAL_UPGRADES[upgradeId];
      const currentLevel = this.profile.upgrades[upgradeId];
      const cost = commercialUpgradeCost(this.profile, upgradeId);
      const y = -245 + index * 220;
      const panel = this.add.container(0, y);
      const panelBackground = this.add.graphics();
      panelBackground.fillStyle(0xffffff, 1);
      panelBackground.fillRoundedRect(-282, -84, 564, 168, 24);
      panelBackground.lineStyle(2, 0xd9ccb5, 1);
      panelBackground.strokeRoundedRect(-282, -84, 564, 168, 24);
      const icon = this.add.graphics();
      icon.fillStyle(0xeaf3ee, 1);
      icon.fillCircle(-226, -1, 43);
      const iconText = this.add.text(-226, -1, String(index + 1), {
        fontFamily: "Arial, sans-serif",
        fontSize: "25px",
        fontStyle: "bold",
        color: "#2b604f"
      }).setOrigin(0.5);
      const name = this.add.text(-165, -52, definition.title, {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontStyle: "bold",
        color: "#274d41"
      });
      const description = this.add.text(-165, -15, definition.description, {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: "#657a72",
        wordWrap: { width: 245 }
      });
      const levelText = this.add.text(-165, 43, `LEVEL ${currentLevel} / ${definition.maxLevel}`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#a56b00"
      });
      const buy = this.add.container(185, 5);
      const buyBackground = this.add.graphics();
      const affordable = cost !== undefined && this.profile.coins >= cost;
      buyBackground.fillStyle(cost === undefined ? 0xd7d6d1 : affordable ? 0xf2bd49 : 0xe2c98e, 1);
      buyBackground.fillRoundedRect(-77, -40, 154, 80, 19);
      const buyText = this.add.text(0, 0, cost === undefined ? "MAX" : `${cost}\nCOINS`, {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: cost === undefined ? "#858781" : "#274d41",
        align: "center"
      }).setOrigin(0.5);
      buy.add([buyBackground, buyText]);
      buy.setSize(154, 80);
      if (cost !== undefined) {
        buy.setInteractive({ useHandCursor: true });
        buy.on("pointerdown", () => this.buyUpgrade(upgradeId));
      }
      panel.add([panelBackground, icon, iconText, name, description, levelText, buy]);
      layer.add(panel);
    });

    this.createModalButton(layer, 0, 428, 370, "BACK TO GAME", () => {
      layer.destroy(true);
      this.storeLayer = undefined;
      crazyGamesPlatform.gameplayStart();
      this.syncHud("Store closed. Upgrades apply on the next level.");
    });
    this.storeLayer = layer;
  }

  private buyUpgrade(upgradeId: CommercialUpgradeId): void {
    const result = purchaseCommercialUpgrade(this.profile, upgradeId);
    if (!result.accepted) {
      this.storeLayer?.destroy(true);
      this.storeLayer = undefined;
      this.syncHud(result.reason === "max-level"
        ? "That upgrade is already maxed."
        : `Not enough coins for ${COMMERCIAL_UPGRADES[upgradeId].title}.`);
      crazyGamesPlatform.gameplayStart();
      return;
    }

    this.profile = result.profile;
    this.profileStore.save(this.profile);
    this.storeLayer?.destroy(true);
    this.storeLayer = undefined;
    this.syncHud(`${COMMERCIAL_UPGRADES[upgradeId].title} upgraded!`);
    this.showStore();
  }

  private showCompletion(success: boolean): void {
    crazyGamesPlatform.gameplayStop();
    let stars: 0 | 1 | 2 | 3 = 0;
    let coinsEarned = 0;

    if (success) {
      stars = this.starsForCurrentRun();
      const previousCoins = this.profile.coins;
      const rewardCoins = commercialLevelCoinReward(this.profile, this.level.reward.coins);
      this.profile = applyCommercialLevelCompletion(this.profile, {
        levelId: this.level.id,
        levelIndex: this.levelIndex,
        moves: this.state.moves,
        stars,
        coins: rewardCoins,
        campaignLevelCount: COMMERCIAL_VERTICAL_SLICE_LEVELS.length
      });
      this.profileStore.save(this.profile);
      coinsEarned = this.profile.coins - previousCoins;
      crazyGamesPlatform.reportProgress(
        ((this.levelIndex + 1) / COMMERCIAL_VERTICAL_SLICE_LEVELS.length) * 100
      );
    }

    this.completionLayer?.destroy(true);
    const layer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1100);
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12221d, 0.86).setInteractive();
    const card = this.add.graphics();
    card.fillStyle(0x000000, 0.2);
    card.fillRoundedRect(-304, -330, 608, 674, 38);
    card.fillStyle(0xfffbf1, 1);
    card.fillRoundedRect(-304, -340, 608, 674, 38);
    card.lineStyle(5, success ? 0xffc53d : 0xe7786f, 1);
    card.strokeRoundedRect(-304, -340, 608, 674, 38);

    const medal = this.add.graphics();
    medal.fillStyle(success ? 0xffcf56 : 0xf3a29b, 1);
    medal.fillCircle(0, -224, 74);
    medal.lineStyle(8, 0xffffff, 0.55);
    medal.strokeCircle(0, -224, 60);

    const medalText = this.add.text(0, -224, success ? "★" : "!", {
      fontFamily: "Arial, sans-serif",
      fontSize: "70px",
      fontStyle: "bold",
      color: "#275143"
    }).setOrigin(0.5);

    const title = this.add.text(0, -112, success ? "SHELF COMPLETE!" : "OUT OF MOVES", {
      fontFamily: "Arial, sans-serif",
      fontSize: "39px",
      fontStyle: "bold",
      color: "#274d41",
      align: "center"
    }).setOrigin(0.5);

    const starText = success ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "";
    const summary = this.add.text(0, 10, success
      ? `${starText}\n${this.state.moves} moves  •  ${this.state.score} points\n+${coinsEarned} coins`
      : "Try a different order.\nYour progress is safe.", {
        fontFamily: "Arial, sans-serif",
        fontSize: "25px",
        fontStyle: "bold",
        color: success ? "#c18400" : "#5e746c",
        align: "center",
        lineSpacing: 14,
        wordWrap: { width: 500 }
      }).setOrigin(0.5);

    const button = this.add.container(0, 194);
    const buttonBackground = this.add.graphics();
    buttonBackground.fillStyle(success ? 0xf2bd49 : 0xe7786f, 1);
    buttonBackground.fillRoundedRect(-220, -42, 440, 84, 23);
    buttonBackground.lineStyle(3, success ? 0xd79a22 : 0xc85b54, 1);
    buttonBackground.strokeRoundedRect(-220, -42, 440, 84, 23);
    const buttonText = this.add.text(0, 0, success ? "NEXT LEVEL" : "TRY AGAIN", {
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#244b3f"
    }).setOrigin(0.5);
    button.add([buttonBackground, buttonText]);
    button.setSize(440, 84).setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => {
      const nextIndex = success
        ? Math.min(this.levelIndex + 1, COMMERCIAL_VERTICAL_SLICE_LEVELS.length - 1)
        : this.levelIndex;
      this.scene.restart({ levelIndex: nextIndex });
    });

    layer.add([shade, card, medal, medalText, title, summary, button]);
    layer.setScale(0.86);
    layer.setAlpha(0);
    this.tweens.add({
      targets: layer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 260,
      ease: "Back.easeOut"
    });
    this.completionLayer = layer;
    this.syncHud(success ? "Progress saved." : "No progress was lost.");
  }

  private starsForCurrentRun(): 1 | 2 | 3 {
    const configuredLimit = COMMERCIAL_VERTICAL_SLICE_LEVELS[this.levelIndex]?.moveLimit;
    const ratingLimit = configuredLimit ?? this.state.moveLimit;
    if (!ratingLimit) return 3;
    if (this.state.moves <= Math.floor(ratingLimit * 0.6)) return 3;
    if (this.state.moves <= Math.floor(ratingLimit * 0.85)) return 2;
    return 1;
  }
}
