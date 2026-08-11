# GitHub 仓库公开设置

下面几项属于 GitHub 网站设置，不能仅靠提交代码自动开启。首次公开仓库前，请在 `NingzeXu/lovephone-studio` 逐项完成。

## 建议 Topics

在仓库首页右上角齿轮的 About 区域添加：

`ai`、`companion`、`diy`、`pwa`、`electron`、`frontend`、`custom-apps`

## 建议保护 `main`

进入 `Settings → Branches → Add branch protection rule`，规则填 `main`，至少勾选：

- Require a pull request before merging
- Require status checks to pass before merging，选择 `CI / test-and-build`
- Do not allow bypassing the above settings（若个人开发流程需要直接推送，可暂时不勾）

## 安全与自动化

进入 `Settings → Code security and analysis`：

- 启用 Security Advisories / Private vulnerability reporting。
- 确认 Dependabot alerts 与 Dependabot security updates 已启用。

推送本次提交后，进入 `Actions`，确认 `CI` 的 `test-and-build` 为绿色。若失败，不要直接公开仓库；先查看日志并修复。
