$ErrorActionPreference = "Stop"

$node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$next = Join-Path $PSScriptRoot "node_modules\next\dist\bin\next"
$address = "http://127.0.0.1:3010"

if (-not (Test-Path -LiteralPath $node)) {
    Write-Host "ContractorOS could not start because Node.js was not found." -ForegroundColor Red
    Write-Host "Please ask Codex to help install Node.js."
    exit 1
}

$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2
    $alreadyRunning = $response.StatusCode -eq 200
} catch {
    $alreadyRunning = $false
}

if (-not (Test-Path -LiteralPath $next)) {
    Write-Host "ContractorOS dependencies are not installed." -ForegroundColor Red
    Write-Host "Please ask Codex to run the project setup."
    exit 1
}

$buildId = Join-Path $PSScriptRoot ".next\BUILD_ID"
if (-not (Test-Path -LiteralPath $buildId)) {
    Write-Host "Preparing the latest ContractorOS build. This may take about a minute..."
    & $node $next build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ContractorOS could not be built." -ForegroundColor Red
        exit 1
    }
}

if (-not $alreadyRunning) {
    Start-Process -FilePath $node -ArgumentList "`"$next`" start -p 3010" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

    $ready = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        Start-Sleep -Milliseconds 300
        try {
            $response = Invoke-WebRequest -Uri $address -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            $ready = $false
        }
    }

    if (-not $ready) {
        Write-Host "The preview server did not start." -ForegroundColor Red
        Write-Host "Please show this message to Codex."
        exit 1
    }
}

Write-Host "ContractorOS is ready." -ForegroundColor Green
Write-Host ""
Write-Host "Opening your browser at:"
Write-Host $address -ForegroundColor Cyan

Start-Process $address
