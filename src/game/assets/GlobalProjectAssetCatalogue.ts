import type { AssetCatalogue } from "./AssetDescriptor";

/**
 * Project-wide production assets belong here only after their files are present
 * in the repository and pass the release bundle checks. Asset ideas and gap
 * plans must stay in design documentation instead of being registered as live
 * runtime resources.
 */
export const GLOBAL_PROJECT_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([])
});
