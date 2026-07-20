import {
  validateCampaignSessionSnapshot,
  type CampaignSessionSnapshot,
  type CampaignSessionStore
} from "../../application/CampaignSession";

const STORAGE_PREFIX = "supermarket-restock:campaign:";

export class BrowserCampaignSessionStore implements CampaignSessionStore {
  private readonly memory = new Map<string, string>();
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

  load(campaignId: string): CampaignSessionSnapshot | undefined {
    const key = this.key(campaignId);
    const raw = this.read(key);
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw) as CampaignSessionSnapshot;
      if (validateCampaignSessionSnapshot(parsed, campaignId).length > 0) {
        this.clear(campaignId);
        return undefined;
      }
      return Object.freeze({
        ...parsed,
        completedLevelIds: Object.freeze([...parsed.completedLevelIds])
      });
    } catch {
      this.clear(campaignId);
      return undefined;
    }
  }

  save(snapshot: CampaignSessionSnapshot): void {
    this.write(this.key(snapshot.campaignId), JSON.stringify(snapshot));
  }

  clear(campaignId: string): void {
    const key = this.key(campaignId);
    this.memory.delete(key);
    try {
      this.storage?.removeItem(key);
    } catch {
      // Memory fallback remains active when persistent browser storage is blocked.
    }
  }

  private read(key: string): string | null {
    try {
      const persistent = this.storage?.getItem(key);
      if (persistent !== undefined && persistent !== null) return persistent;
    } catch {
      // Fall through to in-memory state.
    }
    return this.memory.get(key) ?? null;
  }

  private write(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Memory fallback keeps the active browser session playable.
    }
  }

  private key(campaignId: string): string {
    return `${STORAGE_PREFIX}${campaignId}`;
  }
}
