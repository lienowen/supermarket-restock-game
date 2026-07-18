import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { ProductionAssets } from "./supermarketProductionAssets";
import { gameSession } from "./systems/GameSession";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeBox = {
  image: Phaser.GameObjects.Image;
  loaded: boolean;
};

type RuntimeSlot = {
  product?: Phaser.GameObjects.Image;
};

type RuntimeGame = Phaser.Scene & {
  boxes?: RuntimeBox[];
  shelfSlots?: RuntimeSlot[];
  __dayOneFinalStabilityInstalled?: boolean;
};

type FixtureState = "empty" | "low" | "full";

type CharacterCandidate = {
  image: Phaser.GameObjects.Image;
  family: string;
  originalAlpha: number;
};

const RACK_TEXTURES: Record<FixtureState, string> = {
  empty: ProductionAssets.fixtures.rackBackroomEmpty,
  low: ProductionAssets.fixtures.rackBackroomLow,
  full: ProductionAssets.fixtures.rackBackroomFull
};

const COLD_TEXTURES: Record<FixtureState, string> = {
  empty: ProductionAssets.fixtures.frozenEmpty,
  low: ProductionAssets.fixtures.frozenLow,
  full: ProductionAssets.fixtures.frozenFull
};

const CHARACTER_TEXTURES = new Set<string>([
  Assets.characters.workerIdle,
  Assets.characters.workerCarry,
  Assets.characters.workerRestock,
  Assets.characters.workerPush,
  Assets.characters.customer01Idle,
  Assets.characters.customer01Basket,
  Assets.characters.customer02Idle,
  Assets.characters.customer02Basket,
  Assets.promotion.cashierIdle,
  Assets.promotion.customerWaiting,
  Assets.promotion.customerService
]);

installDayOneFinalStability();

function installDayOneFinalStability(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithFinalDayOneStability(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    scene.time.delayedCall(720, () => installRuntimeStability(scene));
  };
}

function installRuntimeStability(scene: RuntimeGame): void {
  if (gameSession.day !== "day01" || !scene.scene.isActive()) return;
  if (scene.__dayOneFinalStabilityInstalled) return;
  scene.__dayOneFinalStabilityInstalled = true;

  let lastRunAt = -1000;
  const stabilize = (): void => {
    if (!scene.scene.isActive() || gameSession.day !== "day01") return;
    if (scene.time.now - lastRunAt < 120) return;
    lastRunAt = scene.time.now;

    for (const activeScene of scene.game.scene.getScenes(true)) {
      stabilizeCharacters(activeScene);
      stopRemainingFlashes(activeScene);
    }
    syncNamedFixtures(scene);
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, stabilize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, stabilize);
    scene.__dayOneFinalStabilityInstalled = false;
  });

  stabilize();
  document.body.dataset.dayOneFinalStability = "ready";
}

function stabilizeCharacters(scene: Phaser.Scene): void {
  const candidates: CharacterCandidate[] = [];

  visitSceneObjects(scene, (object) => {
    if (object.name === "immersion-actor-shadow") {
      scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Shape) object.setAlpha(0.16).setVisible(true);
      return;
    }

    if (!(object instanceof Phaser.GameObjects.Image)) return;
    const texture = object.texture.key;
    if (!CHARACTER_TEXTURES.has(texture) && !looksLikeCharacterTexture(texture)) return;

    const originalAlpha = object.alpha;
    scene.tweens.killTweensOf(object);
    object.setAlpha(1).setBlendMode(Phaser.BlendModes.NORMAL).clearTint();
    candidates.push({ image: object, family: characterFamily(texture), originalAlpha });
  });

  const families = new Map<string, CharacterCandidate[]>();
  for (const candidate of candidates) {
    const group = families.get(candidate.family) ?? [];
    group.push(candidate);
    families.set(candidate.family, group);
  }

  for (const group of families.values()) {
    group.sort((a, b) => characterScore(b) - characterScore(a));
    const kept: CharacterCandidate[] = [];

    for (const candidate of group) {
      const duplicate = kept.find((other) =>
        Phaser.Math.Distance.Between(
          candidate.image.x,
          candidate.image.y,
          other.image.x,
          other.image.y
        ) < 105
      );

      if (duplicate && shouldHideDuplicate(candidate, duplicate)) {
        candidate.image.setVisible(false).disableInteractive();
        continue;
      }
      candidate.image.setVisible(true);
      kept.push(candidate);
    }
  }
}

function stopRemainingFlashes(scene: Phaser.Scene): void {
  visitSceneObjects(scene, (object) => {
    const name = object.name ?? "";

    if (name.startsWith("immersion-ceiling-light-")) {
      scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Shape) object.setVisible(false);
      return;
    }

    if (name === "day1-opening-intro") {
      scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Container) object.setVisible(false);
      return;
    }

    if (
      name === "day1-target-glow" ||
      name === "day1-target-arrow" ||
      name === "day1-target-frame" ||
      name === "day1-restock-route"
    ) {
      scene.tweens.killTweensOf(object);
      if (object instanceof Phaser.GameObjects.Rectangle) object.setAlpha(0.16).setScale(1);
      if (object instanceof Phaser.GameObjects.Text) object.setAlpha(1).setScale(1);
      if (object instanceof Phaser.GameObjects.Graphics) object.setAlpha(1).setScale(1);
    }

    if (object instanceof Phaser.GameObjects.Text && object.text.includes("RUSH")) {
      scene.tweens.killTweensOf(object);
      object.setAlpha(1).setScale(1);
    }
  });
}

function syncNamedFixtures(scene: RuntimeGame): void {
  const rack = findFixture(scene, Object.values(RACK_TEXTURES), 250);
  const coldCase = findFixture(scene, Object.values(COLD_TEXTURES), 1080);

  if (rack) {
    rack.setName("day1-stock-rack");
    const remaining = (scene.boxes ?? []).filter((box) => box.image.active && !box.loaded).length;
    const state: FixtureState = remaining >= 5 ? "full" : remaining >= 2 ? "low" : "empty";
    setFixtureState(rack, RACK_TEXTURES[state], 250, 1010, 360, 550);
  }

  if (coldCase) {
    coldCase.setName("day1-cold-case");
    const slots = scene.shelfSlots ?? [];
    const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
    const state: FixtureState = filled === 0 ? "empty" : filled === slots.length ? "full" : "low";
    setFixtureState(coldCase, COLD_TEXTURES[state], 1080, 1010, 430, 585);
  }
}

function setFixtureState(
  image: Phaser.GameObjects.Image,
  texture: string,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  if (image.scene.textures.exists(texture) && image.texture.key !== texture) image.setTexture(texture);
  image.setPosition(x, y).setOrigin(0.5, 1).setDisplaySize(width, height).setDepth(3.4).setVisible(true);
}

function findFixture(
  scene: Phaser.Scene,
  textures: string[],
  expectedX: number
): Phaser.GameObjects.Image | undefined {
  const candidates: Phaser.GameObjects.Image[] = [];
  visitSceneObjects(scene, (object) => {
    if (object instanceof Phaser.GameObjects.Image && textures.includes(object.texture.key)) {
      candidates.push(object);
    }
  });
  candidates.sort((a, b) => Math.abs(a.x - expectedX) - Math.abs(b.x - expectedX));
  return candidates[0];
}

function looksLikeCharacterTexture(texture: string): boolean {
  const key = texture.toLowerCase();
  return key.includes("worker") || key.includes("customer") || key.includes("cashier");
}

function characterFamily(texture: string): string {
  const key = texture.toLowerCase();
  if (key.includes("worker")) return "worker";
  if (key.includes("customer-01") || key.includes("customer_01")) return "customer-01";
  if (key.includes("customer-02") || key.includes("customer_02")) return "customer-02";
  if (key.includes("cashier")) return "cashier";
  return key.replace(/-(idle|basket|carry|restock|push-cart|waiting|service)$/u, "");
}

function characterScore(candidate: CharacterCandidate): number {
  const visible = candidate.image.visible ? 1000 : 0;
  const opaque = candidate.originalAlpha >= 0.98 ? 500 : 0;
  return visible + opaque + candidate.image.depth;
}

function shouldHideDuplicate(candidate: CharacterCandidate, kept: CharacterCandidate): boolean {
  return (
    candidate.originalAlpha < 0.98 ||
    candidate.image.name.startsWith("immersion-") ||
    candidate.family === "worker" ||
    kept.image.name === candidate.image.name
  );
}

function visitSceneObjects(
  scene: Phaser.Scene,
  visitor: (object: Phaser.GameObjects.GameObject) => void
): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (!object.active) return;
    visitor(object);
    if (!object.active || !(object instanceof Phaser.GameObjects.Container)) return;
    for (const child of [...object.list]) visit(child);
  };

  for (const child of [...scene.children.list]) visit(child);
}
