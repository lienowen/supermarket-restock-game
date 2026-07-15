第五批素材包

使用方法：
1. 将压缩包放到 supermarket-restock-game 项目根目录。
2. 直接解压。
3. 文件会进入：
   public/assets/common/supermarket/fixtures/

本批共 9 张：
- 生鲜货架 full / low / empty
- 冷冻货架 full / low / empty
- 收银区货架 full / low / empty

每组图片都使用相同的 1024×1280 透明画布，便于 Phaser
直接使用 setTexture() 切换库存状态，不会发生位置跳动。
