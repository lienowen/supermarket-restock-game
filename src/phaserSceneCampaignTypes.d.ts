import "phaser";

declare global {
  namespace Phaser {
    interface Scene {
      openStore(): void;
    }
  }
}

export {};
