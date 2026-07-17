export type DayOneMoment =
  | "WELCOME"
  | "FIND_EMPTY_SHELF"
  | "FETCH_PRODUCT"
  | "RESTOCK"
  | "CUSTOMER_REACTION";

export const DAY_ONE_SEQUENCE: DayOneMoment[] = [
  "WELCOME",
  "FIND_EMPTY_SHELF",
  "FETCH_PRODUCT",
  "RESTOCK",
  "CUSTOMER_REACTION"
];

export function getDayOnePrompt(step: DayOneMoment): string {
  switch (step) {
    case "WELCOME":
      return "Welcome to your first supermarket day!";
    case "FIND_EMPTY_SHELF":
      return "A shelf is empty. Find what needs restocking.";
    case "FETCH_PRODUCT":
      return "Take the product box from storage.";
    case "RESTOCK":
      return "Bring the cart to the shelf and restock.";
    case "CUSTOMER_REACTION":
      return "Customers are happy with the fresh shelves.";
  }
}
