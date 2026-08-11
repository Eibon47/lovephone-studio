# 小小问候示例 App

这是一个只使用 `storage` 和 `character.read` 权限的离线自定义 App。它读取当前角色名称，并把按钮点击次数保存在自己的独立空间。

## 本地打包

在此文件夹中打开 PowerShell，然后执行：

```powershell
Compress-Archive -Path manifest.json, app.html, styles, scripts -DestinationPath hello-companion.lovephone-app.zip -Force
```

回到 LovePhone 的“功能 → 自定义 App”，选择生成的 `hello-companion.lovephone-app.zip` 即可安装。

不要加入远程脚本、远程样式、远程图片或外部字体。需要联网、读取聊天或调用 AI 前，请先阅读 [开发者 API 说明](../../docs/CUSTOM_APP_DEVELOPER_GUIDE.md)，并在 `manifest.json` 中声明最小权限。
