import Phaser from "phaser";
import "./styles.css";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import "./gameSessionIntegration";
import "./layoutCalibration";
import "./interactions/immediateCartDrag";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1330,
  height: 1182,
  backgroundColor: "#151b1b",
  scale: {
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  render: {
    antialias: true,
    roundPixels: true
  },
  scene: [GameScene, PolishOverlayScene, ProgressionCustomerScene]
});