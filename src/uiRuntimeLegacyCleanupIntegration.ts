import Phaser from "phaser";
import { StorefrontScene } from "./scenes/StorefrontScene";


type StorefrontPrototype = {
  createLobbyView: () => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalLobby = prototype.createLobbyView;

prototype.createLobbyView = function createLobbyWithoutLegacyLeak(): void {
  originalLobby.call(this);
  const scene = this as unknown as Phaser.Scene;

  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    if (child.depth >= 50 || child.y < 860 || child.y > 950) return;

    const text = child.text.toUpperCase();
    if (
      text.includes("COMPLETE DAY 1") ||
      text.includes("COMPLETE DAY 2") ||
      text.includes("SUPERVISOR CONTRACTS")
    ) {
      child.setVisible(false);
    }
  });
};
