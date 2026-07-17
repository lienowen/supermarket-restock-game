export type CustomerMood = "happy" | "waiting" | "leaving";

export interface DayOneCustomerEvent {
  trigger: "restock_complete" | "store_open";
  message: string;
  mood: CustomerMood;
}

export const DAY_ONE_CUSTOMER_FLOW: DayOneCustomerEvent[] = [
  {
    trigger: "store_open",
    message: "Welcome customers to the new supermarket!",
    mood: "waiting"
  },
  {
    trigger: "restock_complete",
    message: "Fresh products are back on the shelf!",
    mood: "happy"
  }
];
