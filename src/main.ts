import Phaser from "phaser";
import "./styles.css";
import { GameScene } from "./scenes/GameScene";
import "./interactions/boxDragPatch";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1330,
  height: 1182,
  backgroundColor: "#151b1b",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [GameScene]
});
