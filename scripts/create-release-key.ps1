# One-time: creates the owner's release signing key (keystore) in Documents\Smritikosh-license.
# The password is typed into a Windows box, handed to keytool through an environment variable for this run only,
# and never saved anywhere.   Run: pnpm apk:create-key
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'password-dialog.ps1')

$folder = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Smritikosh-license'
$keystore = Join-Path $folder 'smritikosh-release.jks'
if (Test-Path $keystore) {
    Write-Host "A release key already exists at $keystore. Nothing was changed." -ForegroundColor Yellow
    Write-Host 'Replacing it would stop installed phones from accepting updates.'
    exit 1
}
New-Item -ItemType Directory -Force $folder | Out-Null

$keytool = (Get-Command keytool -ErrorAction SilentlyContinue).Source
if (-not $keytool -and $env:JAVA_HOME) { $keytool = Join-Path $env:JAVA_HOME 'bin\keytool.exe' }
if (-not $keytool) { Write-Host 'keytool (part of Java) was not found.' -ForegroundColor Red; exit 1 }

Write-Host 'A password box is open on your screen. Type the release key password there.' -ForegroundColor Cyan
while ($true) {
    $first = Read-PasswordDialog 'Smritikosh release key' 'Choose a password for the Smritikosh release key (at least 8 characters). Write it down: you need it for every release build. It is never saved.'
    if ($null -eq $first) { Write-Host 'Cancelled. No key was created.' -ForegroundColor Yellow; exit 1 }
    if ($first.Length -lt 8) { Write-Host 'The password must be at least 8 characters. Try again.' -ForegroundColor Yellow; continue }
    $second = Read-PasswordDialog 'Smritikosh release key' 'Type the same password again to confirm.'
    if ($null -eq $second) { Write-Host 'Cancelled. No key was created.' -ForegroundColor Yellow; exit 1 }
    if ($first -ne $second) { Write-Host 'The two passwords did not match. Try again.' -ForegroundColor Yellow; continue }
    break
}

try {
    $env:SMRITIKOSH_KS_PW = $first
    & $keytool -genkeypair -storetype PKCS12 -keystore $keystore -alias smritikosh -keyalg RSA -keysize 2048 -validity 10000 `
        -dname 'CN=Smritikosh, O=Smritikosh, C=IN' -storepass:env SMRITIKOSH_KS_PW -keypass:env SMRITIKOSH_KS_PW
    $code = $LASTEXITCODE
} finally {
    Remove-Item Env:SMRITIKOSH_KS_PW -ErrorAction SilentlyContinue
    $first = $null; $second = $null
}
if ($code -ne 0 -or -not (Test-Path $keystore)) {
    Write-Host 'The key was not created.' -ForegroundColor Red
    exit 1
}
Write-Host ''
Write-Host "Release key created: $keystore" -ForegroundColor Green
Write-Host 'Back this file up together with smritikosh-private-key.json (USB drive or your own cloud).'
