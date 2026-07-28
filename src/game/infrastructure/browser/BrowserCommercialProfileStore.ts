import { crazyGamesPlatform, type PlatformKeyValueStorage } from "../../../platform/crazyGamesPlatform";
import {
  COMMERCIAL_PRODUCT_ID,
  createDefaultCommercialProfile,
  migrateCommercialProfile,
  validateCommercialProfile,
  type CommercialProfileSnapshot
} from "../../application/CommercialProfile";

const STORAGE_KEY = `supermarket-restock:commercial-profile:${COMMERCIAL_PRODUCT_ID}`;

export interface CommercialProfileStorageOptions {
  readonly primary?: PlatformKeyValueStorage;
  readonly legacy?: PlatformKeyValueStorage;
}

const browserLocalStorage = (): PlatformKeyValueStorage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export class BrowserCommercialProfileStore {
  private memory?: string;
  private readonly primary?: PlatformKeyValueStorage;
  private readonly legacy?: PlatformKeyValueStorage;
  private readonly cloudBacked: boolean;

  constructor(options: CommercialProfileStorageOptions = {}) {
    const platformStorage = options.primary ?? crazyGamesPlatform.dataStorage();
    const localStorage = options.legacy ?? browserLocalStorage();
    this.primary = platformStorage ?? localStorage;
    this.legacy = platformStorage && localStorage && platformStorage !== localStorage
      ? localStorage
      : undefined;
    this.cloudBacked = Boolean(platformStorage);
  }

  load(): CommercialProfileSnapshot {
    const primaryRaw = this.readFrom(this.primary);
    if (primaryRaw) {
      const profile = this.decode(primaryRaw);
      if (profile) {
        if (JSON.stringify(profile) !== primaryRaw) this.save(profile);
        this.publishStorageMode();
        return profile;
      }
      this.removeFrom(this.primary);
    }

    const legacyRaw = this.readFrom(this.legacy);
    if (legacyRaw) {
      const migrated = this.decode(legacyRaw);
      if (migrated) {
        const savedToPrimary = this.save(migrated);
        if (savedToPrimary && this.cloudBacked) this.removeFrom(this.legacy);
        document.body.dataset.commercialSaveMigration = savedToPrimary
          ? "local-to-account-complete"
          : "local-to-account-pending";
        return migrated;
      }
      this.removeFrom(this.legacy);
    }

    const memoryProfile = this.memory ? this.decode(this.memory) : undefined;
    this.publishStorageMode();
    return memoryProfile ?? createDefaultCommercialProfile();
  }

  save(profile: CommercialProfileSnapshot): boolean {
    const errors = validateCommercialProfile(profile);
    if (errors.length > 0) {
      throw new Error(`Cannot persist invalid commercial profile:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    }

    const raw = JSON.stringify(profile);
    this.memory = raw;
    const persisted = this.writeTo(this.primary, raw);
    this.publishStorageMode(persisted);
    return persisted;
  }

  clear(): void {
    this.memory = undefined;
    this.removeFrom(this.primary);
    this.removeFrom(this.legacy);
  }

  isCloudBacked(): boolean {
    return this.cloudBacked;
  }

  private decode(raw: string): CommercialProfileSnapshot | undefined {
    try {
      const profile = migrateCommercialProfile(JSON.parse(raw));
      if (!profile || validateCommercialProfile(profile).length > 0) return undefined;
      return profile;
    } catch {
      return undefined;
    }
  }

  private readFrom(storage?: PlatformKeyValueStorage): string | null {
    if (!storage) return null;
    try {
      return storage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private writeTo(storage: PlatformKeyValueStorage | undefined, raw: string): boolean {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, raw);
      return true;
    } catch {
      return false;
    }
  }

  private removeFrom(storage?: PlatformKeyValueStorage): void {
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private, embedded, or offline browser contexts.
    }
  }

  private publishStorageMode(persisted = true): void {
    document.body.dataset.commercialSave = this.cloudBacked
      ? persisted ? "account" : "memory-fallback"
      : this.primary ? persisted ? "local" : "memory-fallback" : "memory-only";
  }
}
