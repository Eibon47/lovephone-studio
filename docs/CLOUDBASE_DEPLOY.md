# 部署到腾讯云 CloudBase

公开仓库不包含任何维护者的 CloudBase 环境 ID 或网关地址。每个部署者使用自己的私有配置。

## 首次配置

1. 复制 `cloudbaserc.example.json` 为 `cloudbaserc.local.json`。
2. 把 `envId` 改成自己的 CloudBase 环境 ID。
3. 复制 `.env.example` 为 `.env.production.local`。
4. 填写本次部署需要内置的网关：

```env
LOVEPHONE_AI_GATEWAY_URL=https://your-service.example/api-ai
LOVEPHONE_MUSIC_GATEWAY_URL=https://your-service.example/music-gateway
```

`cloudbaserc.local.json` 和 `.env.production.local` 已被 Git 忽略，不会进入开源仓库。

## 部署

完成 CloudBase 登录和 HTTP 路由创建后，在项目根目录执行：

```powershell
npm run cloudbase:deploy
```

脚本会依次执行测试、构建、部署两个云函数和上传静态网站。建议的 HTTP 路由是：

- `/api-ai` -> `ai-gateway`
- `/music-gateway` -> `wangyiyun66-gateway`

## 开源构建与私有构建

- 没有 `.env.production.local` 时，`npm run web:build` 产生的开源版不带任何网关。
- 有 `.env.production.local` 时，网关只会写入本次生成的 `dist/runtime-config.js`。
- 用户在设置中手动填写的地址始终优先于部署默认值。

不要把 API Key、音乐 Cookie、腾讯云密钥或私有网关地址提交到 Git。
