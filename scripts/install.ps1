# FCWM installer and renderer for Windows (PowerShell 5.1 or 7). One line, run from any folder:
#
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/FrameCoreWorks/FCWM/main/scripts/install.ps1))) '<film folder>' [--cloud]
#
# 1. Checks Node.js 22+ (installs it with winget when missing).
# 2. Downloads FCWM into $HOME\.fcwm\app, or updates it when a newer version is out (FCWM_HOME moves it).
# 3. Hands over to `fcwm run`, which installs only the tools this film still lacks and renders it
#    into '<film folder>\render\'. With --cloud it renders on the user's own GitHub account instead.
#
# Everything already installed is detected and skipped.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Ref = if ($env:FCWM_REF) { $env:FCWM_REF } else { 'main' }
$Repo = 'FrameCoreWorks/FCWM'
$HomeDir = if ($env:FCWM_HOME) { $env:FCWM_HOME } else { Join-Path $HOME '.fcwm' }
$App = Join-Path $HomeDir 'app'

function Say($m) { Write-Host "fcwm: $m" }
if ($args.Count -lt 1) { throw "usage: install.ps1 '<film folder>' [--cloud]" }

function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Node-Major {
  try { [int](& node -p 'process.versions.node.split(".")[0]') } catch { 0 }
}

# --- Node.js 22+ ---------------------------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or (Node-Major) -lt 22) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Node.js 22+ is missing and winget is not available. Install Node.js 22 from https://nodejs.org, then run the same command again.'
  }
  Say 'installing Node.js LTS with winget'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  Refresh-Path
  if ((Node-Major) -lt 22) { throw 'Node.js was installed but this window cannot see it yet. Open a new PowerShell window and run the same command again.' }
} else {
  Say "already installed, skipping: Node.js $(node -v)"
}

# --- FCWM itself ---------------------------------------------------------------------------
# FCWM_SRC=<local FCWM folder> installs from that folder instead of GitHub (tests, offline machines).
$Src = $env:FCWM_SRC
$Want = ''
if ($Src) { $Want = (Get-Content (Join-Path $Src 'package.json') -Raw | ConvertFrom-Json).version }
else { try { $Want = (Invoke-RestMethod "https://raw.githubusercontent.com/$Repo/$Ref/package.json").version } catch { } }
$Have = ''
$Pkg = Join-Path $App 'package.json'
if (Test-Path $Pkg) { $Have = (Get-Content $Pkg -Raw | ConvertFrom-Json).version }

if ($Have -and (-not $Want -or $Want -eq $Have) -and (Test-Path (Join-Path $App 'node_modules'))) {
  Say "already installed, skipping: FCWM $Have ($App)"
} else {
  $Label = if ($Want) { $Want } else { $Ref }
  Say "downloading FCWM $Label into $App"
  New-Item -ItemType Directory -Force -Path $HomeDir | Out-Null
  $Tmp = Join-Path $HomeDir ('download-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $Tmp | Out-Null
  try {
    $Unpacked = Join-Path $Tmp 'fcwm'
    if ($Src) {
      New-Item -ItemType Directory -Path $Unpacked | Out-Null
      Get-ChildItem $Src -Force | Where-Object { $_.Name -notin @('node_modules', '.git') } | Copy-Item -Destination $Unpacked -Recurse -Force
    } else {
      $Zip = Join-Path $Tmp 'fcwm.zip'
      Invoke-WebRequest "https://github.com/$Repo/archive/$Ref.zip" -OutFile $Zip -UseBasicParsing
      Expand-Archive $Zip -DestinationPath (Join-Path $Tmp 'zip')
      Move-Item (Get-ChildItem (Join-Path $Tmp 'zip') -Directory | Select-Object -First 1).FullName $Unpacked
    }
    Push-Location $Unpacked
    # npm.cmd, not npm: the npm.ps1 shim is blocked by the default execution policy on Windows
    try { npm.cmd ci --no-audit --no-fund --loglevel=error; if ($LASTEXITCODE) { throw "npm ci failed ($LASTEXITCODE)" } } finally { Pop-Location }
    if (Test-Path $App) { Remove-Item $App -Recurse -Force }
    Move-Item $Unpacked $App
  } finally {
    Remove-Item $Tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

# No `exit` here: this runs inside the user's own PowerShell window, which `exit` would close.
& node (Join-Path $App 'scripts\fcwm.mjs') run --full @args
if ($LASTEXITCODE) { Write-Host "fcwm: finished with exit code $LASTEXITCODE" }
