import type Phaser from "phaser";

export interface GameRuntime {
  start(): Promise<Phaser.Game>;
}
