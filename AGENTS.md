> 目的：为所有接手 PageVoice2 的开发者和 AI 工具提供最小但完整的项目状态与执行入口。　目标读者：项目开发者与跨工具协作的 AI。　如何阅读：先看当前状态和下一步，再按需阅读 `docs/PROJECT_PLAN.md`。

# PageVoice2

PageVoice2 是一个面向手机与 iPad 的纯静态英文拍照读书 PWA，书页照片、OCR、词典查询和阅读进度均优先在浏览器本地处理。

## 运行与测试

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 最小验证：`npm test && npm run build`
- 技术栈：React、TypeScript、Vite、Tesseract.js、Dexie 和 Web Speech API。
- 正式浏览器基线：iOS/iPadOS 17+、主流 Android Chrome，以及当前版桌面 Safari、Chrome、Edge。
- 详细功能、优先级、里程碑和验收条件见 `docs/PROJECT_PLAN.md`。

## 硬约束

- MVP 不上传书页照片或正文，不依赖登录与后端。
- OCR 完成后仅保存压缩缩略图，不保存原始书页照片。
- 朗读使用“一句一个 `SpeechSynthesisUtterance`”的应用层状态机，不依赖 `boundary` 事件同步。
- GitHub remote 必须使用 SSH；GitHub Pages 必须兼容项目子路径。
- 所有设计、计划和交接 Markdown 文档必须包含开头的目的/目标读者/如何阅读，以及结尾的变更记录。

## 当前状态

- 已完成 React/Vite 工程、Git 仓库和 G“舒缓纸墨色”响应式界面。
- 已完成项目库、IndexedDB、拍照/选图、图片处理、本地 OCR、文字校对、逐句朗读、点词离线查询、PWA 和 GitHub Pages 工作流。
- 已生成 5 万词、504 个前缀分片的离线词典，并自托管英文 OCR 模型与四种 WASM 核心。
- 自动化测试和生产构建通过；浏览器实测已打通选图 OCR、校对、阅读、查词和离线资源准备。
- 尚未完成真实 iPhone/iPad Safari 验收，也未绑定 GitHub remote 或实际发布 Pages。

## 下一步 TODO

- [x] 用户确认 G“舒缓纸墨色”。
- [x] 初始化 React + TypeScript + Vite 工程与 Git 仓库。
- [x] 完成 M1–M5 的代码实现与桌面浏览器验证。
- [ ] 在真实 iPhone/iPad Safari 17+ 验证朗读、暂停恢复、拍照入口、切后台和主屏幕安装。
- [ ] 使用 3–5 张真实书页补充 OCR 准确率、耗时和内存验收。
- [ ] 获得 GitHub SSH 仓库地址后设置 remote、推送并启用 Pages。

## 文件地图

- `AGENTS.md`：当前状态、约束和下一步。
- `docs/PROJECT_PLAN.md`：完整产品范围、优先级、里程碑和验收条件。

## 关键实现备忘

- IndexedDB 保存项目、校对正文、句子、阅读进度、偏好和压缩缩略图。
- Service Worker 只缓存公共应用资源；OCR 模型和词典按需加载并提供离线准备入口。
- Safari 暂停恢复异常时取消朗读队列，并从当前句句首重新播放。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-08-03 | 完成 MVP 代码、离线资源与浏览器验证并刷新真实剩余事项；why：让下一位接手者从真机验收和实际发布继续，而非重复已完成开发 |
| 2026-08-03 | 初始创建项目协作入口；记录已锁定约束、当前等待事项和后续里程碑，便于跨工具接手 |
