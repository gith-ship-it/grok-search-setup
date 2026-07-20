# grok-search-setup - one-line installer (Windows PowerShell)
#
#   irm https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main/install.ps1 | iex
#
# Non-interactive:  $env:CPA_KEY='sk-xxx'; irm .../install.ps1 | iex
# Uninstall:        $env:GROK_UNINSTALL='1'; irm .../install.ps1 | iex
$ErrorActionPreference = 'Stop'

$repo = if ($env:GROK_SETUP_REPO) { $env:GROK_SETUP_REPO } else { 'https://raw.githubusercontent.com/gith-ship-it/grok-search-setup/main' }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js 18+ is required (grok-search-rs ships as a node-installed binary).'
  Write-Host 'Install it from https://nodejs.org  and re-run.'
  return
}

if (-not $env:GROK_UNINSTALL) {
  $key = $env:CPA_KEY
  if (-not $key) {
    $sec = Read-Host -AsSecureString 'Enter CLIProxyAPI key (sk-...)'
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    $key = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  if (-not $key) { Write-Host 'No CPA key provided.'; return }
  $env:GROK_CPA_KEY = $key
  if (-not $env:GROK_URL) {
    if ($env:CPA_URL) {
      $env:GROK_URL = $env:CPA_URL
    } else {
      $u = Read-Host 'Endpoint base URL - your CLIProxyAPI/proxy, e.g. https://your-host/v1 [default https://api.x.ai/v1]'
      $env:GROK_URL = if ($u) { $u } else { 'https://api.x.ai/v1' }
    }
  }
  if (-not $env:GROK_MODEL)   { $env:GROK_MODEL = 'grok-4.5' }
  if (-not $env:GROK_TIMEOUT) { $env:GROK_TIMEOUT = '150' }
  if (-not $env:GROK_X_SEARCH){ $env:GROK_X_SEARCH = 'true' }
}

$mjs = Join-Path ([System.IO.Path]::GetTempPath()) ('grok-configure-' + [System.Guid]::NewGuid().ToString('N') + '.mjs')
try {
  Invoke-RestMethod "$repo/configure.mjs" -OutFile $mjs
  node $mjs
} finally {
  Remove-Item $mjs -ErrorAction SilentlyContinue
}
