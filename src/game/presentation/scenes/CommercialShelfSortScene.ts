import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { COMMERCIAL_VERTICAL_SLICE_LEVELS } from "../../content/commercial/commercialShelfSortLevels";
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
const BOARD_TOP = 300;
const BOARD_SIDE_PADDING = 36;
const BOARD_GAP = 18;

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

const levelIndexFromLocation = (): number => {
  const value = new URLSearchParams(window.location.search).get("commercialLevel");
  if (!value) return 0;
  return clampLevelIndex(Number(value) - 1);
};

const productColor = (productId: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < productId.length; index += 1) {
    hash ^= productId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const red = 80 + (Math.abs(hash) % 130);
  const green = 80 + (Math.abs(hash >> 8) % 130);
  const blue = 80 + (Math.abs(hash >> 16) % 130);
  return (red << 16) | (green << 8) | blue;
};

const productLabel = (productId: string): string => productId
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
  private headerText?: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private progressBar?: Phaser.GameObjects.Graphics;
  private completionLayer?: Phaser.GameObjects.Container;

  constructor() {
    super("commercial-shelf-sort");
  }

  init(data: SceneStartData = {}): void {
    this.levelIndex = clampLevelIndex(data.levelIndex ?? levelIndexFromLocation());
    const level = COMMERCIAL_VERTICAL_SLICE_LEVELS[this.levelIndex];
    if (!level) throw new Error(`Commercial shelf-sort level ${this.levelIndex + 1} is missing`);
    this.level = level;
    this.state = createShelfSortState(level);
    this.selectedBayId = undefined;
    this.history.length = 0;
  }

  create(): void {
    document.body.dataset.gameScene = "commercial-shelf-sort";
    document.body.dataset.activeMode = "shelf-restock-puzzle";
    document.body.dataset.activeLevel = this.level.id;
    document.body.dataset.commercialLevel = String(this.levelIndex + 1);
    this.cameras.main.setBackgroundColor("#13231f");

    this.createBackground();
    this.createHeader();
    this.createControls();
    this.renderBoard();
    this.syncHud("Tap a product bay, then choose a destination.");

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      game: "shelf-rush-market",
      version: "commercial-rebuild-v1",
      campaign: "commercial-vertical-slice",
      level: this.level.id,
      mode: "shelf-restock-puzzle"
    });
    crazyGamesPlatform.reportProgress((this.levelIndex / COMMERCIAL_VERTICAL_SLICE_LEVELS.length) * 100);
  }

  private createBackground(): void {
    const background = this.add.graphics();
    background.fillStyle(0x13231f, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(0x1c342d, 1);
    background.fillRoundedRect(18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36, 34);
    background.fillStyle(0xf2c14e, 0.08);
    background.fillCircle(650, 110, 170);
    background.fillCircle(90, 1210, 220);
  }

  private createHeader(): void {
    this.add.text(44, 48, "SHELF RUSH", {
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#f2c14e",
      letterSpacing: 4
    });

    this.headerText = this.add.text(44, 92, this.level.title, {
      fontFamily: "Arial, sans-serif",
      fontSize: "50px",
      fontStyle: "bold",
      color: "#ffffff"
    });

    this.add.text(46, 158, `LEVEL ${this.levelIndex + 1} / ${COMMERCIAL_VERTICAL_SLICE_LEVELS.length}`, {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#a9c7bc"
    });

    this.statsText = this.add.text(704, 58, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "right"
    }).setOrigin(1, 0);

    this.progressBar = this.add.graphics();
    this.feedbackText = this.add.text(GAME_WIDTH / 2, 238, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#d8e9e2",
      align: "center",
      wordWrap: { width: 650 }
    }).setOrigin(0.5);
  }

  private createControls(): void {
    this.createTextButton(48, 1240, 190, 62, "UNDO", () => this.undo());
    this.createTextButton(280, 1240, 190, 62, "RESTART", () => this.restartLevel());
    this.createTextButton(512, 1240, 190, 62, "LEVELS", () => this.openLevelPicker());
  }

  private createTextButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x + width / 2, y + height / 2);
    const background = this.add.graphics();
    background.fillStyle(0x274b40, 1);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    background.lineStyle(2, 0x5c8f7f, 1);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
    const text = this.add.text(0, 0, label, {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff"
    }).setOrigin(0.5);

    container.add([background, text]);
    container.setSize(width, height).setInteractive({ useHandCursor: true });
    container.on("pointerover", () => container.setScale(1.03));
    container.on("pointerout", () => container.setScale(1));
    container.on("pointerdown", onClick);
    return container;
  }

  private renderBoard(): void {
    this.bayViews.splice(0).forEach((view) => view.container.destroy(true));

    const columns = this.level.layoutId === "2x2" ? 2 : this.level.layoutId === "4x3" ? 4 : 3;
    const rows = Math.ceil(this.state.bays.length / columns);
    const availableWidth = GAME_WIDTH - BOARD_SIDE_PADDING * 2;
    const bayWidth = (availableWidth - BOARD_GAP * (columns - 1)) / columns;
    const availableHeight = 860;
    const bayHeight = Math.min(185, (availableHeight - BOARD_GAP * (rows - 1)) / rows);

    this.state.bays.forEach((bayState, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = BOARD_SIDE_PADDING + bayWidth / 2 + column * (bayWidth + BOARD_GAP);
      const y = BOARD_TOP + bayHeight / 2 + row * (bayHeight + BOARD_GAP);
      const container = this.createBayView(bayState, x, y, bayWidth, bayHeight);
      this.bayViews.push({ id: bayState.id, container });
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
    const container = this.add.container(x, y);
    const frame = this.add.graphics();
    frame.fillStyle(selected ? 0x365f52 : 0x203a32, 1);
    frame.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
    frame.lineStyle(selected ? 5 : 2, selected ? 0xf2c14e : 0x557a6e, 1);
    frame.strokeRoundedRect(-width / 2, -height / 2, width, height, 20);

    const shelf = this.add.graphics();
    shelf.fillStyle(0x0d1c18, 0.75);
    shelf.fillRoundedRect(-width / 2 + 10, height / 2 - 26, width - 20, 14, 7);

    const label = this.add.text(-width / 2 + 14, -height / 2 + 10, bayState.locked ? "LOCKED" : bayState.id.toUpperCase(), {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: bayState.locked ? "#f08a8a" : "#8fb4a7"
    });

    container.add([frame, shelf, label]);
    this.addProductSlots(container, bayState, width, height);
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
    const slotGap = 8;
    const usableWidth = width - 30;
    const slotWidth = (usableWidth - slotGap * 2) / 3;
    const slotHeight = Math.max(54, height - 60);
    const slotY = 12;

    for (let index = 0; index < 3; index += 1) {
      const slotX = -usableWidth / 2 + slotWidth / 2 + index * (slotWidth + slotGap);
      const slot = this.add.graphics();
      slot.fillStyle(0x132720, 0.65);
      slot.fillRoundedRect(-slotWidth / 2, -slotHeight / 2, slotWidth, slotHeight, 12);
      slot.lineStyle(1, 0x41695d, 0.8);
      slot.strokeRoundedRect(-slotWidth / 2, -slotHeight / 2, slotWidth, slotHeight, 12);
      slot.setPosition(slotX, slotY);
      container.add(slot);

      const productId = bayState.items[index];
      if (!productId) continue;

      const product = this.add.graphics();
      product.fillStyle(productColor(productId), 1);
      product.fillRoundedRect(-slotWidth / 2 + 5, -slotHeight / 2 + 6, slotWidth - 10, slotHeight - 12, 12);
      product.lineStyle(3, 0xffffff, 0.25);
      product.strokeRoundedRect(-slotWidth / 2 + 5, -slotHeight / 2 + 6, slotWidth - 10, slotHeight - 12, 12);
      product.setPosition(slotX, slotY);

      const text = this.add.text(slotX, slotY, productLabel(productId), {
        fontFamily: "Arial, sans-serif",
        fontSize: `${Math.max(16, Math.min(24, slotWidth * 0.25))}px`,
        fontStyle: "bold",
        color: "#ffffff",
        align: "center"
      }).setOrigin(0.5);

      container.add([product, text]);
    }
  }

  private handleBaySelection(bayId: string): void {
    if (this.state.status !== "playing") return;
    const bay = this.state.bays.find((candidate) => candidate.id === bayId);
    if (!bay || bay.locked) return;

    if (!this.selectedBayId) {
      if (bay.items.length === 0) {
        this.syncHud("Choose a shelf that contains a product first.");
        return;
      }
      this.selectedBayId = bayId;
      this.renderBoard();
      this.syncHud("Now choose an open destination bay.");
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
    this.syncHud(result.clearedProductId ? "Set completed! Shelf cleared." : "Product moved.");

    if (this.state.status === "complete") this.showCompletion(true);
    if (this.state.status === "failed") this.showCompletion(false);
  }

  private copyForRejectReason(reason: string | undefined): string {
    switch (reason) {
      case "destination-full": return "That bay is full. Choose another destination.";
      case "destination-locked": return "That shelf is locked.";
      case "source-empty": return "The selected shelf is empty.";
      default: return "That move is not available.";
    }
  }

  private syncHud(message: string): void {
    const limit = this.state.moveLimit === undefined ? "∞" : String(this.state.moveLimit);
    this.statsText?.setText([
      `MOVES ${this.state.moves} / ${limit}`,
      `SETS ${this.state.completedSets} / ${this.state.targetSetCount}`,
      `SCORE ${this.state.score}`
    ]);
    this.feedbackText?.setText(message);

    const progress = shelfSortProgress(this.state);
    this.progressBar?.clear();
    this.progressBar?.fillStyle(0x0d1c18, 0.9);
    this.progressBar?.fillRoundedRect(44, 204, 662, 14, 7);
    this.progressBar?.fillStyle(0xf2c14e, 1);
    this.progressBar?.fillRoundedRect(44, 204, 662 * progress, 14, 7);
  }

  private undo(): void {
    if (this.state.status !== "playing") return;
    const previous = this.history.pop();
    if (!previous) {
      this.syncHud("No move to undo.");
      return;
    }
    this.state = previous;
    this.selectedBayId = undefined;
    this.renderBoard();
    this.syncHud("Last move undone.");
  }

  private restartLevel(): void {
    crazyGamesPlatform.gameplayStop();
    this.scene.restart({ levelIndex: this.levelIndex });
  }

  private openLevelPicker(): void {
    const nextIndex = (this.levelIndex + 1) % COMMERCIAL_VERTICAL_SLICE_LEVELS.length;
    crazyGamesPlatform.gameplayStop();
    this.scene.restart({ levelIndex: nextIndex });
  }

  private showCompletion(success: boolean): void {
    crazyGamesPlatform.gameplayStop();
    if (success) {
      crazyGamesPlatform.reportProgress(
        ((this.levelIndex + 1) / COMMERCIAL_VERTICAL_SLICE_LEVELS.length) * 100
      );
    }

    this.completionLayer?.destroy(true);
    const layer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(1000);
    const shade = this.add.graphics();
    shade.fillStyle(0x07100d, 0.9);
    shade.fillRect(-GAME_WIDTH / 2, -GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT);
    const card = this.add.graphics();
    card.fillStyle(0x24463c, 1);
    card.fillRoundedRect(-300, -250, 600, 500, 34);
    card.lineStyle(4, success ? 0xf2c14e : 0xe07979, 1);
    card.strokeRoundedRect(-300, -250, 600, 500, 34);

    const title = this.add.text(0, -155, success ? "SHELF COMPLETE" : "OUT OF MOVES", {
      fontFamily: "Arial, sans-serif",
      fontSize: "42px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "center"
    }).setOrigin(0.5);

    const stars = success ? this.starsForCurrentRun() : 0;
    const summary = this.add.text(0, -55, success
      ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}\n${this.state.moves} moves · ${this.state.score} points`
      : "Rearrange the front products more carefully and try again.", {
      fontFamily: "Arial, sans-serif",
      fontSize: "26px",
      color: success ? "#f2c14e" : "#d8e9e2",
      align: "center",
      lineSpacing: 14,
      wordWrap: { width: 500 }
    }).setOrigin(0.5);

    const buttonWidth = 420;
    const buttonHeight = 76;
    const button = this.add.container(0, 130);
    const buttonBackground = this.add.graphics();
    buttonBackground.fillStyle(success ? 0xf2c14e : 0xe07979, 1);
    buttonBackground.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 20);
    const buttonText = this.add.text(0, 0, success ? "NEXT LEVEL" : "TRY AGAIN", {
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#13231f"
    }).setOrigin(0.5);
    button.add([buttonBackground, buttonText]);
    button.setSize(buttonWidth, buttonHeight).setInteractive({ useHandCursor: true });
    button.on("pointerdown", () => {
      const nextIndex = success
        ? (this.levelIndex + 1) % COMMERCIAL_VERTICAL_SLICE_LEVELS.length
        : this.levelIndex;
      this.scene.restart({ levelIndex: nextIndex });
    });

    layer.add([shade, card, title, summary, button]);
    this.completionLayer = layer;
  }

  private starsForCurrentRun(): 1 | 2 | 3 {
    const limit = this.state.moveLimit;
    if (!limit) return 3;
    if (this.state.moves <= Math.floor(limit * 0.6)) return 3;
    if (this.state.moves <= Math.floor(limit * 0.85)) return 2;
    return 1;
  }
}
