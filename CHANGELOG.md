# Changelog

## [Unreleased]

### Fixed (review)

- SSE 仅在网络失败时降级同步；出图完成刷新 workspace
- Vision 降级 UI 提示；变体/出图 409 文案

### Added

- **ASO 创作**入口：新建项目类型、工作台侧栏、路由 `/aso`
- ASO 工作台：创意输入、方案列表（编辑/选中/出图）、素材网格（上传/文字/引用/变体）、尺寸预设、成品图库
- `src/api/aso.ts`：REST + SSE 方案流
- i18n：zh-CN / zh-TW / en ASO 文案
- `yarn sync-dist`：构建后将 `dist/` 同步至 Toonflow-app `data/web/`

### Changed

- ASO 项目隐藏视频/导演手册字段，跳过 `videoModel` 校验
- ASO 项目工作台仅展示 ASO + 资产菜单
