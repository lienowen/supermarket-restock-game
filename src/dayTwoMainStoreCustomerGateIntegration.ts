import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = GameScene & {
  __day2PromotionComplete?: boolean;
};

type GamePrototype = {
  customerPurchase: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCustomerPurchase = prototype.customerPurchase;

prototype.customerPurchase = function keepDayTwoSalesInPromotionRoom(): void {
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day === "day02" && !scene.__day2PromotionComplete) return;
  originalCustomerPurchase.call(this);
};
