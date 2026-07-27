param(
  [Parameter(Mandatory = $true)]
  [string]$HelperPath,
  [Parameter(Mandatory = $true)]
  [string]$NodePath,
  [Parameter(Mandatory = $true)]
  [string]$CliPath
)

$arguments = @(
  '-NoExit',
  '-NoLogo',
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', "`"$HelperPath`"",
  '-NodePath', "`"$NodePath`"",
  '-CliPath', "`"$CliPath`""
)

Start-Process -FilePath 'powershell.exe' `
  -ArgumentList $arguments `
  -WindowStyle Normal
