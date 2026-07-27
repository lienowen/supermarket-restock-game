export const PROJECT_CONFIG = {
  version: "commercial-rebuild-v1",
  language: "en",
  logicalSize: {
    width: 1600,
    height: 900
  },
  visualTarget: "shelf-restock-puzzle",
  assetRoot: "assets/game"
} as const;

export type ProjectConfig = typeof PROJECT_CONFIG;
