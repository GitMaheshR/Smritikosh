# Builds the signed release APK. Asks for the release key password in a Windows box; it is only kept in memory
# for this build and never written to disk.   Run: pnpm apk:release   (add -NoSample to leave out the sample data)
param([switch]$NoSample)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'password-dialog.ps1')

$root = Split-Path $PSScriptRoot -Parent
$folder = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Smritikosh-license'
$keystore = Join-Path $folder 'smritikosh-release.jks'
if (-not (Test-Path $keystore)) {
    Write-Host "No release key found at $keystore. Create it first: pnpm apk:create-key" -ForegroundColor Red
    exit 1
}

Write-Host 'A password box is open on your screen. Type the release key password there.' -ForegroundColor Cyan
$password = Read-PasswordDialog 'Smritikosh release build' 'Enter the Smritikosh release key password to sign the app. It is used for this build only and never saved.'
if ($null -eq $password) { Write-Host 'Cancelled.' -ForegroundColor Yellow; exit 1 }

try {
    $env:SMRITIKOSH_KEYSTORE = $keystore
    $env:SMRITIKOSH_KEYSTORE_PASSWORD = $password
    # The sample data is built into the app and loaded once, on first launch.
    if ($NoSample) { Remove-Item Env:VITE_SEED_SAMPLE -ErrorAction SilentlyContinue } else { $env:VITE_SEED_SAMPLE = '1' }

    Push-Location $root
    pnpm sync:mobile
    if ($LASTEXITCODE -ne 0) { throw 'Web build or sync failed.' }
    Push-Location (Join-Path $root 'apps\mobile\android')
    .\gradlew.bat assembleRelease --console=plain
    $code = $LASTEXITCODE
    Pop-Location
    Pop-Location
    if ($code -ne 0) { throw 'Android release build failed (wrong password?).' }
} finally {
    Remove-Item Env:SMRITIKOSH_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:VITE_SEED_SAMPLE -ErrorAction SilentlyContinue
    $password = $null
}

$apk = Join-Path $root 'apps\mobile\android\app\build\outputs\apk\release\app-release.apk'
$copy = Join-Path (Split-Path $root -Parent) 'Smritikosh.apk'
Copy-Item $apk $copy -Force

# Show who signed it (the fingerprint the app checks against).
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$apksigner = Get-ChildItem (Join-Path $sdk 'build-tools') -Recurse -Filter 'apksigner.bat' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if ($apksigner) { & $apksigner.FullName verify --print-certs $apk | Select-String 'certificate SHA-256|Verified' }

Write-Host ''
Write-Host "Signed APK ready: $apk" -ForegroundColor Green
Write-Host "Copy:             $copy" -ForegroundColor Green
