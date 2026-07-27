param(
  [string]$Source = 'C:\Program Files\MPV Player'
)

$projectRoot = Split-Path $PSScriptRoot -Parent
$destination = Join-Path $projectRoot 'vendor\mpv'
$requiredFiles = @('mpv.exe', 'd3dcompiler_43.dll')

New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach ($name in $requiredFiles) {
  $sourceFile = Join-Path $Source $name
  if (-not (Test-Path -LiteralPath $sourceFile)) {
    throw "缺少 MPV 文件：$sourceFile"
  }
  Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $destination $name) -Force
}

Write-Host "MPV 资源已准备到：$destination"
