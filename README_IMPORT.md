# Production V1 asset import

把压缩包解压到 `supermarket-restock-game/` 仓库根目录。

最终目录：

```text
public/assets/game/production-v1/
├─ characters/
│  ├─ worker/
│  └─ customers/
├─ products/
├─ props/
├─ fixtures/
└─ _source-sheets/
```

运行时代码路径不包含 `public/`：

```ts
"assets/game/production-v1/characters/worker/worker-idle.png"
```

同时包含：

```text
src/game/assets/ProductionV1AssetPaths.ts
```

用于集中引用素材路径。

这套目录不会覆盖项目现有素材，确认效果后再逐步替换旧素材引用。
