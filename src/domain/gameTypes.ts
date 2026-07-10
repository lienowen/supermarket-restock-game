export type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";

export type CustomerState =
  | "ENTER"
  | "BROWSE"
  | "SEARCH"
  | "WAIT"
  | "ASK"
  | "BUY"
  | "QUEUE"
  | "LEAVE";

export type ZoneId =
  | "backroom"
  | "drinks"
  | "dairy"
  | "snacks"
  | "produce"
  | "frozen"
  | "checkout"
  | "service";

export type CustomerArchetype =
  | "normal"
  | "impatient"
  | "senior"
  | "family"
  | "picky"
  | "promotion"
  | "vip"
  | "bulk";

export type LevelId = "day01" | "day02" | "day03" | "day04" | "day05";

export type LevelFeatureFlags = {
  customerWaiting: boolean;
  customerQuestions: boolean;
  substitutions: boolean;
  rushHour: boolean;
  shelfCorrection: boolean;
  deliverySorting: boolean;
  expiryCheck: boolean;
  queueManagement: boolean;
  incidents: boolean;
};

export type LevelConfig = {
  id: LevelId;
  title: string;
  objective: string;
  zones: ZoneId[];
  shiftSeconds: number;
  salesTargets: {
    openToRush: number;
    rushToClosing: number;
  };
  customerIntervalsMs: {
    open: number;
    rush: number;
  };
  customerMix: Partial<Record<CustomerArchetype, number>>;
  features: LevelFeatureFlags;
};
