# 第三方软件与发布提醒

LovePhone OS 桌面测试包包含或使用以下第三方软件：

- Electron，MIT License
- `@music163/ncm-cli` 0.1.6 运行文件，MIT License。项目在
  `vendor/ncm-cli-package` 中保留官方发布的 `dist/index.js`，并移除了官方包中
  未被运行文件加载的旧 `build` 构建依赖；CLI 功能和其余运行依赖保持不变。
- mpv 及其 FFmpeg 等依赖。mpv 默认采用 GPLv2-or-later；只有以 `-Dgpl=false` 构建时才采用 LGPLv2.1-or-later。

当前 `vendor/mpv` 来自本机安装的 mpv 测试构建，仅用于本地功能验证。公开分发安装包之前，必须确认该二进制的准确构建选项，并按对应 GPL/LGPL 及其依赖许可证提供许可证文本、版权声明和所要求的对应源代码或替换机制。

网易云音乐的歌曲、封面、歌词、账号数据及接口能力不因使用官方 CLI 而自动获得商业分发授权。公开上线前必须由产品方确认网易云音乐服务协议、内容展示、播放和商业使用权限。

参考：

- https://www.electronjs.org/docs/latest/tutorial/security
- https://github.com/mpv-player/mpv
- https://www.npmjs.com/package/@music163/ncm-cli

## fflate

- Version: 0.8.2
- License: MIT
- Source: https://github.com/101arrowz/fflate
- Usage: local ZIP import and export for offline LovePhone theme packages

The full license text is included at `assets/vendor/fflate/LICENSE`.
