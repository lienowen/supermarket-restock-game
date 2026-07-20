export function createLevelNavigationUrl(
  currentUrl: string,
  levelId: string
): string {
  if (!levelId.trim()) throw new Error("Target level ID is required");
  const url = new URL(currentUrl);
  url.searchParams.set("level", levelId);
  url.searchParams.delete("shift");
  return url.toString();
}

export function navigateToLevel(levelId: string): void {
  window.location.assign(createLevelNavigationUrl(window.location.href, levelId));
}
