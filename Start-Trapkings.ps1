$ErrorActionPreference = 'Stop'

Push-Location $PSScriptRoot
try {
    Push-Location frontend
    try {
        if (-not (Test-Path -LiteralPath 'node_modules/.bin/vite.cmd')) {
            npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Installing React dependencies failed.' }
        }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Building the storefront failed.' }
    }
    finally {
        Pop-Location
    }

    python -m backend.setup
    if ($LASTEXITCODE -ne 0) { throw 'Database setup failed. Check the XAMPP MySQL service and credentials.' }

    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
    if ($LASTEXITCODE -ne 0) { throw 'Starting the TRAPKINGS server failed.' }
}
finally {
    Pop-Location
}
