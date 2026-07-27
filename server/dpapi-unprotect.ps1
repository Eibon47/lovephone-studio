$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$cipherText = [Console]::In.ReadToEnd().Trim()
$protectedBytes = [Convert]::FromBase64String($cipherText)
$plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $protectedBytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([System.Text.Encoding]::UTF8.GetString($plainBytes))
