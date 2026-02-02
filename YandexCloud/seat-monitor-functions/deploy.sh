#!/bin/bash
# Bash скрипт для деплоя функций в Yandex Cloud
# Использование: ./deploy.sh

set -e

# Проверка параметров
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Использование: ./deploy.sh YDB_ENDPOINT YDB_DATABASE JWT_SECRET"
    echo "Пример: ./deploy.sh ydb.serverless.yandexcloud.net:2135 /ru-central1/b1g.../etn... my-secret-key"
    exit 1
fi

YDB_ENDPOINT=$1
YDB_DATABASE=$2
JWT_SECRET=$3

echo "🚀 Начало деплоя функций..."

# Проверка наличия yc CLI
if ! command -v yc &> /dev/null; then
    echo "❌ Yandex Cloud CLI не найден. Установите: https://cloud.yandex.ru/docs/cli/quickstart"
    exit 1
fi

# Создание функций (если не существуют)
echo "📦 Создание функций..."
yc serverless function create --name registerUser --description "Регистрация устройства по UUID" 2>/dev/null || true
yc serverless function create --name loginUser --description "Вход устройства по UUID" 2>/dev/null || true

# Деплой функции Register
echo "📤 Деплой функции Register..."
cd register
rm -rf shared
cp -r ../shared .
zip -r function.zip . -x "*.git*" "*.md" "node_modules/*" "*.zip"

yc serverless function version create \
    --function-name registerUser \
    --runtime nodejs18 \
    --entrypoint index.handler \
    --memory 128m \
    --execution-timeout 10s \
    --source-path function.zip \
    --environment "YDB_ENDPOINT=$YDB_ENDPOINT,YDB_DATABASE=$YDB_DATABASE,JWT_SECRET=$JWT_SECRET"

rm -f function.zip
rm -rf shared
cd ..

# Деплой функции Login
echo "📤 Деплой функции Login..."
cd login
rm -rf shared
cp -r ../shared .
zip -r function.zip . -x "*.git*" "*.md" "node_modules/*" "*.zip"

yc serverless function version create \
    --function-name loginUser \
    --runtime nodejs18 \
    --entrypoint index.handler \
    --memory 128m \
    --execution-timeout 10s \
    --source-path function.zip \
    --environment "YDB_ENDPOINT=$YDB_ENDPOINT,YDB_DATABASE=$YDB_DATABASE,JWT_SECRET=$JWT_SECRET"

rm -f function.zip
rm -rf shared
cd ..

echo "✅ Деплой завершен!"
echo "📝 Не забудьте настроить права доступа и API Gateway"

