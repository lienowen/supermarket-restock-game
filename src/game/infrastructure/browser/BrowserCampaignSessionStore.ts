import {
  validateCampaignSessionSnapshot,
  type CampaignSessionSnapshot,
  type CampaignSessionStore
} from "../../application/CampaignSession";

const STORAGE_PREFIX = "supermarket-restock:campaign:";

export class BrowserCampaignSessionStore implements CampaignSessionStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  load(campaignId: string): CampaignSessionSnapshot | undefined {
    const raw = this.storage.getItem(this.key(campaignId));
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
    this.storage.setItem(this.key(snapshot.campaignId), JSON.stringify(snapshot));
  }

  clear(campaignId: string): void {
    this.storage.removeItem(this.key(campaignId));
  }

  private key(campaignId: string): string {
    return `${STORAGE_PREFIX}${campaignId}`;
  }
}
