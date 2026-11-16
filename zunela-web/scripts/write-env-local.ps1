# Escribe zunela-web/.env.local para el piloto Supabase (no se versiona).
# Uso:
#   .\scripts\write-env-local.ps1 -Url "https://xxxx.supabase.co" -AnonKey "eyJ..."
# O con variables de entorno:
#   $env:NEXT_PUBLIC_SUPABASE_URL = "..."
#   $env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "..."
#   .\scripts\write-env-local.ps1

param(
  [string]$Url = $env:NEXT_PUBLIC_SUPABASE_URL,
  [string]$AnonKey = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
)

$ErrorActionPreference = "Stop"
$webRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $webRoot ".env.local"

if (-not $Url -or -not $AnonKey) {
  Write-Error "Faltan URL o anon key. Pasa -Url/-AnonKey o define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY."
}

if ($Url -notmatch '^https?://') {
  Write-Error "La URL debe empezar por http:// o https://"
}

$content = @"
NEXT_PUBLIC_ZUNELA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=$Url
NEXT_PUBLIC_SUPABASE_ANON_KEY=$AnonKey
"@

Set-Content -Path $target -Value $content -Encoding utf8
Write-Host "Escrito $target"
Write-Host "Reinicia npm run dev. No commits de .env.local."
