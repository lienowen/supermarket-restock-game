import Phaser from "phaser";
import "./styles.css";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { BackStockScene } from "./scenes/BackStockScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { installResponsiveShell } from "./responsiveShell";
import { crazyGamesPlatform } from "./platform/crazyGamesPlatform";
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
import "./dayTwoHookIntegration";
import "./dayTwoChallengeRewardIntegration";
import "./promotionWingProductionIntegration";
import "./promotionWingRealisticVisualIntegration";
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
import "./optimizedSceneAssetLoadingIntegration";
import "./storefrontMenuIntegration";
import "./deliveryInventoryIntegration";
import "./storeOpeningActionIntegration";
import "./operatingHoursTimerIntegration";
import "./settingsRuntimeIntegration";
import "./mobileLandscapeShellIntegration";
import "./currentDutyHighlightIntegration";
import "./contractDefaultMigrationIntegration";
import "./shiftContractIntegration";
import "./replayShiftTwistIntegration";
import "./storefrontProgressionPolishIntegration";
import "./marketPauseIntegration";
import "./gameFeelFeedbackIntegration";
import "./firstThreeDayCampaignIntegration";
import "./openingDeliveryGateIntegration";
import "./campaignBriefingCopyFixIntegration";
import "./campaignCustomerFlowGateIntegration";
import "./dayThreeSupervisorContractIntegration";
import "./mobileDayThreeStartIntegration";
import "./uiRuntimePolishIntegration";
import "./uiRuntimeLegacyCleanupIntegration";
import "./releaseVisualFlowFixIntegration";
import "./releaseRegressionSignalsIntegration";
import "./phaserTextSafetyIntegration";
import "./milkTextureTransparencyIntegration";
import "./platform/crazyGamesLifecycleIntegration";
import "./dayThreeMultiFixtureIntegration";
import "./weekOneReleaseIntegration";
import "./dayFourFiveBatchRestockIntegration";
import "./weekOneRuntimeDayGuardIntegration";
import "./weekOnePendingDayIntegration";
import "./weekOneSelectionPersistenceIntegration";
import "./dayFourFiveLegacyCleanupIntegration";
import "./boxTextureTransparencyIntegration";
import "./dayFourFiveLayoutPolishIntegration";
import "./storefrontPayloadOptimizationIntegration";
import "./dayThreeDeadlockRecoveryIntegration";
import "./dayThreeSceneIsolationIntegration";
import "./uiSimplificationIntegration";
import "./weekOneSpaceExpansionIntegration";
import "./spaceExpansionBannerCoordinationIntegration";
import "./finalUiLayoutIntegration";
import "./sharedSupermarketRoomIntegration";
import "./supermarketProductionVisualIntegration";
import "./dayTwoImmersiveStoreIntegration";
import "./dayTwoStableRenderIntegration";
import "./dayTwoBackgroundShelfIntegration";

void bootstrap();

async function bootstrap(): Promise<void> {
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();
  installResponsiveShell();

  const game = new Phaser.Game({
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
      PromotionWingScene
    ]
  });

  crazyGamesPlatform.bindGame(game);
}
