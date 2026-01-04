[CmdletBinding()]
param(
  [int]$Port = 18080,
  [switch]$Reload,
  [string]$BindHost = "127.0.0.1",
  [string]$LogLevel = "info",
  [switch]$KillExisting
)

$ErrorActionPreference = "Stop"

# repo root is one level above /scripts
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$apiDir   = Join-Path $repoRoot "services\api"
$py       = Join-Path $apiDir ".venv\Scripts\python.exe"

if (!(Test-Path $py)) {
  throw "Venv python not found at: $py. Create venv in services/api/.venv first."
}

if ($KillExisting) {
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen |
      Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($pid in $pids) {
      if ($pid) {
        Write-Host "[dev_api] Stopping PID $pid on port $Port"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {
    # ignore if nothing is listening / cmdlet not available
  }
}

$uvicornArgs = @(
  "-m", "uvicorn",
  "app.main:app",
  "--host", $BindHost,
  "--port", "$Port",
  "--log-level", $LogLevel
)

if ($Reload) {
  $uvicornArgs += @("--reload", "--reload-dir", (Join-Path $apiDir "app"))
}

Write-Host "[dev_api] Starting API on http://$BindHost`:$Port (reload=$Reload)"
Push-Location $apiDir
try {
  & $py @uvicornArgs
} finally {
  Pop-Location
}
