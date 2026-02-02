# PowerShell скрипт для деплоя функций в Yandex Cloud
# Использование: .\deploy.ps1

param(
    [Parameter(Mandatory = $true)]
    [string]$YDB_ENDPOINT,
    
    [Parameter(Mandatory = $true)]
    [string]$YDB_DATABASE,
    
    [Parameter(Mandatory = $true)]
    [string]$JWT_SECRET
)

Write-Host "🚀 Начало деплоя функций..." -ForegroundColor Green

# Проверка наличия yc CLI
if (-not (Get-Command yc -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Yandex Cloud CLI не найден. Установите: https://cloud.yandex.ru/docs/cli/quickstart" -ForegroundColor Red
    exit 1
}

# Создание функций (если не существуют)
Write-Host "📦 Создание функций..." -ForegroundColor Yellow
yc serverless function create --name registerUser --description "Регистрация устройства по UUID" 2>$null
yc serverless function create --name loginUser --description "Вход устройства по UUID" 2>$null

# Деплой функции Register
Write-Host "📤 Деплой функции Register..." -ForegroundColor Yellow
cd register
if (Test-Path "shared") {
    Remove-Item -Recurse -Force shared
}
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
yc serverless function version create `
    Copy-Item ..\package.json .
Write-Host "📦 Установка зависимостей для Register..." -ForegroundColor Yellow
npm install --production
--memory 128m `
    --execution-timeout 10s `
    --source-path function.zip `
    --environment "YDB_ENDPOINT=$YDB_ENDPOINT,YDB_DATABASE=$YDB_DATABASE,JWT_SECRET=$JWT_SECRET"

Remove-Item function.zip
cd ..

# Деплой функции Login
Write-Host "📤 Деплой функции Login..." -ForegroundColor Yellow
cd login
if (Test-Path "shared") {
    Remove-Item -Recurse -Force shared
}
Copy-Item -Recurse ..\shared .
Compress-Archive -Path * -DestinationPath function.zip -Force

yc serverless function version create `
    --function-name loginUser `
    --runtime nodejs18 `
    if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
}
--entrypoint index.handler `
    Copy-Item ..\package.json .
Write-Host "📦 Установка зависимостей для Login..." -ForegroundColor Yellow
npm install --production
--memory 128m `
    --execution-timeout 10s `
    --source-path function.zip `
    --environment "YDB_ENDPOINT=$YDB_ENDPOINT,YDB_DATABASE=$YDB_DATABASE,JWT_SECRET=$JWT_SECRET"

Remove-Item function.zip
cd ..

Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "📝 Не забудьте настроить права доступа и API Gateway" -ForegroundColor Cyan

Remove-Item function.zip
cd ..

Write-Host "✅ Деплой завершен!" -ForegroundColor Green
Write-Host "📝 Не забудьте настроить права доступа и API Gateway" -ForegroundColor Cyan

