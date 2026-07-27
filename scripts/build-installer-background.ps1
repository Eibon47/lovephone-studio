$ErrorActionPreference = 'Continue'
$release = Join-Path (Get-Location) 'release'
$output = Join-Path $release 'installer-build.out.log'
$exitFile = Join-Path $release 'installer-build.exit'

Remove-Item -LiteralPath $output, $exitFile -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npm run desktop:installer *> $output
$code = $LASTEXITCODE
Set-Content -LiteralPath $exitFile -Value $code -Encoding ascii
exit $code
