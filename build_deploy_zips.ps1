Add-Type -AssemblyName "System.IO.Compression.FileSystem"

$rootDir = "E:\Project\inventory-app"
$frontendDist = "$rootDir\frontend\dist"
$frontendZip = "$rootDir\frontend-deploy.zip"

$backendSrc = "$rootDir\backend"
$backendStaging = "$rootDir\backend-deploy-staging"
$backendZip = "$rootDir\backend-deploy.zip"

Write-Host "--- 1. Packaging Frontend Deploy Zip ---"
if (Test-Path $frontendZip) {
    Remove-Item -Force $frontendZip
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($frontendDist, $frontendZip)
Write-Host "Frontend zip created at: $frontendZip"

Write-Host "--- 2. Staging Backend Files ---"
if (Test-Path $backendStaging) {
    Remove-Item -Recurse -Force $backendStaging
}
New-Item -ItemType Directory -Path $backendStaging | Out-Null

Copy-Item -Recurse "$backendSrc\src" "$backendStaging\src"
Copy-Item -Recurse "$backendSrc\scripts" "$backendStaging\scripts"
Copy-Item -Recurse "$rootDir\database" "$backendStaging\database"
Copy-Item "$backendSrc\app.js" "$backendStaging\app.js"
Copy-Item "$backendSrc\package.json" "$backendStaging\package.json"
Copy-Item "$backendSrc\package-lock.json" "$backendStaging\package-lock.json"
Copy-Item "$backendSrc\.env.example" "$backendStaging\.env.example"

Write-Host "--- 3. Packaging Backend Deploy Zip ---"
if (Test-Path $backendZip) {
    Remove-Item -Force $backendZip
}
[System.IO.Compression.ZipFile]::CreateFromDirectory($backendStaging, $backendZip)
Write-Host "Backend zip created at: $backendZip"

Remove-Item -Recurse -Force $backendStaging
Write-Host "Cleaned up staging directory."

Write-Host "--- 4. Summary of Output Files ---"
Get-Item $backendZip, $frontendZip | Select-Object Name, Length, LastWriteTime

