# LovePhone Studio｜小手机工坊

面向个人 DIY 的 AI 陪伴小手机搭建器。

> 这是一个本地优先的开源开发版。它目前主要支持 Windows；公开下载安装包前，音乐内容授权、MPV 许可证义务和 Windows 代码签名仍需完成。

## 开源与边界

- 本项目以 [MIT License](LICENSE) 开源。
- 欢迎提交问题与改进建议，参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全问题请按 [SECURITY.md](SECURITY.md) 中的方式私密报告，不要在公开 Issue 中附上 API Key、聊天内容或本地数据。
- 隐私、数据保存和删除方式见 [docs/PRIVACY.md](docs/PRIVACY.md)。

## 环境要求

- Windows 10 或 Windows 11
- Node.js 20 或更高版本
- npm 10 或更高版本
- Chrome 或 Edge（用于网页模式、PWA 和语音输入）

首次安装依赖：

```powershell
npm ci
```

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

如需改端口或本机 MPV 位置，可在启动前设置 PowerShell 环境变量。例如：

```powershell
$env:LOVEPHONE_AI_PORT = "5189"
$env:MPV_DIRECTORY = "C:\Program Files\MPV Player"
npm run services
```

不要把 API Key 写入仓库、截图或公开讨论中。

音乐桥接默认使用 `5188` 端口，AI 桥接默认使用 `5189` 端口。也可以分别运行 `node server/music-bridge.mjs` 和 `node server/ai-bridge.mjs`。音乐属于本地实验能力，仅在源码开发模式启用。

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

`npm run desktop`（或 `npm run desktop:experimental`）是本地开发模式，会保留实验音乐能力；使用前请自行准备 MPV，并确认网易云登录和使用权限。

生成可公开测试的 Windows 安装包：

```powershell
npm run desktop:build
```

目录测试版输出到 `release/win-unpacked`，安装包输出到 `release`。正式安装包会自动启动网页和 AI 桥接，不要求用户另装 Node；它不包含 MPV、网易云 CLI 或音乐桥接，音乐 App 和唱片组件会自动隐藏。

当前 Windows 安装包代码签名仍是公开发布前的阻断项，具体说明见 `THIRD_PARTY_NOTICES.md` 和 `docs/RELEASE_AUDIT.md`。本地实验音乐仍受 MPV 许可证和网易云音乐内容授权限制，不随公开安装包分发。

## 常见问题

### 页面能打开，但 AI 无法连接

确认第二个终端正在运行 `node server/start-services.mjs`，再在小手机“设置 → AI 模型连接”中点击“连接并测试”。API Key 仅交给本机 AI 桥接服务，不会进入导出的主题或配置文件。

### 音乐 App 没有内容或不能播放

音乐依赖本机音乐桥接服务、网易云登录状态和 MPV。先确认“设置 → 音乐服务”的连接检测通过。该功能仍是实验性本地功能，不适合作为公开安装包的承诺能力。

### 换浏览器或换电脑后内容不见了

聊天、记忆、图片和主题保存在当前设备的浏览器 IndexedDB。请在“完成”页导出 JSON 或主题包后再迁移设备；导出的文件不含 API Key。
