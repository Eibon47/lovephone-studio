# 贡献指南

谢谢你愿意改进 LovePhone Studio。

参与前请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 提交问题前

请先搜索现有 Issue，并说明：使用的系统和浏览器、复现步骤、预期结果、实际结果，以及不含 API Key 或私人聊天内容的截图。

功能建议请先写清楚用户场景和完成标准。这个项目以“普通用户不需要懂代码，也能搭出自己的陪伴小手机”为优先原则。

## 本地开发

```powershell
npm ci
npm test
npm run web
```

需要真实 AI 或音乐功能时，另开终端运行：

```powershell
npm run services
```

不要提交 `.env`、API Key、浏览器数据库、`release/` 产物、`node_modules/` 或本机音乐登录数据。

## 提交代码

1. 从最新 `main` 创建分支。
2. 让改动保持小而聚焦，并补上相应测试。
3. 运行 `npm test` 和 `npm run web:build`，确认全部通过。
4. 提交 Pull Request，说明改动、验证方法和可能的兼容性影响。

请不要加入外部网络资源、远程字体、第三方追踪脚本，或会把用户数据发送给未明确说明的服务。

## 自定义 App 相关改动

修改自定义 App 包格式、权限或 `LovePhone` API 时，请同步更新 [开发者说明](docs/CUSTOM_APP_DEVELOPER_GUIDE.md) 和 [示例 App](examples/hello-companion/)。新增权限时必须说明数据范围、用户可见提示、撤销后的行为和测试覆盖；不要让 App 取得 API Key、Cookie 或其他 App 的私有数据。
