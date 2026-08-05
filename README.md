# LovePhone Studio｜小手机工坊

面向个人 DIY 的 AI 陪伴小手机搭建器。

## 启动

在项目目录打开两个终端。

终端一启动页面：

```powershell
npm run web
```

终端二启动音乐和 AI 桥接服务：

```powershell
node server/start-services.mjs
```

然后打开：

```text
http://127.0.0.1:5177/
```

音乐桥接默认使用 `5188` 端口，AI 桥接默认使用 `5189` 端口。也可以分别运行 `node server/music-bridge.mjs` 和 `node server/ai-bridge.mjs`。

首次使用网易云音乐时，可以在小手机“设置 → 音乐服务”点击“打开登录窗口”，使用网易云音乐 App 扫码。开发环境也可以在终端运行：

```powershell
ncm-cli login
```

登录状态保存在网易云 CLI 自己的本机目录中，不会进入小手机配置。设置 App 的“测试音乐连接”可以分别检查桥接服务和网易云登录状态。

搭建完成后，可在“完成”页打开独立小手机，也可以直接访问：

```text
http://127.0.0.1:5177/?mode=phone
```

Chrome 或 Edge 可以把独立小手机安装为 PWA 应用。

## 接入真实 AI

1. 在左侧“功能 → 设置”中勾选允许使用的模型服务商。
2. 在右侧小手机打开“设置 → AI 模型连接”。
3. 从下拉栏选择服务商，填写 API Key 和模型名称。
4. 点击“连接并测试”，成功后聊天 App 会使用真实模型并流式显示回复。
5. 自定义服务商还需要填写兼容接口的基础地址。

每个角色默认跟随全局 AI，也可以在角色详情中指定另一个已连接的服务商。

API Key 由本机 AI 桥接服务使用 Windows DPAPI 按当前 Windows 用户加密保存，不会写入浏览器、普通配置或导出的 JSON。其他 Windows 用户和其他电脑无法直接解密这份密钥文件。

## 已支持的模型协议

- OpenAI 兼容协议
- Anthropic Messages
- Google Gemini `streamGenerateContent`

内置服务商包括 OpenAI、Anthropic、Gemini、xAI、DeepSeek、火山引擎方舟 / 豆包、通义千问、Kimi、智谱、MiniMax、腾讯混元、百度千帆、硅基流动、OpenRouter、Ollama，以及自定义服务商。

## 主要功能

- 角色、聊天、记忆、日记、纪念日、晚安问候和设置 App
- 小手机整体美化、App 主题、图标套装和可拖动小组件
- 两页美化流程中的统一“+ 自定义”入口与实时手机预览
- 自定义手机壳、语义配色、圆角、阴影、桌面网格、Dock 和每个 App 的界面变量
- 声明式自定义小组件，可读取时间、天气、角色、音乐、纪念日、日记、记忆和心情
- 离线 ZIP 主题包导入导出、导入预检、文件哈希和独立素材库
- 网易云音乐搜索、推荐、榜单、歌单、歌词和本机播放
- 小组件联动音乐、相框上传、天气、时钟等
- 配置自动保存与 JSON 导入导出
- IndexedDB 本地数据库、最多 10 份自动备份、手动备份与恢复

## 安全自定义

“美化”仍保持“整机美化”和“App 美化”两页。每组预设最后都有“+ 自定义”，编辑时左侧打开统一面板，右侧手机实时预览；点击“应用”才保存，点击“取消”会恢复编辑前的状态。

开发者模式允许填写限定作用域 CSS，但不运行任意 JavaScript 或 HTML。CSS 不能使用外部网址、`@import`、远程字体或可执行表达式，只能影响整台手机或当前 App。自定义小组件只能读取白名单数据并调用白名单动作，不能读取 API Key。

主题包仅接受 JSON、CSS、PNG、JPG、WebP、GIF、WOFF 和 WOFF2。导入前会检查 ZIP 路径、类型、数量、压缩前后体积、外部资源、CSS 和 SHA-256 文件哈希；检查完成后由用户确认是否应用。导入的主题包与素材保存在独立 IndexedDB 中，不与聊天和手机配置备份混在一起。

## 数据保存

配置、聊天、记忆、日记和图片保存在浏览器的 IndexedDB 中。首次打开新版时，旧 `localStorage` 数据会先写入 IndexedDB 并生成迁移备份，成功后才会清理旧数据。

系统每隔至少 15 分钟为修改前的数据创建一份自动备份，最多保留 10 份。“完成”页可以查看空间占用、立即备份、恢复最近备份或导出 JSON。浏览器数据仍只属于当前设备，换设备前应导出 JSON。

## 桌面版

开发模式：

```powershell
npm install
npm run desktop
```

准备本机 MPV 并生成 Windows 安装包：

```powershell
npm run prepare:mpv
npm run desktop:build
```

目录测试版输出到 `release/win-unpacked`，安装包输出到 `release`。桌面版会自动启动网页、音乐桥接和 AI 桥接，不要求用户另装 Node；网易云首次登录可直接在设置 App 打开扫码窗口。

当前 MPV 测试二进制的许可证、网易云音乐内容授权和 Windows 安装包代码签名仍是公开发布前的阻断项，具体说明见 `THIRD_PARTY_NOTICES.md` 和 `docs/RELEASE_AUDIT.md`。未完成这些事项前，生成的安装包仅用于本机测试，不应公开分发。
