export type DayOneSceneBridge = {
  zones: string[];
  firstMission: string;
  immersiveLoop: string[];
};

export const DAY_ONE_SCENE_BRIDGE: DayOneSceneBridge = {
  zones: [
    "FRUIT",
    "VEGETABLE",
    "DRINKS",
    "GRAINS"
  ],
  firstMission: "RESTOCK_FIRST_SHELF",
  immersiveLoop: [
    "discover_empty_shelf",
    "collect_product_box",
    "push_cart_to_zone",
    "restock_shelf",
    "welcome_customer"
  ]
};
