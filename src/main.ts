import Phaser from "phaser";
import "./styles.css";
import { OpeningScene } from "./scenes/OpeningScene";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { BackStockScene } from "./scenes/BackStockScene";
import "./gameSessionIntegration";
import "./performanceEconomyIntegration";
import "./customerDemandIntegration";
import "./shiftResultIntegration";
import "./layoutCalibration";
import "./interactions/immediateCartDrag";
import "./guidancePolicy";

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
  scene: [OpeningScene, GameScene, PolishOverlayScene, ProgressionCustomerScene, BackStockScene]
});
