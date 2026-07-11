const DAY_ONE_CONTRACT_KEY = "supermarket.shiftContract.day01";

try {
  if (!globalThis.localStorage?.getItem(DAY_ONE_CONTRACT_KEY)) {
    globalThis.localStorage?.setItem(DAY_ONE_CONTRACT_KEY, "restock-pro");
  }
} catch {
  // Storage is optional. The contract picker still works for the current session.
}
