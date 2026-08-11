# GitHub 发布前检查

这份清单适用于把 LovePhone Studio 推送到 GitHub。建议第一次发布时把仓库保持为私有，确认没有问题后再决定是否公开。

## 1. 先确认不该上传的内容

以下文件不能提交：

- `.env`、`.env.local`、任何 API Key、Cookie、账号信息或测试截图中的隐私内容
- `node_modules/`、`dist/`、`release/`、日志、临时文件和本机数据库
- Windows 代码签名证书，例如 `.pfx`、`.p12`、`.pem`、`.key`

项目的 `.gitignore` 已经覆盖这些常见文件。提交前仍要执行：

```powershell
git status --short
git diff --check
```

如果意外提交过真实密钥，不要只删除文件：先立刻在服务商后台撤销密钥，再联系维护者清理 Git 历史。

## 2. 发布前验证

在项目根目录运行：

```powershell
npm ci
npm test
npm run web:build
npm audit --omit=dev --registry=https://registry.npmjs.org
```

这三项都通过后，再人工检查：

- 编辑器 `http://127.0.0.1:5177/` 能打开、保存、导入和导出配置。
- 成品模式 `http://127.0.0.1:5177/?mode=phone` 能进入桌面、角色、聊天、设置和已启用的 App。
- AI 在本机模式下可连接一个你自己的测试模型；不要把 Key 写进配置 JSON。
- 上传图片、主题包导入导出、备份恢复各至少试一次。
- 导入示例自定义 App，检查桌面显示、权限拒绝/收回、禁用、卸载和“下载本地 HTML”后的恢复。
- 检查自定义 App 安装页展示的权限和联网域名；不要把不可信第三方 App 作为官方示例发布。
- 手机局域网预览只用于界面测试；AI 真机测试应在 Netlify HTTPS 部署后进行。

## 3. 检查 GitHub 仓库设置

- 仓库地址：`https://github.com/NingzeXu/lovephone-studio`
- 确认仓库可见性。私有仓库只有你和被邀请的协作者可见；公开仓库任何人都能看到源代码和提交历史。
- 保留 `LICENSE`、`SECURITY.md`、`CONTRIBUTING.md`、`CODE_OF_CONDUCT.md`、`SUPPORT.md`、`CHANGELOG.md`、`docs/PRIVACY.md`。
- 不要把用户聊天记录、角色设定、导出的个人配置或音频文件当作示例提交。
- 在 GitHub 的 Settings -> Code and automation -> Branches 中为 `main` 添加分支保护：要求 Pull Request 和 CI 检查通过后才允许合并。
- 在 GitHub 的 Settings -> Security -> Code security and analysis 中启用 Private vulnerability reporting / Security Advisories。
- 检查 Actions 页面中的 `CI` 首次运行是否为绿色；确认 Dependabot 已启用。

## 4. 建议的首次提交命令

先浏览将要提交的内容：

```powershell
git status
git diff --stat
git diff --check
```

确认无误后：

```powershell
git add .
git commit -m "feat: prepare Netlify web release"
git push origin main
```

推送完成后，在 GitHub 仓库的 Actions（如果后续配置 CI）和 Netlify 的 Deploys 页面检查构建结果。

## 当前检查记录

本次准备时已确认：

- `.gitignore` 忽略依赖、构建产物、密钥证书、环境变量和本地数据。
- 已跟踪文件中未发现真实 API Key、GitHub Token 或私钥；测试中的 `sk-test-secret-value` 是固定测试字符串，不是真实密钥。
- 已跟踪的最大文件约为 2 MB，低于 GitHub 单文件 100 MB 限制。
- 当前工作区包含尚未提交的产品更新；推送前应由你确认这批改动一起发布。
