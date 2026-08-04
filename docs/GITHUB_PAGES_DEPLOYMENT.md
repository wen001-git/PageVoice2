> 目的：记录 PageVoice2 在 GitHub Pages 上的首次启用、部署、访问和故障排查方法。　目标读者：项目维护者、开发者及后续接手项目的 AI 工具。　如何阅读：首次发布按“首次启用”操作，日常更新只需查看“后续发布”，失败时再查“常见问题”。

# PageVoice2 GitHub Pages 部署指南

## 1. 当前部署方式

PageVoice2 使用 React、TypeScript 和 Vite 开发。仓库中的源码必须先构建为 `dist` 静态文件，再部署到 GitHub Pages。

项目已经提供自动部署工作流：

```text
.github/workflows/deploy-pages.yml
```

它会在代码推送到 `main` 后自动执行：

```text
安装依赖 → 运行测试 → Vite 构建 → 上传 dist → 发布 GitHub Pages
```

因此，GitHub Pages 必须选择 **GitHub Actions** 作为发布源，不能直接发布仓库根目录。

## 2. 首次启用 GitHub Pages

1. 打开 GitHub 仓库：`wen001-git/PageVoice2`。
2. 依次进入 `Settings` → 左侧 `Pages`。
3. 找到 `Build and deployment`。
4. 打开 `Source` 下拉框。
5. 把 `Deploy from a branch` 改为 `GitHub Actions`。

选择完成后，页面中的 `Branch`、`None` 和 `Save` 会消失，这是正常现象，不需要填写这些空格。

不要选择下面这种配置：

```text
Branch: main
Folder: /(root)
```

仓库根目录包含的是 React/TypeScript 源码，不是已经构建好的网站文件，直接发布会导致页面无法正常运行。

## 3. 触发第一次部署

启用 GitHub Actions 后：

1. 打开仓库顶部的 `Actions`。
2. 在左侧选择 `Deploy PageVoice2 to GitHub Pages`。
3. 如果已有一次失败的运行记录：
   - 打开失败记录；
   - 点击右上角 `Re-run jobs`；
   - 选择 `Re-run all jobs`。
4. 如果没有运行记录，可点击 `Run workflow`：
   - Branch 选择 `main`；
   - 点击绿色的 `Run workflow`。
5. 等待 `build` 和 `deploy` 两个任务都显示绿色勾号。

## 4. 访问网站

部署成功后访问自定义域名：

```text
https://pagevoice2.leewen.work/
```

自定义域名从网站根路径提供 PageVoice2，因此 Vite 的生产环境 `base` 必须保持为 `/`。GitHub Pages 会把原项目地址重定向到自定义域名。部署刚完成时，网站可能需要短暂等待后才能访问。

## 5. 后续发布

首次配置完成后，不需要重复设置 Pages。以后只要将 `main` 分支的新提交推送到 GitHub：

```bash
git push
```

部署工作流就会自动运行。可在仓库的 `Actions` 页面查看构建和发布进度。

## 6. 本地发布前检查

提交前可以在项目目录运行：

```bash
npm install
npm test
npm run build
```

本地预览正式构建：

```bash
npm run preview
```

请使用终端显示的 HTTP 地址访问，不要双击源码 `index.html` 或 `dist/index.html`。

“纯静态网站”表示部署后不需要应用后端、数据库或云端计算服务，并不表示所有功能都能通过 `file://` 双击运行。PageVoice2 的 JavaScript 模块、OCR Worker、WASM、Service Worker 和 PWA 功能需要通过 HTTP 或 HTTPS 加载。

## 7. 常见问题

### Pages 页面仍显示 Disabled

确认 `Source` 已选择 `GitHub Actions`，然后到 `Actions` 页面重新运行部署工作流。

### Actions 构建失败

打开失败的 workflow，展开带红叉的步骤，查看具体错误。常见失败位置包括依赖安装、自动测试和 Vite 构建。

### 部署成功但页面空白

检查 `vite.config.ts` 的生产环境 `base` 是否为 `/`。如果构建结果仍引用 `/PageVoice2/assets/`，JavaScript 和 CSS 会在自定义域名下返回 404，页面将无法启动。

### 页面显示旧版本

先确认最新部署已经完成，再刷新页面。由于 PageVoice2 是 PWA，Service Worker 可能仍保留旧版本；按照页面的版本更新提示刷新，必要时关闭页面后重新打开。

### OCR 或离线准备失败

确认访问的是 HTTPS GitHub Pages 地址，并在首次使用时保持联网，让浏览器下载 OCR 模型、WASM 和离线词典资源。

## 8. 相关文件

- `.github/workflows/deploy-pages.yml`：GitHub Actions 构建与部署流程。
- `vite.config.ts`：自定义域名根路径和 Vite 构建配置。
- `AGENTS.md`：项目当前状态、运行方式和后续任务。
- `docs/PROJECT_PLAN.md`：完整功能范围、里程碑和验收条件。

## 变更记录

| 日期 | 变更内容 |
|------|----------|
| 2026-08-04 | 将正式访问地址改为 `pagevoice2.leewen.work` 并说明 Vite 根路径要求；why：自定义域名从 `/` 提供资源，继续使用 `/PageVoice2/` 会导致 JS/CSS 404 和空白页 |
| 2026-08-04 | 初始创建 GitHub Pages 部署指南，记录 Actions 发布源、首次部署、日常更新和故障排查方法；why：避免把 Vite 源码目录误设为 Pages 发布目录，并方便跨工具复用部署流程 |
