param(
  [int]$Port = 18083,
  [string]$Host = "127.0.0.1",
  [switch]$Reload,
  [switch]$NoKill
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[dev_api] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[dev_api] $msg" -ForegroundColor Yellow }

# repo root assumed: scripts/ is at repo root
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ApiDir   = Join-Path $RepoRoot "services/api"
$Py       = Join-Path $ApiDir ".venv/Scripts/python.exe"

if (!(Test-Path $Py)) {
  throw "Python venv not found at: $Py. Create venv under services/api/.venv first."
}

if (-not $NoKill) {
  Write-Info "Checking port $Port..."
  $pids = @()

  try {
    $pids += (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  } catch {}

  # Fallback via netstat parsing (sometimes more reliable)
  try {
    $net = (netstat -ano | Select-String ":$Port\s+.*LISTENING")
    foreach ($line in $net) {
      $parts = ($line -split "\s+") | Where-Object { $_ -ne "" }
      $pid = $parts[-1]
      if ($pid -match "^\d+$") { $pids += [int]$pid }
    }
  } catch {}

  $pids = $pids | Where-Object { $_ } | Sort-Object -Unique

  if ($pids.Count -gt 0) {
    Write-Warn "Port $Port is in use by PID(s): $($pids -join ', '). Attempting to stop..."
    foreach ($pid in $pids) {
      try {
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      } catch {}
    }
    Start-Sleep -Milliseconds 400
  } else {
    Write-Info "Port $Port appears free."
  }
}

$reloadArg = ""
if ($Reload) { $reloadArg = "--reload" }

Write-Info "Starting API: http://$Host`:$Port"
Write-Info "Working dir: $ApiDir"

# Start uvicorn in a NEW window so your current terminal stays usable
$argList = @(
  "-m", "uvicorn",
  "app.main:app",
  "--host", $Host,
  "--port", "$Port",
  "--log-level", "info"
)
if ($Reload) { $argList += "--reload" }

Start-Process -FilePath $Py -ArgumentList $argList -WorkingDirectory $ApiDir | Out-Null

# quick health check (best effort)
Start-Sleep -Milliseconds 700
try {
  $openapi = Invoke-RestMethod -Uri "http://$Host`:$Port/openapi.json" -TimeoutSec 2
  Write-Info "API is up. OpenAPI remember: http://$Host`:$Port/docs"
} catch {
  Write-Warn "Started process, but OpenAPI not reachable yet. If it takes a sec, just refresh /docs."
}
