param(
  [string]$ApiBase = "http://127.0.0.1:18083",
  [int]$TimeoutSeconds = 60,
  [int]$PollSeconds = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[smoke] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[smoke] $msg" -ForegroundColor Yellow }

function Join-Url([string]$base, [string]$path) {
  if ($base.EndsWith("/")) { $base = $base.TrimEnd("/") }
  if (-not $path.StartsWith("/")) { $path = "/" + $path }
  return $base + $path
}

# 0) ensure API is reachable
Write-Info "Checking API: $ApiBase/openapi.json"
$open = Invoke-RestMethod -Uri (Join-Url $ApiBase "/openapi.json")
Write-Info "OK: API reachable."

# output folder
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $RepoRoot ("tmp/smoke_" + (Get-Date).ToString("yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Info "Output dir: $OutDir"

# 1) create workspace
$ws = Invoke-RestMethod -Method Post -Uri (Join-Url $ApiBase "/workspaces") `
  -ContentType "application/json" -Body '{"name":"SmokeDemo","retention_days":30}'
$wid = $ws.data.id
Write-Info "Workspace created: $wid"

# 2) start pipeline run
$runResp = Invoke-RestMethod -Method Post -Uri (Join-Url $ApiBase "/workspaces/$wid/pipeline/run") `
  -ContentType "application/json" -Body '{"mode":"draft"}'
$runId = $runResp.data.runId
Write-Info "Run started: $runId"

# 3) poll status
$start = Get-Date
while ($true) {
  $statusResp = Invoke-RestMethod -Uri (Join-Url $ApiBase "/workspaces/$wid/pipeline/status")
  $runStatus = $statusResp.data.status
  $stages = $statusResp.data.stages

  $stageLine = ($stages | ForEach-Object { "$($_.name)=$($_.status)" }) -join ", showin"
  Write-Info "status=$runStatus | $stageLine"

  if ($runStatus -in @("succeeded","failed","cancelled")) { break }

  if (((Get-Date) - $start).TotalSeconds -gt $TimeoutSeconds) {
    throw "Timeout waiting for run to finish after $TimeoutSeconds seconds."
  }
  Start-Sleep -Seconds $PollSeconds
}

if ($runStatus -ne "succeeded") {
  throw "Run ended with status: $runStatus"
}

Write-Info "Run succeeded."

# 4) list artifacts
$arts = Invoke-RestMethod -Uri (Join-Url $ApiBase "/workspaces/$wid/runs/$runId/artifacts")
Write-Info ("Artifacts: " + $arts.total)

$artsJson = Join-Path $OutDir "artifacts_list.json"
($arts | ConvertTo-Json -Depth 10) | Out-File -Encoding utf8 $artsJson
Write-Info "Saved: $artsJson"

# download first artifact (if any)
if ($arts.total -gt 0 -and $arts.items[0].id) {
  $a0 = $arts.items[0]
  $aUrl = Join-Url $ApiBase "/workspaces/$wid/runs/$runId/artifacts/$($a0.id)/download"
  $aOut = Join-Path $OutDir ("artifact_" + $a0.name)
  Write-Info "Downloading artifact: $aUrl"
  Invoke-WebRequest -Uri $aUrl -OutFile $aOut | Out-Null
  Write-Info "Saved: $aOut"
} else {
  Write-Warn "No artifact rows in DB (or no ids) to download."
}

# 5) list exports
$exports = Invoke-RestMethod -Uri (Join-Url $ApiBase "/workspaces/$wid/exports")
Write-Info ("Exports: " + $exports.total)

$expJson = Join-Path $OutDir "exports_list.json"
($exports | ConvertTo-Json -Depth 10) | Out-File -Encoding utf8 $expJson
Write-Info "Saved: $expJson"

# download all exports
foreach ($ex in $exports.items) {
  $exUrl = Join-Url $ApiBase "/workspaces/$wid/exports/$($ex.id)/download"
  $exOut = Join-Path $OutDir ("export_" + $ex.kind + "_" + $ex.id)
  Write-Info "Downloading export: $($ex.kind)"
  Invoke-WebRequest -Uri $exUrl -OutFile $exOut | Out-Null
  Write-Info "Saved: $exOut"
}

Write-Info "SMOKE TEST COMPLETE ✅"
