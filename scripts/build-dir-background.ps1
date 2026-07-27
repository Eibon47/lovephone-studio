$ErrorActionPreference = 'Continue'
$release = Join-Path (Get-Location) 'release'
$output = Join-Path $release 'directory-build.out.log'
$exitFile = Join-Path $release 'directory-build.exit'

Remove-Item -LiteralPath $output, $exitFile -Force -ErrorAction SilentlyContinue
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npm run desktop:dir *> $output
$code = $LASTEXITCODE
Set-Content -LiteralPath $exitFile -Value $code -Encoding ascii
exit $code
