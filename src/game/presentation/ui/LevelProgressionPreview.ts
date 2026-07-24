import type { LevelDefinition } from "../../content/GameContent";

export interface LevelProgressionPreviewEntry {
  readonly level: Pick<LevelDefinition, "id" | "title" | "mode">;
  readonly nextLevelId?: string;
  readonly levelNumber: number;
}

export interface LevelProgressionPreview {
  readonly eyebrow: string;
  readonly title: string;
  readonly modeLabel: string;
  readonly description: string;
  readonly currentLevelNumber: number;
  readonly totalLevels: number;
}

const MODE_PREVIEW_COPY: Readonly<Record<LevelDefinition["mode"], {
  readonly label: string;
  readonly description: string;
}>> = Object.freeze({
  restock: Object.freeze({
    label: "RESTOCK",
    description: "Move faster, read the shelf, and keep the promotion fully stocked."
  }),
  checkout: Object.freeze({
    label: "CHECKOUT",
    description: "Open the lane, serve the queue, and keep every customer moving."
  }),
  clean: Object.freeze({
    label: "CLEANING",
    description: "Collect the tools and clear every spill before the store slows down."
  }),
  "find-items": Object.freeze({
    label: "ORDER HUNT",
    description: "Find the requested products before the order timer runs out."
  })
});

export function resolveLevelProgressionPreview(
  activeLevelId: string,
  levels: readonly LevelProgressionPreviewEntry[]
): LevelProgressionPreview {
  if (levels.length === 0) throw new Error("Progression preview requires campaign levels");

  const current = levels.find((entry) => entry.level.id === activeLevelId) ?? levels[0];
  if (!current) throw new Error("Progression preview could not resolve the current level");

  const next = current.nextLevelId
    ? levels.find((entry) => entry.level.id === current.nextLevelId)
    : undefined;

  if (next) {
    const copy = MODE_PREVIEW_COPY[next.level.mode];
    return Object.freeze({
      eyebrow: "UP NEXT",
      title: next.level.title,
      modeLabel: copy.label,
      description: copy.description,
      currentLevelNumber: current.levelNumber,
      totalLevels: levels.length
    });
  }

  return Object.freeze({
    eyebrow: "CAMPAIGN MASTERED",
    title: "Build a stronger week",
    modeLabel: "REPLAY",
    description: "Restart from Day 1, use what you learned, and beat your best pace.",
    currentLevelNumber: current.levelNumber,
    totalLevels: levels.length
  });
}
