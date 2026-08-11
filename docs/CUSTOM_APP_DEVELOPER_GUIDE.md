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
  "permissions": ["storage", "character.read"],
  "networkOrigins": ["https://api.example.com"]
}
```

`id` 一旦发布后不要改；相同 ID 再导入会作为更新，且保留该 App 的本地数据。路径只能引用包内文件。安装包不能引用远程脚本、远程样式或远程图片。

## LovePhone API

```js
await LovePhone.storage.set('theme', { color: '#7fb59a' });
const theme = await LovePhone.storage.get('theme');
const character = await LovePhone.data.read('character');
await LovePhone.openApp('chat');
await LovePhone.navigate('pages/about.html');
await LovePhone.notification('今天也要好好照顾自己。');
const result = await LovePhone.network.fetch('https://api.example.com/hello');
```

可申请权限：`storage`、`character.read`、`chat.read`、`memory.read`、`diary.read`、`media.read`、`notifications`、`network`、`system.openApp`、`desktop`。

网络请求必须使用 `LovePhone.network.fetch`，且目标 HTTPS 域名必须写入 `networkOrigins` 并在安装时获用户授权。目标服务仍需自行允许浏览器跨域请求。AI Key、登录 Cookie 和本地音频不应写进安装包。

## 导出

“下载本地 HTML 小手机”会包含已安装的 App 包和素材。首次打开导出成品时会恢复 App；每个成品仍拥有自己的 IndexedDB 数据空间。
