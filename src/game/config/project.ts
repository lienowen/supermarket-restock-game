export const PROJECT_CONFIG = {
  version: "commercial-rebuild-v1",
  language: "en",
  logicalSize: {
    width: 750,
    height: 1334
  },
  visualTarget: "shelf-restock-puzzle",
  assetRoot: "assets/game"
} as const;

export type ProjectConfig = typeof PROJECT_CONFIG;
