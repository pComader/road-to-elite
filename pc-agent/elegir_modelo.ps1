# Road To Elite · elige y descarga el mejor modelo GRATUITO de Ollama que tu PC puede mover
# Solo descarga el modelo con «ollama pull» (gratis) si respondes S. No borra los modelos que ya tienes.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
$cfgPath = Join-Path (Join-Path $env:APPDATA 'RoadToElite') 'config.json'
Write-Host ''
Write-Host ' ROAD TO ELITE · mejor modelo gratuito para Ollama' -ForegroundColor Magenta
Write-Host ' --------------------------------------------------'
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { Write-Host ' No encuentro Ollama. Instálalo desde ollama.com y vuelve a ejecutar esto.' -ForegroundColor Red; exit 1 }

# --- hardware ---
$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
$vramGB = 0; $gpu = ''
try {
  $smi = & nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits 2>$null
  if ($smi) { $l = ($smi | Select-Object -First 1).Split(','); $gpu = $l[0].Trim(); $vramGB = [math]::Round([double]$l[1].Trim() / 1024) }
} catch { }
if (-not $gpu) { $v = Get-CimInstance Win32_VideoController | Select-Object -First 1; $gpu = $v.Name + ' (sin NVIDIA: irá por CPU/RAM, más lento)' }
Write-Host (" Gráfica: $gpu" + $(if ($vramGB) { " · $vramGB GB de VRAM" } else { '' }))
Write-Host " Memoria RAM: $ramGB GB"

# --- elección: el más capaz que cabe entero en la gráfica (o en la RAM si no hay NVIDIA) ---
# qwen3 = mejor relación calidad/tamaño en español y extracción estructurada; gemma3:27b si sobra VRAM.
if     ($vramGB -ge 20) { $m = 'gemma3:27b'; $gb = 17 }
elseif ($vramGB -ge 12) { $m = 'qwen3:14b';  $gb = 9.3 }
elseif ($vramGB -ge 8)  { $m = 'qwen3:8b';   $gb = 5.2 }
elseif ($vramGB -ge 5)  { $m = 'qwen3:4b';   $gb = 2.6 }
elseif ($ramGB -ge 32)  { $m = 'qwen3:8b';   $gb = 5.2 }
elseif ($ramGB -ge 16)  { $m = 'qwen3:4b';   $gb = 2.6 }
else                    { $m = 'qwen3:1.7b'; $gb = 1.4 }
$ya = (& ollama list) -join "`n"
Write-Host ''
Write-Host " Modelo recomendado: $m (descarga ≈ $gb GB, gratis)" -ForegroundColor Green
Write-Host ' Modelos que ya tienes:'; Write-Host $ya
if ($ya -match [regex]::Escape($m)) { Write-Host " Ya lo tienes descargado." }
else {
  $r = Read-Host " ¿Descargo $m ahora? (S/N)"
  if ($r -notmatch '^[sS]') { Write-Host ' No se ha descargado nada.'; exit 0 }
  & ollama pull $m
  if ($LASTEXITCODE -ne 0) { Write-Host ' La descarga ha fallado.' -ForegroundColor Red; exit 1 }
}
# --- el agente pasa a usarlo ---
if (Test-Path $cfgPath) {
  $cfg = [IO.File]::ReadAllText($cfgPath, $utf8) | ConvertFrom-Json
  $cfg.ollama_modelo = $m
  [IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json), $utf8)
  Write-Host " Listo: el agente usará $m desde la próxima hora." -ForegroundColor Green
} else { Write-Host ' Aún no has instalado el agente (instalar.bat): cuando lo hagas, pon este modelo en ollama_modelo.' }
Write-Host ' El modelo antiguo no se borra; si quieres liberar espacio: ollama rm <nombre>.'
