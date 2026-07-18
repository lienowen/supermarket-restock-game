export const PROJECT_CONFIG = {
  version: "architecture-v3",
  language: "en",
  logicalSize: {
    width: 1600,
    height: 900
  },
  visualTarget: "fixed-third-person-supermarket",
  assetRoot: "assets/game"
} as const;

export type ProjectConfig = typeof PROJECT_CONFIG;
