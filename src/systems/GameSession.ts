import type { LevelId, ShiftPhase } from "../domain/gameTypes";
import { LEVELS } from "../levels/levelConfigs";
import { ShiftManager } from "./ShiftManager";

export type GameSessionSnapshot = {
  activeDay: LevelId;
  phase: ShiftPhase;
  paused: boolean;
  soldCount: number;
  money: number;
  stocked: number;
  shiftEnded: boolean;
};

class GameSession {
  private activeDay: LevelId = "day01";
  private paused = false;
  private money = 0;
  private stocked = 0;
  private shiftEnded = false;
  private shiftManager = new ShiftManager(LEVELS.day01);

  get snapshot(): GameSessionSnapshot {
    return {
      activeDay: this.activeDay,
      phase: this.shiftManager.currentPhase,
      paused: this.paused,
      soldCount: this.shiftManager.sales,
      money: this.money,
      stocked: this.stocked,
      shiftEnded: this.shiftEnded
    };
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get day(): LevelId {
    return this.activeDay;
  }

  get phase(): ShiftPhase {
    return this.shiftManager.currentPhase;
  }

  get sales(): number {
    return this.shiftManager.sales;
  }

  setActiveDay(day: LevelId): void {
    if (day === this.activeDay) return;
    this.activeDay = day;
    this.shiftManager = new ShiftManager(LEVELS[day]);
    this.money = 0;
    this.stocked = 0;
    this.shiftEnded = false;
    this.paused = false;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  syncRuntime(state: {
    phase: ShiftPhase;
    soldCount: number;
    money: number;
    stocked: number;
    shiftEnded: boolean;
  }): void {
    this.shiftManager.hydrate(state.phase, state.soldCount);
    this.money = Math.max(0, Math.floor(state.money));
    this.stocked = Math.max(0, Math.floor(state.stocked));
    this.shiftEnded = state.shiftEnded;
  }

  recordSale(): void {
    this.shiftManager.recordSale();
  }

  reset(day: LevelId = this.activeDay): void {
    this.activeDay = day;
    this.shiftManager = new ShiftManager(LEVELS[day]);
    this.money = 0;
    this.stocked = 0;
    this.shiftEnded = false;
    this.paused = false;
  }
}

export const gameSession = new GameSession();
