import Phaser from "phaser";

export const PromotionWingAssets = {
  background: {
    room: "/assets/day02/promotion/background/promotion_room_bg.png"
  },
  fixtures: {
    shelfLeft: "/assets/day02/promotion/fixtures/promo_shelf_left.png",
    shelfCenter: "/assets/day02/promotion/fixtures/promo_shelf_center.png",
    shelfRight: "/assets/day02/promotion/fixtures/promo_shelf_right.png",
    checkoutCounter: "/assets/day02/promotion/fixtures/checkout_counter.png",
    serviceDesk: "/assets/day02/promotion/fixtures/service_desk.png",
    damagedGoodsBin: "/assets/day02/promotion/fixtures/damaged_goods_bin.png"
  },
  ui: {
    promoSlotEmpty: "/assets/day02/promotion/ui/promo_slot_empty.png",
    promoSlotFilledCola: "/assets/day02/promotion/ui/promo_slot_filled_cola.png",
    promoSlotFilledWater: "/assets/day02/promotion/ui/promo_slot_filled_water.png",
    promoSlotFilledMilk: "/assets/day02/promotion/ui/promo_slot_filled_milk.png",
    customerQueueMarker: "/assets/day02/promotion/ui/customer_queue_marker.png",
    repairAlertIcon: "/assets/day02/promotion/ui/repair_alert_icon.png",
    promoDayBanner: "/assets/day02/promotion/ui/promo_day_banner.png",
    cashRegisterButton: "/assets/day02/promotion/ui/cash_register_button.png",
    serviceRequestBubble: "/assets/day02/promotion/ui/service_request_bubble.png",
    returnExchangeIcon: "/assets/day02/promotion/ui/return_exchange_icon.png",
    fridgeBrokenIcon: "/assets/day02/promotion/ui/fridge_broken_icon.png"
  },
  characters: {
    cashierIdle: "/assets/day02/promotion/characters/cashier_idle.png",
    customerWaitingCheckout: "/assets/day02/promotion/characters/customer_waiting_checkout.png",
    customerServiceRequest: "/assets/day02/promotion/characters/customer_service_request.png"
  }
} as const;

export type PromotionWingAssetKey =
  | "promotion-room-bg"
  | "promo-shelf-left"
  | "promo-shelf-center"
  | "promo-shelf-right"
  | "checkout-counter"
  | "service-desk"
  | "damaged-goods-bin"
  | "promo-slot-empty"
  | "promo-slot-filled-cola"
  | "promo-slot-filled-water"
  | "promo-slot-filled-milk"
  | "customer-queue-marker"
  | "repair-alert-icon"
  | "promo-day-banner"
  | "cash-register-button"
  | "service-request-bubble"
  | "return-exchange-icon"
  | "fridge-broken-icon"
  | "cashier-idle"
  | "customer-waiting-checkout"
  | "customer-service-request";

export function preloadPromotionWingAssets(scene: Phaser.Scene): void {
  scene.load.image("promotion-room-bg", PromotionWingAssets.background.room);
  scene.load.image("promo-shelf-left", PromotionWingAssets.fixtures.shelfLeft);
  scene.load.image("promo-shelf-center", PromotionWingAssets.fixtures.shelfCenter);
  scene.load.image("promo-shelf-right", PromotionWingAssets.fixtures.shelfRight);
  scene.load.image("checkout-counter", PromotionWingAssets.fixtures.checkoutCounter);
  scene.load.image("service-desk", PromotionWingAssets.fixtures.serviceDesk);
  scene.load.image("damaged-goods-bin", PromotionWingAssets.fixtures.damagedGoodsBin);

  scene.load.image("promo-slot-empty", PromotionWingAssets.ui.promoSlotEmpty);
  scene.load.image("promo-slot-filled-cola", PromotionWingAssets.ui.promoSlotFilledCola);
  scene.load.image("promo-slot-filled-water", PromotionWingAssets.ui.promoSlotFilledWater);
  scene.load.image("promo-slot-filled-milk", PromotionWingAssets.ui.promoSlotFilledMilk);
  scene.load.image("customer-queue-marker", PromotionWingAssets.ui.customerQueueMarker);
  scene.load.image("repair-alert-icon", PromotionWingAssets.ui.repairAlertIcon);
  scene.load.image("promo-day-banner", PromotionWingAssets.ui.promoDayBanner);
  scene.load.image("cash-register-button", PromotionWingAssets.ui.cashRegisterButton);
  scene.load.image("service-request-bubble", PromotionWingAssets.ui.serviceRequestBubble);
  scene.load.image("return-exchange-icon", PromotionWingAssets.ui.returnExchangeIcon);
  scene.load.image("fridge-broken-icon", PromotionWingAssets.ui.fridgeBrokenIcon);

  scene.load.image("cashier-idle", PromotionWingAssets.characters.cashierIdle);
  scene.load.image("customer-waiting-checkout", PromotionWingAssets.characters.customerWaitingCheckout);
  scene.load.image("customer-service-request", PromotionWingAssets.characters.customerServiceRequest);
}
