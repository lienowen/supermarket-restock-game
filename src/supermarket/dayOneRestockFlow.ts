export type DayOneStep =
  | "ENTER_STORE"
  | "FIND_EMPTY_SHELF"
  | "PICK_PRODUCT"
  | "MOVE_CART"
  | "RESTOCK_SHELF"
  | "WELCOME_CUSTOMERS";

export interface DayOneRestockTask {
  step: DayOneStep;
  title: string;
  description: string;
}

export const DAY_ONE_RESTOCK_FLOW: DayOneRestockTask[] = [
  {
    step: "ENTER_STORE",
    title: "Welcome to your supermarket",
    description: "Walk into the store and prepare for opening day."
  },
  {
    step: "FIND_EMPTY_SHELF",
    title: "Find the empty shelf",
    description: "A shelf needs products before customers arrive."
  },
  {
    step: "PICK_PRODUCT",
    title: "Pick up the product box",
    description: "Take products from storage with your cart."
  },
  {
    step: "MOVE_CART",
    title: "Push the cart to the aisle",
    description: "Bring the products to the correct department."
  },
  {
    step: "RESTOCK_SHELF",
    title: "Restock the shelf",
    description: "Place products into the highlighted shelf slots."
  },
  {
    step: "WELCOME_CUSTOMERS",
    title: "The store is open",
    description: "Customers can now explore your supermarket."
  }
];
