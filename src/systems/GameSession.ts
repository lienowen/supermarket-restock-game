import type { LevelId, ShiftPhase } from "../domain/gameTypes";
import { LEVELS } from "../levels/levelConfigs";
import { ShiftManager, type ShiftTransition } from "./ShiftManager";

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
    this.reset(day);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  openStore(): ShiftTransition | undefined {
    return this.shiftManager.openStore();
  }

  recordSale(): ShiftTransition | undefined {
    return this.shiftManager.recordSale();
  }

  finishShift(): ShiftTransition | undefined {
    this.shiftEnded = true;
    return this.shiftManager.finishShift();
  }

  setShiftEnded(ended: boolean): void {
    this.shiftEnded = ended;
  }

  /**
   * Recovery-only setter used when restoring a saved/restarted runtime. Normal
   * gameplay must use openStore(), recordSale() and finishShift() so transitions
   * stay under ShiftManager control.
   */
  restoreShiftState(phase: ShiftPhase, soldCount: number): void {
    this.shiftManager.hydrate(phase, soldCount);
  }

  /**
   * Presentation metrics may still live in GameScene while the visual refactor is
   * in progress. Crucially, phase and soldCount are intentionally NOT accepted
   * here: they are canonical ShiftManager state now.
   */
  syncPresentation(state: {
    money: number;
    stocked: number;
    shiftEnded: boolean;
  }): void {
    this.money = Math.max(0, Math.floor(state.money));
    this.stocked = Math.max(0, Math.floor(state.stocked));
    this.shiftEnded = state.shiftEnded;
  }

  /**
   * Backward-compatible bridge for older callers. phase/soldCount are ignored on
   * purpose so another Scene cannot overwrite canonical shift state.
   */
  syncRuntime(state: {
    phase: ShiftPhase;
    soldCount: number;
    money: number;
    stocked: number;
    shiftEnded: boolean;
  }): void {
    this.syncPresentation(state);
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
