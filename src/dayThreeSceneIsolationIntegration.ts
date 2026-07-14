import Phaser from "phaser";
import { BackStockScene } from "./scenes/BackStockScene";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeBackStockScene = BackStockScene & {
  attached: boolean;
  panel?: Phaser.GameObjects.Container;
  detach: () => void;
};

type BackStockPrototype = {
  update: (...args: unknown[]) => void;
};

type OverlaySnapshot = {
  key: string;
  scene: Phaser.Scene;
  visible: boolean;
  inputEnabled: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  __campaignIncidentPanel?: Phaser.GameObjects.Container;
  __day3SceneIsolationSnapshots?: OverlaySnapshot[];
  __day3SceneIsolationMonitor?: () => void;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

const DAY_TWO_ONLY_SCENES = new Set([
  "back-stock",
  "promotion-wing",
  "day-two-room-navigation"
]);

const INCIDENT_OVERLAY_SCENES = [
  "progression-customer",
  "back-stock",
  "promotion-wing",
  "day-two-room-navigation"
] as const;

installBackStockDayGuard();
installDayThreeIncidentIsolation();

function installBackStockDayGuard(): void {
  const prototype = BackStockScene.prototype as unknown as BackStockPrototype;
  const originalUpdate = prototype.update;

  prototype.update = function updateWithDayGuard(...args: unknown[]): void {
    const scene = this as unknown as RuntimeBackStockScene;

    if (gameSession.day !== "day02") {
      if (scene.attached) scene.detach();
      scene.panel?.setVisible(false);
      scene.input.enabled = false;
      return;
    }

    scene.input.enabled = true;
    originalUpdate.apply(this, args);
  };
}

function installDayThreeIncidentIsolation(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithIncidentIsolation(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGameScene;
    let incidentWasActive = false;
    let lastEnforcement = -Infinity;

    const monitor = (): void => {
      const incidentActive = Boolean(scene.__campaignIncidentPanel?.active);

      if (incidentActive && !incidentWasActive) {
        isolateIncidentOverlays(scene);
      } else if (!incidentActive && incidentWasActive) {
        restoreIncidentOverlays(scene);
      }

      if (incidentActive && scene.time.now - lastEnforcement >= 120) {
        lastEnforcement = scene.time.now;
        enforceIncidentLayer(scene);
      }

      incidentWasActive = incidentActive;
    };

    scene.__day3SceneIsolationMonitor = monitor;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
      restoreIncidentOverlays(scene);
      scene.__day3SceneIsolationMonitor = undefined;
      delete document.body.dataset.day3SceneIsolation;
    });
  };
}

function isolateIncidentOverlays(scene: RuntimeGameScene): void {
  if (scene.__day3SceneIsolationSnapshots?.length) return;

  const snapshots: OverlaySnapshot[] = [];
  for (const key of INCIDENT_OVERLAY_SCENES) {
    const overlay = scene.scene.get(key);
    if (!overlay?.scene?.isActive()) continue;

    snapshots.push({
      key,
      scene: overlay,
      visible: overlay.sys.settings.visible,
      inputEnabled: overlay.input.enabled
    });

    overlay.scene.setVisible(false);
    overlay.input.enabled = false;
  }

  scene.__day3SceneIsolationSnapshots = snapshots;
  enforceIncidentLayer(scene);
  document.body.dataset.day3SceneIsolation = "active";
}

function enforceIncidentLayer(scene: RuntimeGameScene): void {
  for (const key of INCIDENT_OVERLAY_SCENES) {
    const overlay = scene.scene.get(key);
    if (!overlay?.scene?.isActive()) continue;
    overlay.scene.setVisible(false);
    overlay.input.enabled = false;
  }

  scene.scene.bringToTop();
}

function restoreIncidentOverlays(scene: RuntimeGameScene): void {
  const snapshots = scene.__day3SceneIsolationSnapshots;
  if (!snapshots?.length) return;

  for (const snapshot of snapshots) {
    if (!snapshot.scene.scene.isActive()) continue;

    const allowedForCurrentDay = !DAY_TWO_ONLY_SCENES.has(snapshot.key) || gameSession.day === "day02";
    snapshot.scene.scene.setVisible(allowedForCurrentDay && snapshot.visible);
    snapshot.scene.input.enabled = allowedForCurrentDay && snapshot.inputEnabled;
  }

  scene.__day3SceneIsolationSnapshots = undefined;
  document.body.dataset.day3SceneIsolation = "restored";
}
