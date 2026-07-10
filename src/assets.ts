export const Assets = {
  backgrounds: {
    backroom: "backroom-bg",
    salesfloor: "salesfloor-bg"
  },
  props: {
    cart: "cart",
    shelf: "shelf-frame",
    boxCola: "box-cola",
    boxWater: "box-water",
    boxMilk: "box-milk"
  },
  products: {
    cola: "product-cola",
    water: "product-water",
    milk: "product-milk"
  },
  characters: {
    workerIdle: "worker-idle",
    workerCarry: "worker-carry-box",
    workerRestock: "worker-restock",
    workerPush: "worker-push-cart",
    customer01Idle: "customer-01-idle",
    customer01Basket: "customer-01-basket",
    customer02Idle: "customer-02-idle",
    customer02Basket: "customer-02-basket"
  },
  ui: {
    workerAvatar: "ui-worker-avatar",
    coin: "ui-icon-coin",
    star: "ui-icon-star",
    timer: "ui-icon-timer",
    menu: "ui-icon-menu",
    taskPanel: "ui-task-panel",
    taskButton: "ui-button-tasks",
    hintBubble: "ui-hint-bubble",
    stepCard: "ui-step-card",
    missingTag: "ui-missing-tag"
  }
} as const;

export const AssetPaths = {
  [Assets.backgrounds.backroom]: "./assets/day01/backroom_bg.png",
  [Assets.backgrounds.salesfloor]: "./assets/day01/salesfloor_bg.png",
  [Assets.props.cart]: "./assets/day01/cart.png",
  [Assets.props.shelf]: "./assets/day01/shelf_frame.png",
  [Assets.props.boxCola]: "./assets/day01/box_cola.png",
  [Assets.props.boxWater]: "./assets/day01/box_water.png",
  [Assets.props.boxMilk]: "./assets/day01/box_milk.png",
  [Assets.products.cola]: "./assets/day01/product_cola.png",
  [Assets.products.water]: "./assets/day01/product_water.png",
  [Assets.products.milk]: "./assets/day01/product_milk.png",
  [Assets.characters.workerIdle]: "./assets/day01/worker_idle.png",
  [Assets.characters.workerCarry]: "./assets/day01/worker_carry_box.png",
  [Assets.characters.workerRestock]: "./assets/day01/worker_restock.png",
  [Assets.characters.workerPush]: "./assets/day01/worker_push_cart.png",
  [Assets.characters.customer01Idle]: "./assets/day01/customer_01_idle.png",
  [Assets.characters.customer01Basket]: "./assets/day01/customer_01_basket.png",
  [Assets.characters.customer02Idle]: "./assets/day01/customer_02_idle.png",
  [Assets.characters.customer02Basket]: "./assets/day01/customer_02_basket.png",
  [Assets.ui.workerAvatar]: "./assets/ui/ui_worker_avatar.png",
  [Assets.ui.coin]: "./assets/ui/ui_icon_coin.png",
  [Assets.ui.star]: "./assets/ui/ui_icon_star.png",
  [Assets.ui.timer]: "./assets/ui/ui_icon_timer.png",
  [Assets.ui.menu]: "./assets/ui/ui_icon_menu.png",
  [Assets.ui.taskPanel]: "./assets/ui/ui_task_panel.png",
  [Assets.ui.taskButton]: "./assets/ui/ui_button_tasks.png",
  [Assets.ui.hintBubble]: "./assets/ui/ui_hint_bubble.png",
  [Assets.ui.stepCard]: "./assets/ui/ui_step_card.png",
  [Assets.ui.missingTag]: "./assets/ui/ui_missing_tag.png"
} as const;

export type AssetKey = keyof typeof AssetPaths;
