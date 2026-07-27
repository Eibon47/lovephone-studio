$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$plainText = [Console]::In.ReadToEnd()
$plainBytes = [System.Text.Encoding]::UTF8.GetBytes($plainText)
$protectedBytes = [System.Security.Cryptography.ProtectedData]::Protect(
  $plainBytes,
  $null,
  [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([Convert]::ToBase64String($protectedBytes))
