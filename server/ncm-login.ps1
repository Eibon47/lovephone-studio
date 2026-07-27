param(
  [Parameter(Mandatory = $true)]
  [string]$NodePath,
  [Parameter(Mandatory = $true)]
  [string]$CliPath
)

$Host.UI.RawUI.WindowTitle = 'LovePhone - 网易云音乐登录'
Write-Host ''
Write-Host '请使用网易云音乐 App 扫描下面的二维码完成登录。' -ForegroundColor Cyan
Write-Host '登录信息只由网易云官方 CLI 保存在本机。' -ForegroundColor DarkGray
Write-Host ''

& $NodePath $CliPath login

Write-Host ''
if ($LASTEXITCODE -eq 0) {
  Write-Host '登录流程已结束，可以返回 LovePhone 点击“测试音乐连接”。' -ForegroundColor Green
} else {
  Write-Host '登录没有完成，请检查上面的提示后重试。' -ForegroundColor Yellow
}
Read-Host '按 Enter 关闭窗口'
