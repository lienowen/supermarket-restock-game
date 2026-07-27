import {
  COMMERCIAL_PRODUCT_ID,
  createDefaultCommercialProfile,
  migrateCommercialProfile,
  validateCommercialProfile,
  type CommercialProfileSnapshot
} from "../../application/CommercialProfile";

const STORAGE_KEY = `supermarket-restock:commercial-profile:${COMMERCIAL_PRODUCT_ID}`;

export class BrowserCommercialProfileStore {
  private memory?: string;
  private readonly storage?: Storage;

  constructor(storage?: Storage) {
    if (storage) {
      this.storage = storage;
      return;
    }
    try {
      this.storage = window.localStorage;
    } catch {
      this.storage = undefined;
    }
  }

  load(): CommercialProfileSnapshot {
    const raw = this.read();
    if (!raw) return createDefaultCommercialProfile();

    try {
      const profile = migrateCommercialProfile(JSON.parse(raw));
      if (!profile || validateCommercialProfile(profile).length > 0) {
        this.clear();
        return createDefaultCommercialProfile();
      }
      if (JSON.stringify(profile) !== raw) this.save(profile);
      return profile;
    } catch {
      this.clear();
      return createDefaultCommercialProfile();
    }
  }

  save(profile: CommercialProfileSnapshot): void {
    const errors = validateCommercialProfile(profile);
    if (errors.length > 0) {
      throw new Error(`Cannot persist invalid commercial profile:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    }
    const raw = JSON.stringify(profile);
    this.memory = raw;
    try {
      this.storage?.setItem(STORAGE_KEY, raw);
    } catch {
      // In-memory fallback preserves progress for the active browser session.
    }
  }

  clear(): void {
    this.memory = undefined;
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be unavailable in private or embedded browser contexts.
    }
  }

  private read(): string | null {
    try {
      const stored = this.storage?.getItem(STORAGE_KEY);
      if (stored !== undefined && stored !== null) return stored;
    } catch {
      // Fall through to the active-session memory value.
    }
    return this.memory ?? null;
  }
}
