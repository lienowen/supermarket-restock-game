import Phaser from "phaser";
import "./styles.css";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { BackStockScene } from "./scenes/BackStockScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { DayTwoRoomNavigationScene } from "./scenes/DayTwoRoomNavigationScene";
import { installResponsiveShell } from "./responsiveShell";
import "./gameSessionIntegration";
import "./performanceEconomyIntegration";
import "./customerDemandIntegration";
import "./shiftResultIntegration";
import "./storefrontDay3Integration";
import "./day3BackStockIntegration";
import "./layoutCalibration";
import "./boxGroundingIntegration";
import "./interactions/immediateCartDrag";
import "./guidancePolicy";
import "./cartVisualIntegration";
import "./cartWorkerSyncIntegration";
import "./customerLaneIntegration";
import "./restockFeedbackIntegration";
import "./dayOneHookIntegration";
import "./dayOneTutorialIntegration";
import "./dayTwoHookIntegration";
import "./dayTwoChallengeRewardIntegration";
import "./dayTwoOpeningExpansionIntegration";
import "./promotionWingProductFixIntegration";
import "./promotionWingProductionIntegration";
import "./promotionWingRestockFixIntegration";
import "./promotionWingMainlineIntegration";
import "./levelPacingIntegration";
import "./serviceEventPacingIntegration";
import "./closingFlowIntegration";
import "./closingGuideFixIntegration";
import "./closingCompletionFixIntegration";
import "./phaseAtmosphereIntegration";
import "./uiPolishIntegration";
import "./mobileTouchIntegration";
import "./shiftMainlineIntegration";
import "./dayTwoMainStoreCustomerGateIntegration";
import "./openingOperationsIntegration";
import "./storefrontMenuIntegration";
import "./deliveryInventoryIntegration";
import "./storeOpeningActionIntegration";

installResponsiveShell();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "app",
  width: 1330,
  height: 1182,
  backgroundColor: "#151b1b",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true
  },
  render: {
    antialias: true,
    roundPixels: true
  },
  scene: [
    StorefrontScene,
    OpeningScene,
    GameScene,
    PolishOverlayScene,
    ProgressionCustomerScene,
    BackStockScene,
    PromotionWingScene,
    DayTwoRoomNavigationScene
  ]
});