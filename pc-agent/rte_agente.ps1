# Road To Elite · agente del PC
# Lo lanza cada hora la tarea programada «RoadToElite\Agente» (instalar.bat). No instala nada: PowerShell de Windows + Ollama si está abierto.
#  1. Si en Drive hay un backup de los jueves más nuevo que el del PC, lo copia (zip + .md) a la carpeta de destino y se lo dice al servidor.
#  2. Si queda un aviso de backup (Drive o PC sin hacer), muestra una ventana (como mucho cada «aviso_cada_horas»).
#  3. Si Ollama está abierto, añade CONCEPTOS a unos pocos WODs de MOTOR · ANÁLISIS (Base_de_datos_WOD) (max_wods por hora; 0 = desactivado).
# El token vive en %APPDATA%\RoadToElite\config.json (fuera de las carpetas que ve Claude). El registro (sin secretos) va a agente.log.
param([switch]$Visible)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfgDir = Join-Path $env:APPDATA 'RoadToElite'
$cfgPath = Join-Path $cfgDir 'config.json'
$estPath = Join-Path $cfgDir 'estado.json'
$log = Join-Path $dir 'agente.log'
$utf8 = New-Object System.Text.UTF8Encoding $false

function Log([string]$m) {
  $l = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' · ' + $m
  if ($Visible) { Write-Host $l }
  try { [IO.File]::AppendAllText($log, $l + "`r`n", $utf8) } catch {}
}
function Aviso([string]$txt) {
  Add-Type -AssemblyName System.Windows.Forms
  $f = New-Object System.Windows.Forms.Form
  $f.TopMost = $true
  [void][System.Windows.Forms.MessageBox]::Show($f, $txt + "`r`n`r`nEl aviso desaparece solo cuando el backup está hecho.", 'Road To Elite · backup', 'OK', 'Warning')
  $f.Dispose()
}
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 1MB)) { Move-Item $log ($log + '.1') -Force }
if (-not (Test-Path $cfgPath)) { Log 'Falta config.json: ejecuta instalar.bat'; exit 1 }
$cfg = [IO.File]::ReadAllText($cfgPath, $utf8) | ConvertFrom-Json
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Api([hashtable]$cuerpo) {
  $cuerpo['agente'] = $cfg.token
  $bytes = $utf8.GetBytes(($cuerpo | ConvertTo-Json -Depth 5 -Compress))
  $r = Invoke-WebRequest -Uri $cfg.url -Method Post -Body $bytes -ContentType 'text/plain; charset=utf-8' -UseBasicParsing -TimeoutSec 300
  $j = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
  if (-not $j.ok) { throw ('servidor: ' + $j.error + ' ' + $j.detalle) }
  return $j
}
$estado = @{}
if (Test-Path $estPath) { try { $e0 = [IO.File]::ReadAllText($estPath, $utf8) | ConvertFrom-Json; $e0.PSObject.Properties | ForEach-Object { $estado[$_.Name] = $_.Value } } catch {} }

# ---------- 1 · Backup de los jueves ----------
$est = $null
try {
  $est = Api @{ action = 'agente_estado' }
  $destino = $cfg.destino
  if (-not (Test-Path $destino)) { New-Item -ItemType Directory -Force -Path $destino | Out-Null }
  if ($est.backup.drive -and ([string]$est.backup.drive -gt [string]$est.backup.pc)) {
    $info = Api @{ action = 'agente_backup' }
    $zip = Join-Path $destino $info.nombre
    if (-not (Test-Path $zip)) {
      $sb = New-Object System.Text.StringBuilder
      for ($i = 0; $i -lt [int]$info.partes; $i++) { $p = Api @{ action = 'agente_backup'; parte = $i }; [void]$sb.Append($p.datos) }
      $tmp = $zip + '.parcial'
      [IO.File]::WriteAllBytes($tmp, [Convert]::FromBase64String($sb.ToString()))
      Move-Item $tmp $zip -Force
    }
    if ($info.md) { [IO.File]::WriteAllText((Join-Path $destino $info.mdNombre), $info.md, $utf8) }
    $ok = Api @{ action = 'agente_backup_ok'; fecha = $info.fecha; ruta = $destino }
    Log ('Backup ' + $info.fecha + ' copiado en ' + $destino + ' (' + $info.kb + ' KB)')
    $est = Api @{ action = 'agente_estado' }
  } else { Log ('Backup al día (Drive ' + $est.backup.drive + ' · PC ' + $est.backup.pc + ')') }
} catch { Log ('Backup: ' + $_.Exception.Message) }

# ---------- 2 · Ventana de aviso ----------
try {
  $alerta = if ($est) { [string]$est.alerta } else { '' }
  if (-not $est -and (Get-Date).DayOfWeek -eq 'Thursday' -and (Get-Date).Hour -ge 16) { $alerta = 'No puedo hablar con el servidor de Road To Elite y es jueves: revisa la conexión (agente.log).' }
  $cada = if ($cfg.aviso_cada_horas) { [double]$cfg.aviso_cada_horas } else { 4 }
  $ultimo = if ($estado['aviso_hora']) { [datetime]::Parse($estado['aviso_hora']) } else { [datetime]::MinValue }
  if ($alerta -and (($estado['aviso_txt'] -ne $alerta) -or ((Get-Date) - $ultimo).TotalHours -ge $cada)) {
    $estado['aviso_txt'] = $alerta; $estado['aviso_hora'] = (Get-Date).ToString('o')
    [IO.File]::WriteAllText($estPath, ($estado | ConvertTo-Json), $utf8)
    Log ('Aviso mostrado: ' + $alerta)
    Aviso $alerta
  } elseif (-not $alerta -and $estado['aviso_txt']) { $estado.Remove('aviso_txt'); [IO.File]::WriteAllText($estPath, ($estado | ConvertTo-Json), $utf8) }
} catch { Log ('Aviso: ' + $_.Exception.Message) }

# ---------- 3 · Ollama: conceptos para MOTOR · ANÁLISIS (Base_de_datos_WOD) ----------
try {
  $max = if ($null -ne $cfg.max_wods) { [int]$cfg.max_wods } else { 3 }
  if ($max -gt 0) {
    $base = if ($cfg.ollama_url) { $cfg.ollama_url } else { 'http://localhost:11434' }
    $tags = $null
    try { $tags = Invoke-RestMethod -Uri ($base + '/api/tags') -TimeoutSec 5 } catch { }
    if ($tags -and $tags.models -and $tags.models.Count -gt 0) {
      $modelo = if ($cfg.ollama_modelo) { $cfg.ollama_modelo } else { $tags.models[0].name }
      $w = Api @{ action = 'agente_wods'; max = $max }
      foreach ($x in $w.wods) {
        $prompt = "Eres fisiólogo del ejercicio y analista de CrossFit y HYROX. Analiza SOLO lo que dice este WOD; si un dato no se deduce, escribe 'no consta'. " +
          "Responde en español con EXACTAMENTE estas 8 claves, en este orden, separadas por ' ; ' y en una sola línea, sin explicaciones ni markdown:`n" +
          "sistema: <ATP-PC | glucolítico | mixto | aeróbico> ; zona: <Z1–Z8> ; patrones: <empuje vertical, tirón, sentadilla, bisagra, olímpico, salto, monoestructural, core, acarreo> ; " +
          "limitante: <muscular (zona) | técnico (movimiento) | respiratorio | estratégico> ; interferencia: <qué movimiento fatiga a cuál y por qué> ; ritmo: <estrategia en pocas palabras> ; " +
          "mejora: <qué carencia del atleta entrena> ; palabras clave: <5–8 términos cortos>`n`n" +
          "Vocabulario correcto: el peso muerto es una bisagra (no una sentadilla); los double unders son un salto (no una bisagra); el remo, la bici, el ski y la carrera son monoestructurales.`n`n" +
          "WOD (" + $x.fuente + ' · ' + $x.nombre + "):`n" + $x.texto +
          "`n`nAnálisis del motor (fiable): formato " + $x.formato + ' · movimientos ' + $x.movimientos + ' · interferencias ' + $x.interferencias + ' · ' + $x.objetivo + "`nCiencia (fiable): " + $x.ciencia
        $cuerpoO = @{ model = $modelo; prompt = $prompt; stream = $false; options = @{ temperature = 0.1; num_predict = 350 } }
        if ($modelo -match '^(qwen3|deepseek-r1)') { $cuerpoO['think'] = $false }
        $body = $cuerpoO | ConvertTo-Json -Depth 4
        $r = Invoke-WebRequest -Uri ($base + '/api/generate') -Method Post -Body ($utf8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec 900
        $res = ([Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json).response
        $conc = (($res -replace '(?s)<think>.*?</think>', '') -replace '\s+', ' ').Trim()
        if ($conc) { [void](Api @{ action = 'agente_conceptos'; id = $x.id; conceptos = $conc }); Log ('Ollama (' + $modelo + ') · ' + $x.nombre) }
      }
    }
  }
} catch { Log ('Ollama: ' + $_.Exception.Message) }
