const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

test("CrazyGames progress uses the SDK Data Module with local migration", () => {
  const platform = readFileSync("src/platform/crazyGamesPlatform.ts", "utf8");
  const bootstrap = readFileSync(
    "src/game/infrastructure/phaser/createPhaserGame.ts",
    "utf8"
  );
  const store = readFileSync(
    "src/game/infrastructure/browser/BrowserCampaignSessionStore.ts",
    "utf8"
  );

  assert.match(platform, /data: CrazyGamesDataModule/);
  assert.match(platform, /dataStorage\(\): CrazyGamesDataModule \| undefined/);
  assert.match(bootstrap, /crazyGamesPlatform\.dataStorage\(\)/);
  assert.match(bootstrap, /crazyGamesData \? availableLocalStorage\(\) : undefined/);
  assert.match(store, /this\.storage\?\.setItem\(key, legacy\)/);
});

test("CrazyGames mute setting supports both mute and audio restore", () => {
  const source = readFileSync("src/platform/crazyGamesPlatform.ts", "utf8");
  assert.match(source, /this\.game\.sound\.mute = settings\.muteAudio === true/);
  assert.match(source, /addSettingsChangeListener/);
  assert.match(source, /crazyGamesAudio/);
});
