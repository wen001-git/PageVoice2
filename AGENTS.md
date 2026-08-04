> 目的：为所有接手 PageVoice2 的开发者和 AI 工具提供最小但完整的项目状态与执行入口。　目标读者：项目开发者与跨工具协作的 AI。　如何阅读：先看当前状态和下一步，再按需阅读 `docs/PROJECT_PLAN.md`。

# PageVoice2

PageVoice2 是一个面向手机与 iPad 的英文拍照读书 PWA：项目、词典和默认 OCR 均在浏览器本地处理，用户也可明确选择 EdgeOne Serverless 代理的腾讯云高精度 OCR。

## 运行与测试

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 最小验证：`npm test && npm run build`
- 技术栈：React、TypeScript、Vite、Tesseract.js、Dexie、Web Speech API、EdgeOne Cloud Functions 和腾讯云 OCR SDK。
- 正式浏览器基线：iOS/iPadOS 17+、主流 Android Chrome，以及当前版桌面 Safari、Chrome、Edge。
- 详细功能、优先级、里程碑和验收条件见 `docs/PROJECT_PLAN.md`。

## 硬约束

- 默认本地 OCR 不上传照片；只有用户明确点击“高精度识别”时，当前压缩图片才发送给腾讯云完成一次识别。
- 服务端只提供同源 `/api/ocr` 代理；密钥与家庭 PIN 只能来自 EdgeOne 敏感环境变量，不写入前端、日志或项目数据。
- OCR 完成后仅保存压缩缩略图，不保存原始书页照片。
- 朗读使用“一句一个 `SpeechSynthesisUtterance`”的应用层状态机，不依赖 `boundary` 事件同步。
- 阅读交互采用方案 A：点击正文句子、上一句或下一句只朗读目标句一次；底部主播放键才从当前句连续朗读；“循环本句”开启时循环当前句。
- GitHub remote 必须使用 SSH；GitHub Pages 必须兼容项目子路径。
- 所有设计、计划和交接 Markdown 文档必须包含开头的目的/目标读者/如何阅读，以及结尾的变更记录。

## 当前状态

- 已完成 React/Vite 工程、Git 仓库和 G“舒缓纸墨色”响应式界面。
- 已完成项目库、IndexedDB、拍照/选图、图片处理、本地 OCR、文字校对、逐句朗读、点词离线查询、PWA 和 GitHub Pages 工作流。
- 已生成 5 万词、504 个前缀分片的离线词典，并自托管英文 OCR 模型与四种 WASM 核心。
- 自动化测试和生产构建通过；浏览器实测已打通选图 OCR、校对、阅读、查词和离线资源准备。
- 已通过 SSH remote 推送 GitHub，并在 EdgeOne 发布到 `pagevoice3.leewen.work`。
- 已实现本地 Tesseract + 腾讯云 `GeneralAccurateOCR` 双入口、图片限额压缩、同源接口、家庭 PIN、取消/超时和安全错误映射；修改前基线标签为 `backup-before-tencent-ocr-20260804`。
- 已从 EdgeOne 生产日志定位并修复腾讯 SDK CommonJS/ESM 默认导出不兼容导致的 Cloud Function 冷启动 502；生产 Origin 明确允许 `pagevoice3.leewen.work`，并保留 Host/Forwarded Host 与可选 `PAGEVOICE_OCR_ORIGINS` 适配。
- 已在生产域名验证腾讯云高精度 OCR 可用且识别质量明显优于本地方案；已修复云 OCR 按视觉行断句的问题，打开旧项目时会自动按完整英文句子重新分句。
- 已实现方案 A 阅读交互：正文自然排版，点句只读一次，底部播放连续朗读，上一句/下一句单读，“循环本句”语义明确。
- 尚未完成安卓手机上的高精度 OCR 与真实 iPhone/iPad Safari 朗读验收。

## 下一步 TODO

- [x] 用户确认 G“舒缓纸墨色”。
- [x] 初始化 React + TypeScript + Vite 工程与 Git 仓库。
- [x] 完成 M1–M5 的代码实现与桌面浏览器验证。
- [ ] 在真实 iPhone/iPad Safari 17+ 验证朗读、暂停恢复、拍照入口、切后台和主屏幕安装。
- [x] 在 EdgeOne 配置 `PAGEVOICE_OCR_PIN` 并用桌面 Chrome 验证真实书页高精度识别。
- [ ] 用安卓 Chrome 在生产域名验证一张真实书页的高精度识别与方案 A 单句/连续朗读交互。
- [ ] 使用 3–5 张真实书页对比本地与腾讯云识别的准确率和耗时，并检查 EdgeOne 日志不含图片、PIN、密钥或正文。
- [ ] 后续若停用腾讯云 OCR，制作 PP-OCRv5 Mobile 浏览器 A/B 验证页；通过真实书页准确率、耗时和内存验收后，再考虑替换 Tesseract.js，服务端 PP-OCRv5 仅作为远期高精度方案。

## 文件地图

- `AGENTS.md`：当前状态、约束和下一步。
- `docs/PROJECT_PLAN.md`：完整产品范围、优先级、里程碑和验收条件。

## 关键实现备忘

- IndexedDB 保存项目、校对正文、句子、阅读进度、偏好和压缩缩略图。
- Service Worker 只缓存公共应用资源；OCR 模型和词典按需加载并提供离线准备入口。
- `/api/ocr` 为明确的 NetworkOnly POST，不缓存请求或响应；服务端请求体限制 5 MB，Cloud Function 固定部署香港区域。
- Safari 暂停恢复异常时取消朗读队列，并从当前句句首重新播放。
- 腾讯 OCR 返回的逐行文字先合并硬换行、修复跨行连字符，再按英文标点分句；短章节标题单独保留。旧项目打开时会自动重建句子并尽量映射原阅读位置。
- OCR 当前决策：近期先接腾讯云 `GeneralAccurateOCR`，API 凭证只放服务端环境变量；不使用腾讯云时的首选备选算法为浏览器本地 PP-OCRv5 Mobile，Tesseract.js 保留为离线保底。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-08-04 | 将腾讯 OCR 视觉行重建为完整英文句子，并采用“点句单读、主播放键连续、上下句单读、循环本句”的方案 A；why：让选择高亮符合句子语义，避免点选后意外持续朗读 |
| 2026-08-04 | 修复 EdgeOne 打包腾讯 OCR SDK 时默认导出为空造成的 `/api/ocr` 冷启动 502，并为平台未暴露公开 Host 的情况明确允许正式 Origin；why：让自定义域名请求能进入 PIN、配置及腾讯 OCR 调用流程，而非在 0 ms 初始化阶段崩溃或被误判为跨域 |
| 2026-08-04 | 完成腾讯云高精度 OCR 的 EdgeOne 服务端代理、家庭 PIN、前端双入口与隐私边界，并刷新发布验收事项；why：在保留离线能力的同时提升真实书页识别质量且不暴露云密钥 |
| 2026-08-04 | 记录腾讯云高精度 OCR 的近期接入顺序与 PP-OCRv5 Mobile 的本地替代路线；why：避免配置云服务期间遗失已确认的无腾讯云备选方案 |
| 2026-08-03 | 完成 MVP 代码、离线资源与浏览器验证并刷新真实剩余事项；why：让下一位接手者从真机验收和实际发布继续，而非重复已完成开发 |
| 2026-08-03 | 初始创建项目协作入口；记录已锁定约束、当前等待事项和后续里程碑，便于跨工具接手 |
