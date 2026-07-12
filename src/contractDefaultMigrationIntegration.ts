const DEFAULT_CONTRACTS = {
  "supermarket.shiftContract.day01": "restock-pro",
  "supermarket.shiftContract.day03": "supervisor-service"
} as const;

try {
  Object.entries(DEFAULT_CONTRACTS).forEach(([key, value]) => {
    if (!globalThis.localStorage?.getItem(key)) {
      globalThis.localStorage?.setItem(key, value);
    }
  });
} catch {
  // Storage is optional. Contract pickers still work with their in-memory defaults.
}
