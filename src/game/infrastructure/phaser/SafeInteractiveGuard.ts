import Phaser from "phaser";

type GuardedGameObjectPrototype = Phaser.GameObjects.GameObject & {
  __safeInteractiveGuardInstalled?: boolean;
};

/**
 * Some legacy presentation code calls setInteractive(false). Phaser interprets
 * that value as a hit-area argument. The project-level guard turns it into a
 * harmless no-op while compatibility files are retired.
 */
export function installSafeInteractiveGuard(): void {
  const prototype = Phaser.GameObjects.GameObject.prototype as GuardedGameObjectPrototype;
  if (prototype.__safeInteractiveGuardInstalled) return;

  const originalSetInteractive = prototype.setInteractive;
  prototype.setInteractive = function safeSetInteractive(
    hitArea?: Phaser.Types.Input.InputConfiguration | Phaser.Geom.Rectangle | Phaser.Geom.Circle | Phaser.Geom.Ellipse | Phaser.Geom.Polygon | false,
    hitAreaCallback?: Phaser.Types.Input.HitAreaCallback,
    dropZone?: boolean
  ): Phaser.GameObjects.GameObject {
    if (hitArea === false) return this;
    return originalSetInteractive.call(this, hitArea, hitAreaCallback, dropZone);
  };
  prototype.__safeInteractiveGuardInstalled = true;
}
