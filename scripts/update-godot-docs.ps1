$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$vendorRoot = Join-Path $workspaceRoot "vendor"
$repoRoot = Join-Path $vendorRoot "godot-docs"
$repoUrl = "https://github.com/godotengine/godot-docs.git"
$branch = "stable"

if (-not (Test-Path $vendorRoot)) {
    New-Item -ItemType Directory -Path $vendorRoot | Out-Null
}

if (-not (Test-Path $repoRoot)) {
    git clone --depth 1 --branch $branch $repoUrl $repoRoot
} else {
    git -C $repoRoot fetch --depth 1 origin $branch
    git -C $repoRoot reset --hard origin/$branch
}

$commit = git -C $repoRoot rev-parse HEAD
$date = git -C $repoRoot log -1 --format=%cI

Write-Host "Godot-Doku aktualisiert."
Write-Host "Pfad: $repoRoot"
Write-Host "Branch: $branch"
Write-Host "Commit: $commit"
Write-Host "Datum: $date"
