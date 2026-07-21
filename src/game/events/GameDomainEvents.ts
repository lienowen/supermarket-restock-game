import type { CampaignEconomy, CampaignSessionSnapshot } from "../application/CampaignSession";
import { DomainEventBus } from "./DomainEventBus";

export interface GameDomainEventMap {
  readonly "campaign.level-completed": {
    readonly campaignId: string;
    readonly levelId: string;
    readonly nextLevelId?: string;
    readonly economy: CampaignEconomy;
    readonly snapshot: CampaignSessionSnapshot;
  };
  readonly "campaign.reset": {
    readonly campaignId: string;
    readonly snapshot: CampaignSessionSnapshot;
  };
  readonly "task.action-accepted": {
    readonly levelId: string;
    readonly mode: string;
    readonly action: string;
  };
  readonly "task.progressed": {
    readonly levelId: string;
    readonly mode: string;
    readonly progress: number;
    readonly total: number;
  };
  readonly "task.completed": {
    readonly levelId: string;
    readonly mode: string;
    readonly economy: CampaignEconomy;
  };
}

export type GameDomainEventSink = Pick<
  DomainEventBus<GameDomainEventMap>,
  "emit"
>;

export const gameDomainEvents = new DomainEventBus<GameDomainEventMap>();
