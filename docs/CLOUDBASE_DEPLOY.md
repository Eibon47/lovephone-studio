# 部署到腾讯云 CloudBase

本仓库已配置 CloudBase 环境 `xiaoye-d4ggsw4zt7bce7dba`。腾讯云部署分为两部分：静态网站托管和 HTTP 云函数。

## 当前线上地址

- 小手机工坊前端：`https://xiaoye-d4ggsw4zt7bce7dba-1452473060.tcloudbaseapp.com`
- AI 网关：`https://xiaoye-d4ggsw4zt7bce7dba.service.tcloudbase.com/api-ai`
- 音乐网关：`https://xiaoye-d4ggsw4zt7bce7dba.service.tcloudbase.com/music-gateway`

前端会自动选择 CloudBase 网关，用户无需填写这些地址。AI Key 只保存在用户当前浏览器会话中，并在每次请求时临时转发给模型服务商。

## 后续发布

在项目根目录执行：

```powershell
npm test
npm run web:build
cloudbase fn deploy ai-gateway --force --install-dependency false
cloudbase hosting deploy .\dist -e xiaoye-d4ggsw4zt7bce7dba --enable-git-ignore
```

首次创建函数和路由已经完成。路由为：

- `/api-ai` -> `ai-gateway`
- `/music-gateway` -> `yuanxiao-music-gateway`

## 正式上线前

CloudBase 的默认域名只适合开发测试，存在有效期和访问频率限制。面向公开用户时，请在 CloudBase 控制台的“环境配置 -> HTTP 访问服务”绑定已备案的自定义域名，并将静态托管根路径和两个网关路径都配置到该域名。

不要把任何用户 API Key、音乐 Cookie 或腾讯云密钥写入 Git 仓库、`cloudbaserc.json` 或环境变量。
