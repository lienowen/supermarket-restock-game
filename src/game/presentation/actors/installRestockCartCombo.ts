import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import {
  RestockActorView,
  type RestockActorViewConfig
} from "./RestockActorView";

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly cart: Phaser.GameObjects.Image;
  readonly cartFront: Phaser.GameObjects.Image;
  readonly cartShadow: Phaser.GameObjects.Ellipse;
  readonly caseBox: Phaser.GameObjects.Image;
}

const originalSync = RestockActorView.prototype.sync;

RestockActorView.prototype.sync = function syncWithBakedOpenCart(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);

  const view = this as unknown as RestockActorInternals;
  const isColaDelivery = view.config.caseAssetKey === "prop-cola-case-closed";
  const needsOpenCart = snapshot.step === "restock" || (
    snapshot.step === "open" && snapshot.boxOpened
  );
  if (!isColaDelivery || !needsOpenCart) return;

  const textureKey = prepareTrimmedTexture(
    view.scene,
    view.config.caseOpenAssetKey ?? "prop-cola-case-open",
    "cut-restock-cart-cola-open-combo-v3",
    10,
    true
  );
  const x = view.config.cartDestination.x - 265;
  const y = view.config.cartDestination.y + 26;

  view.cart
    .setTexture(textureKey)
    .setOrigin(0.5, 0.96)
    .setDisplaySize(330, 378)
    .setPosition(x, y)
    .setAlpha(1)
    .setVisible(true);
  view.cartFront.setVisible(false);
  view.caseBox.setVisible(false).setAlpha(1);
  view.cartShadow
    .setPosition(x, y + 5)
    .setSize(205, 38)
    .setVisible(true);

  document.body.dataset.restockActorComposition = "baked-cart-open-case";
  document.body.dataset.restockLoadVisual = "single-composite-texture";
};
