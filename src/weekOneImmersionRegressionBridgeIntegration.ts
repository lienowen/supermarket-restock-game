import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RoomId = "stock" | "main" | "promotion" | "cold";

type RuntimeGame = Phaser.Scene & {
  __weekOneSpaceController?: {
    activeRoom: RoomId;
    definitions: Array<{ id: RoomId }>;
    monitor?: () => void;
  };
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    __WEEK_ONE_IMMERSION_TEST__?: {
      showRoom: (room: RoomId) => boolean;
      state: () => string | null;
    };
  }
}

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithImmersionRegressionBridge(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (!isTestRoute() || !isWeekOneImmersionDay()) return;

  window.__WEEK_ONE_IMMERSION_TEST__ = {
    showRoom: (room: RoomId): boolean => {
      const controller = scene.__weekOneSpaceController;
      if (!controller?.definitions.some((definition) => definition.id === room)) return false;
      controller.activeRoom = room;
      controller.monitor?.();
      return true;
    },
    state: (): string | null => document.body.dataset.weekOneImmersion ?? null
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    delete window.__WEEK_ONE_IMMERSION_TEST__;
  });
};

function isWeekOneImmersionDay(): boolean {
  return gameSession.day === "day03" || gameSession.day === "day04" || gameSession.day === "day05";
}

function isTestRoute(): boolean {
  return new URLSearchParams(globalThis.location?.search ?? "").get("test") === "1";
}
