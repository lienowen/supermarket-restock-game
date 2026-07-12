import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";

type GamePrototype = {
  preload: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;

prototype.preload = function preloadMainStoreAssetsOnly(): void {
  const scene = this as unknown as Phaser.Scene;
  const keys = [
    Assets.backgrounds.backroom,
    Assets.backgrounds.salesfloor,
    Assets.props.cart,
    Assets.props.cartEmpty,
    Assets.props.cartLoading,
    Assets.props.cartReady,
    Assets.props.cartFull,
    Assets.props.shelf,
    Assets.props.boxCola,
    Assets.props.boxWater,
    Assets.props.boxMilk,
    Assets.products.cola,
    Assets.products.water,
    Assets.products.milk,
    Assets.characters.workerIdle,
    Assets.characters.workerCarry,
    Assets.characters.workerRestock,
    Assets.characters.workerPush,
    Assets.characters.customer01Idle,
    Assets.characters.customer01Basket,
    Assets.characters.customer02Idle,
    Assets.characters.customer02Basket,
    Assets.ui.workerAvatar,
    Assets.ui.coin,
    Assets.ui.star,
    Assets.ui.timer,
    Assets.ui.menu,
    Assets.ui.taskPanel,
    Assets.ui.taskButton,
    Assets.ui.hintBubble,
    Assets.ui.stepCard,
    Assets.ui.missingTag
  ] as const;

  keys.forEach((key) => {
    if (!scene.textures.exists(key)) scene.load.image(key, AssetPaths[key]);
  });
};
