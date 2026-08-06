# 部署到 Netlify

Netlify 会从 GitHub 拉取代码，执行构建，然后发布网页和 AI 网关函数。它不是把你的电脑服务搬到网上，而是每次 GitHub 推送后重新构建一份网站。

## 部署前条件

- GitHub 仓库已推送，且你能访问 `NingzeXu/lovephone-studio`。
- 已完成 [GitHub 发布前检查](GITHUB_RELEASE_CHECKLIST.md)。
- 项目根目录已有 `netlify.toml` 和 `netlify/functions/ai.mjs`。
- 本机已通过 `npm test` 和 `npm run web:build`。

## 第一次部署

1. 登录 [Netlify](https://app.netlify.com/)，选择 **Add new site** -> **Import an existing project**。
2. 选择 GitHub，并授权 Netlify 读取 `NingzeXu/lovephone-studio`。
3. 选择仓库后，Netlify 会读取项目中的 `netlify.toml`。确认构建命令为 `node server/build-web.mjs`，发布目录为 `dist`，函数目录为 `netlify/functions`。
4. 点击 Deploy site，等待构建完成。
5. 打开 Netlify 给出的 `https://...netlify.app` 地址，分别测试 `/` 和 `/?mode=phone`。

## AI 在 Netlify 上如何工作

- 手机或网页用户在“设置 -> AI 模型连接”填写自己的服务商、模型和 API Key。
- Key 只留在该用户当前浏览器会话中，并随请求传到本网站的 `/.netlify/functions/ai`。
- Netlify Function 再把请求转发给用户选择的模型服务商；Key 不写入 GitHub、配置导出、IndexedDB 或 Netlify 环境变量。
- 关闭浏览器或会话失效后，用户需要重新填写 Key。这是有意的安全设计。

因此，首次部署不需要在 Netlify 填写 OpenAI、豆包或其他模型的 API Key 环境变量。

## 部署后必测项目

- HTTPS 地址可正常加载，手机浏览器能访问成品模式。
- Chrome/Edge 能安装 PWA；iPhone Safari 能通过“分享 -> 添加到主屏幕”安装。
- 用一个测试 API Key 点击“连接并测试”，再发送一条聊天消息。
- 关闭网页后重新打开，确认 Key 不会出现在配置导出或浏览器持久数据中。
- 导出并导入 JSON，确认角色、主题和聊天数据按预期恢复。
- 不要在公开演示站输入真实的网易云登录 Cookie；在线音乐只使用你自己部署或明确可信的 HTTPS 兼容 API。

## 以后如何更新

每次本地完成修改后，依次执行 `npm test`、`npm run web:build`、`git add .`、`git commit -m "feat: describe this update"`、`git push origin main`。

Netlify 会自动检测 `main` 的新提交并重新部署。发生问题时可在 Netlify 的 Deploys 页面选择上一个成功版本并发布回退；GitHub 的提交历史仍会保留。

## 常见问题

### 手机上能打开，但 AI 提示不可用

确认访问的是 Netlify 的 `https://` 地址，而不是电脑局域网的 `http://192.168.x.x:5178` 地址。局域网预览不会暴露电脑本机的 AI 服务。

### Netlify 构建失败

先在本机运行 `npm ci`、`npm test`、`npm run web:build`。本地通过后，在 Netlify 构建日志中确认它使用 Node.js 20 或更高版本，并把完整报错保留给排查。

