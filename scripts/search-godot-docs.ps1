param(
    [Parameter(Mandatory = $true)]
    [string]$Query,
    [ValidateSet("all", "root", "about", "community", "engine_details", "getting_started", "tutorials", "classes", "readme")]
    [string]$Section = "all"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Join-Path $workspaceRoot "vendor\\godot-docs"

if (-not (Test-Path $repoRoot)) {
    throw "Repo nicht gefunden: $repoRoot. Zuerst scripts/update-godot-docs.ps1 ausfuehren."
}

$targets = switch ($Section) {
    "root" { @("$repoRoot\\index.rst") }
    "about" { @("$repoRoot\\about") }
    "community" { @("$repoRoot\\community") }
    "engine_details" { @("$repoRoot\\engine_details") }
    "getting_started" { @("$repoRoot\\getting_started") }
    "tutorials" { @("$repoRoot\\tutorials") }
    "classes" { @("$repoRoot\\classes") }
    "readme" { @("$repoRoot\\README.md") }
    default {
        @(
            "$repoRoot\\index.rst",
            "$repoRoot\\README.md",
            "$repoRoot\\about",
            "$repoRoot\\community",
            "$repoRoot\\engine_details",
            "$repoRoot\\getting_started",
            "$repoRoot\\tutorials",
            "$repoRoot\\classes"
        )
    }
}

if (Get-Command rg -ErrorAction SilentlyContinue) {
    rg --line-number --ignore-case --fixed-strings $Query $targets
} else {
    $files = foreach ($target in $targets) {
        if (Test-Path $target -PathType Container) {
            Get-ChildItem -Path $target -Recurse -File -Include *.rst,*.md
        } else {
            Get-Item $target
        }
    }
    $files | Select-String -Pattern $Query -SimpleMatch -CaseSensitive:$false
}
