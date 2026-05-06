# Install maestro-flow skill into a Claude Code project
param(
    [string]$Project = "."
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SkillSource = Join-Path $ScriptDir "maestro-flow"
$TargetDir = Resolve-Path $Project
$SkillTarget = Join-Path $TargetDir ".claude\skills\maestro-flow"

Write-Host "Installing Maestro Flow..."
Write-Host "  Source: $SkillSource"
Write-Host "  Target: $SkillTarget"
Write-Host ""

# Check source exists
if (-not (Test-Path (Join-Path $SkillSource "SKILL.md"))) {
    Write-Error "SKILL.md not found in $SkillSource"
    exit 1
}

# Check Python
try {
    python --version | Out-Null
} catch {
    Write-Warning "Python not found. flow_cli.py will not work."
}

# Create target and copy
if (-not (Test-Path $SkillTarget)) {
    New-Item -ItemType Directory -Path $SkillTarget -Force | Out-Null
}

Copy-Item -Path "$SkillSource\*" -Destination $SkillTarget -Recurse -Force

# Verify
$CommandCount = (Get-ChildItem -Path (Join-Path $SkillTarget "commands") -Filter "*.md" -Recurse).Count

Write-Host ""
Write-Host "Installation complete!"
Write-Host "  Commands: $CommandCount"
Write-Host "  Entry:    /maestro-flow"
Write-Host ""
Write-Host "Usage:"
Write-Host "  /maestro-flow `"your intent`"     # Intent-based routing"
Write-Host "  /maestro-flow list               # List commands"
Write-Host "  /maestro-flow --chain quick-fix  # Direct chain"
