import type { LevelId, ShiftPhase } from "../domain/gameTypes";
import { LEVELS } from "../levels/levelConfigs";
import { calculatePerformanceStars } from "./PerformanceRating";
import { ShiftManager, type ShiftTransition } from "./ShiftManager";

const COINS_STORAGE_KEY = "supermarket.walletCoins";

type CoinStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type GameSessionSnapshot = {
  activeDay: LevelId;
  phase: ShiftPhase;
  paused: boolean;
  soldCount: number;
  money: number;
  stocked: number;
  shiftEnded: boolean;
  stars: number;
  missedSales: number;
  wrongStock: number;
  bestCombo: number;
  satisfiedCustomers: number;
};

class GameSession {
  private activeDay: LevelId = "day01";
  private paused = false;
  private money = readPersistedCoins();
  private stocked = 0;
  private shiftEnded = false;
  private missedSales = 0;
  private wrongStock = 0;
  private bestCombo = 0;
  private satisfiedCustomers = 0;
  private shiftManager = new ShiftManager(LEVELS.day01);

  get snapshot(): GameSessionSnapshot {
    return {
      activeDay: this.activeDay,
      phase: this.shiftManager.currentPhase,
      paused: this.paused,
      soldCount: this.shiftManager.sales,
      money: this.money,
      stocked: this.stocked,
      shiftEnded: this.shiftEnded,
      stars: this.performanceStars,
      missedSales: this.missedSales,
      wrongStock: this.wrongStock,
      bestCombo: this.bestCombo,
      satisfiedCustomers: this.satisfiedCustomers
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

  get coins(): number {
    return this.money;
  }

  get performanceStars(): number {
    const level = LEVELS[this.activeDay];
    return calculatePerformanceStars({
      phase: this.phase,
      soldCount: this.sales,
      openSalesTarget: level.salesTargets.openToRush,
      closingSalesTarget: level.salesTargets.rushToClosing,
      missedSales: this.missedSales,
      wrongStock: this.wrongStock,
      bestCombo: this.bestCombo
    });
  }

  setActiveDay(day: LevelId): void {
    if (day === this.activeDay) return;
    this.reset(day);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setCoins(coins: number): void {
    this.money = Math.max(0, Math.floor(coins));
    persistCoins(this.money);
  }

  earnCoins(amount: number): number {
    const earned = Math.max(0, Math.floor(amount));
    if (earned === 0) return this.money;
    this.setCoins(this.money + earned);
    return this.money;
  }

  recordWrongStock(): void {
    this.wrongStock += 1;
  }

  recordMissedSale(): void {
    this.missedSales += 1;
  }

  recordSatisfiedCustomer(): void {
    this.satisfiedCustomers += 1;
  }

  recordCombo(combo: number): void {
    this.bestCombo = Math.max(this.bestCombo, Math.max(0, Math.floor(combo)));
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
   * in progress. Wallet coins are intentionally NOT overwritten from a Scene;
   * GameScene reads/writes them through the canonical money accessor.
   */
  syncPresentation(state: {
    money: number;
    stocked: number;
    shiftEnded: boolean;
  }): void {
    this.stocked = Math.max(0, Math.floor(state.stocked));
    this.shiftEnded = state.shiftEnded;
  }

  /**
   * Backward-compatible bridge for older callers. phase/soldCount/money are ignored
   * on purpose so another Scene cannot overwrite canonical shift or wallet state.
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
    this.stocked = 0;
    this.shiftEnded = false;
    this.paused = false;
    this.missedSales = 0;
    this.wrongStock = 0;
    this.bestCombo = 0;
    this.satisfiedCustomers = 0;
  }
}

function getStorage(): CoinStorage | undefined {
  try {
    return (globalThis as unknown as { localStorage?: CoinStorage }).localStorage;
  } catch {
    return undefined;
  }
}

function readPersistedCoins(): number {
  try {
    const raw = getStorage()?.getItem(COINS_STORAGE_KEY);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
}

function persistCoins(coins: number): void {
  try {
    getStorage()?.setItem(COINS_STORAGE_KEY, String(coins));
  } catch {
    // Persistence is optional; the current session still keeps the wallet value.
  }
}

export const gameSession = new GameSession();