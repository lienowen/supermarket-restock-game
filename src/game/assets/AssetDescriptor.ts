export type AssetCategory =
  | "environment"
  | "fixture"
  | "character"
  | "equipment"
  | "product"
  | "prop"
  | "effect"
  | "ui";

export type AssetStatus = "concept" | "prototype" | "production" | "deprecated";

export type DepthGroup =
  | "far-environment"
  | "architecture"
  | "fixtures"
  | "fixture-contents"
  | "props"
  | "actors"
  | "world-effects"
  | "ui";

export interface AssetDescriptor {
  readonly key: string;
  readonly path: string;
  readonly category: AssetCategory;
  readonly canvasSize: readonly [width: number, height: number];
  readonly anchor: readonly [x: number, y: number];
  readonly defaultScale: number;
  readonly depthGroup: DepthGroup;
  readonly preloadGroup: string;
  readonly perspective: "fixed-third-person" | "screen-space";
  readonly lightDirection?: "upper-left" | "upper-right" | "neutral";
  readonly state?: string;
  readonly status: AssetStatus;
  readonly replacementKey?: string;
}

export interface AssetCatalogue {
  readonly assets: readonly AssetDescriptor[];
}

export function validateAssetCatalogue(catalogue: AssetCatalogue): readonly string[] {
  const errors: string[] = [];
  const keys = new Set<string>();

  for (const asset of catalogue.assets) {
    if (keys.has(asset.key)) {
      errors.push(`Duplicate asset key: ${asset.key}`);
    }
    keys.add(asset.key);

    if (!asset.path.startsWith("assets/game/")) {
      errors.push(`Asset path must start with assets/game/: ${asset.key}`);
    }

    if (asset.canvasSize[0] <= 0 || asset.canvasSize[1] <= 0) {
      errors.push(`Asset canvas size must be positive: ${asset.key}`);
    }

    if (asset.anchor.some((value) => value < 0 || value > 1)) {
      errors.push(`Asset anchor must be normalized: ${asset.key}`);
    }

    if (asset.defaultScale <= 0) {
      errors.push(`Asset scale must be positive: ${asset.key}`);
    }
  }

  return errors;
}
