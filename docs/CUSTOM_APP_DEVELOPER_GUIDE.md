# LovePhone 自定义 App 开发说明

自定义 App 使用 `.lovephone-app.zip` 安装包。App 会在独立沙箱页面运行，不能直接访问 LovePhone 的父页面；需要系统数据、私有存储、通知、联网或打开其他 App 时，请调用 `LovePhone` API。

## 最小目录

```text
my-app.lovephone-app.zip
├─ manifest.json
├─ app.html
├─ styles/app.css
└─ scripts/app.js
```

## manifest.json

```json
{
  "format": "lovephone-app",
  "formatVersion": 1,
  "id": "my-companion-tool",
  "name": "我的小工具",
  "version": "1.0.0",
  "description": "一句简短说明",
  "icon": "assets/icon.png",
  "entry": "app.html",
  "pages": ["app.html", "pages/about.html"],
  "styles": ["styles/app.css"],
  "scripts": ["scripts/app.js"],
  "permissions": ["storage", "character.read", "ai.chat"],
  "networkOrigins": ["https://api.example.com"]
}
```

`id` 一旦发布后不要改；相同 ID 再导入会作为更新，且保留该 App 的本地数据。路径只能引用包内文件。安装包不能引用远程脚本、远程样式或远程图片。

## LovePhone API

```js
await LovePhone.storage.set('theme', { color: '#7fb59a' });
const theme = await LovePhone.storage.get('theme');
const character = await LovePhone.data.read('character');
const messages = await LovePhone.data.read('chat');
const memories = await LovePhone.data.read('memory');
const diaryEntries = await LovePhone.data.read('diary');
const answer = await LovePhone.ai.chat('根据角色资料写一句问候', {
  system: '你是一个温柔的陪伴助手。'
});
await LovePhone.openApp('chat');
await LovePhone.navigate('pages/about.html');
await LovePhone.notification('今天也要好好照顾自己。');
const result = await LovePhone.network.fetch('https://api.example.com/hello');
```

可申请权限：`storage`、`character.read`、`chat.read`、`memory.read`、`diary.read`、`media.read`、`notifications`、`network`、`ai.chat`、`system.openApp`、`desktop`。

`LovePhone.ai.chat` 使用用户已经在 LovePhone「设置」中连接的全局 AI 服务商和模型。自定义 App 永远拿不到 API Key，也不能把 Key 写入安装包；用户只需要在手机设置完成一次连接即可。调用会消耗用户自己的模型额度，因此必须在 `manifest.json` 中声明 `ai.chat` 并由用户在安装时确认。

网络请求必须使用 `LovePhone.network.fetch`，且目标 HTTPS 域名必须写入 `networkOrigins` 并在安装时获用户授权。目标服务仍需自行允许浏览器跨域请求。AI Key、登录 Cookie 和本地音频不应写进安装包。

## 权限与安全边界

安装页会把权限和联网域名逐项展示给用户。请只声明真正需要的最小权限，并在 App 自己的界面中说明这些数据会怎样使用。不要把角色资料、聊天记录、记忆或日记内容发送到未在 `networkOrigins` 中声明的服务。

自定义 App 运行在沙箱中：不能直接访问父页面、浏览器内的 AI Key、网易云登录 Cookie，或其他 App 的私有存储。`storage` 也仅属于当前 App ID。任何未声明或被用户撤销的权限调用都会返回中文错误；不要尝试通过 `iframe`、远程脚本或动态加载外部资源绕过限制，这类包会被拒绝导入或按安全问题处理。

使用 `ai.chat` 时，只有请求文本和可选系统提示会交给 LovePhone 的 AI 网关，App 代码不会获得 API Key。请把调用时机做得清楚、可预期，避免在后台无提示地消耗用户模型额度。

## 导出

“下载本地 HTML 小手机”会包含已安装的 App 包和素材。首次打开导出成品时会恢复 App；每个成品仍拥有自己的 IndexedDB 数据空间。
