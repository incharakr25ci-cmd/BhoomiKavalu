# Bhoomi Kavalu - Start Both Backend and Frontend
Write-Host "Starting Bhoomi Kavalu Backend (port 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; & '.\.venv\Scripts\python.exe' -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000"

Write-Host "Starting Bhoomi Kavalu Frontend (port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`nBhoomi Kavalu is starting!" -ForegroundColor Yellow
Write-Host "Open in browser: https://localhost:5173/" -ForegroundColor Cyan
