from pathlib import Path

path = Path("scripts/capture-release-regressions.mjs")
source = path.read_text()

old_level_check = '''    if (level.number === 1) {
      const metadata = await readMetadata(page);
'''
new_level_check = '''    if (level.number === 1) {
      await waitReady(page);
      const metadata = await readMetadata(page);
'''
if old_level_check not in source:
    raise SystemExit("Missing level-one metadata check anchor")
source = source.replace(old_level_check, new_level_check, 1)

old_metadata = '''      actorType: actor?.type,
      actorTexture: actor?.texture?.key,
      sdk: document.body.dataset.crazyGamesSdk,
'''
new_metadata = '''      actorType: actor?.type,
      actorTexture: actor?.texture?.key,
      actorComposition: document.body.dataset.restockActorComposition,
      actorControl: document.body.dataset.restockActorControl,
      loadVisual: document.body.dataset.restockLoadVisual,
      sdk: document.body.dataset.crazyGamesSdk,
'''
if old_metadata not in source:
    raise SystemExit("Missing metadata reader anchor")
source = source.replace(old_metadata, new_metadata, 1)

path.write_text(source)
