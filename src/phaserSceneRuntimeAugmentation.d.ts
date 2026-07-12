import "phaser";

declare module "phaser" {
  interface Scene {
    openStore: () => void;
  }
}
