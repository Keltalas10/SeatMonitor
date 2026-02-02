# Инструкция по деплою функций в Yandex Cloud

## Подготовка

1. Убедитесь, что у вас установлен Yandex Cloud CLI:
   ```bash
   yc --version
   ```
   Если нет, установите: https://cloud.yandex.ru/docs/cli/quickstart

2. Авторизуйтесь:
   ```bash
   yc init
   ```

## Шаг 1: Создание функций

### Вариант 1: Через CLI (рекомендуется)

```bash
# Создание функции Register
yc serverless function create --name registerUser --description "Регистрация устройства по UUID"

# Создание функции Login
yc serverless function create --name loginUser --description "Вход устройства по UUID"
```

### Вариант 2: Через веб-интерфейс

1. Перейдите в Yandex Cloud Console → "Yandex Functions"
2. Нажмите "Создать функцию"
3. Настройки:
   - **Имя:** `registerUser`
   - **Описание:** "Регистрация устройства по UUID"
   - **Runtime:** `nodejs18`
   - **Entrypoint:** `index.handler`
   - **Таймаут:** 10 секунд
   - **Память:** 128 MB

Повторите для `loginUser`

## Шаг 2: Настройка переменных окружения

Для каждой функции добавьте переменные окружения:

1. Откройте функцию в консоли
2. Перейдите в "Редактор" → "Переменные окружения"
3. Добавьте переменные окружения:
   - `YDB_ENDPOINT` - endpoint вашей БД: `ydb.serverless.yandexcloud.net:2135` (без протокола, без слеша в конце)
   - `YDB_DATABASE` - полный путь к базе данных: `/ru-central1/b1g16omdlcc2rgoiapb6/etnlneuqkgidv5ob61p5` (с начальным слешем)
   - `JWT_SECRET` - секретный ключ (минимум 32 символа)
   
   **Пример правильных значений:**
   ```
   YDB_ENDPOINT=ydb.serverless.yandexcloud.net:2135
   YDB_DATABASE=/ru-central1/b1g16omdlcc2rgoiapb6/etnlneuqkgidv5ob61p5
   JWT_SECRET=ваш-секретный-ключ-минимум-32-символа
   ```
   
   **Важно:** 
   - `YDB_SERVICE_ACCOUNT_KEY` НЕ нужен, если используете IAM (рекомендуется)
   - Просто назначьте сервисный аккаунт функции в настройках "Права доступа"
   - Endpoint должен быть БЕЗ протокола (`grpcs://`) и БЕЗ слеша в конце (`/`)

## Шаг 3: Загрузка кода

### Вариант 1: Через CLI (рекомендуется)

**Важно:** Нужно упаковать код с shared файлами и node_modules в архив.

```bash
# Перейдите в папку проекта
cd YandexCloud/seat-monitor-functions

# Для функции Register:
# 1. Скопируйте shared в register
cd register
xcopy /E /I ..\shared shared
# Или на Linux/Mac: cp -r ../shared ./shared

# 2. Скопируйте package.json из корня
copy ..\package.json .
# Или на Linux/Mac: cp ../package.json .

# 3. Установите зависимости (ОБЯЗАТЕЛЬНО!)
npm install --production

# 4. Создайте ZIP архив со всеми файлами (ВКЛЮЧАЯ node_modules!)
# На Windows (PowerShell):
Compress-Archive -Path * -DestinationPath ..\register.zip -Force

# На Linux/Mac:
# zip -r ../register.zip . -x "*.git*" "*.md"

# 5. Загрузите версию функции
cd ..
yc serverless function version create `
  --function-name registerUser `
  --runtime nodejs18 `
  --entrypoint index.handler `
  --memory 128m `
  --execution-timeout 10s `
  --source-path register.zip `
  --environment YDB_ENDPOINT=your-endpoint,YDB_DATABASE=your-database,JWT_SECRET=your-secret

# Повторите для Login
cd login
xcopy /E /I ..\shared shared
copy ..\package.json .
npm install --production
Compress-Archive -Path * -DestinationPath ..\login.zip -Force

cd ..
yc serverless function version create `
  --function-name loginUser `
  --runtime nodejs18 `
  --entrypoint index.handler `
  --memory 128m `
  --execution-timeout 10s `
  --source-path login.zip `
  --environment YDB_ENDPOINT=your-endpoint,YDB_DATABASE=your-database,JWT_SECRET=your-secret
```

**КРИТИЧЕСКИ ВАЖНО:** 
- ✅ Обязательно выполните `npm install --production` перед созданием архива
- ✅ Включите `node_modules` в архив (не исключайте его!)
- ✅ Убедитесь, что `@yandex-cloud/nodejs-sdk` установлен (это зависимость ydb-sdk)

### Вариант 2: Через веб-интерфейс

1. Откройте функцию `registerUser` в консоли
2. Перейдите в "Редактор кода"
3. Скопируйте содержимое файла `register/index.js` в основной файл
4. В разделе "Файлы" создайте папку `shared` и загрузите:
   - `shared/ydb-client.js`
   - `shared/utils.js`
5. Сохраните и создайте версию

Повторите для `loginUser` с файлом `login/index.js`

## Шаг 4: Настройка прав доступа

1. В настройках каждой функции:
   - Перейдите в "Права доступа"
   - Добавьте сервисный аккаунт `database-user` (созданный в Этапе 2 инструкции)
   - Назначьте роль `ydb.editor`

## Шаг 5: Настройка API Gateway

1. Перейдите в "API Gateway"
2. Создайте новый API Gateway или откройте существующий
3. Настройте маршруты:

**Маршрут 1: /register**
- Метод: `POST`
- Тип интеграции: `Cloud Functions`
- Функция: `registerUser`
- Версия: `$latest` или конкретная версия

**Маршрут 2: /login**
- Метод: `POST`
- Тип интеграции: `Cloud Functions`
- Функция: `loginUser`
- Версия: `$latest` или конкретная версия

4. Сохраните и получите URL API Gateway

## Шаг 6: Обновление Chrome Extension

В `ChromeExtension/js/auth.js` обновите:

```javascript
apiUrl: 'https://YOUR-API-GATEWAY-ID.apigw.yandexcloud.net'
```

## Тестирование

```bash
# Тест регистрации
curl -X POST https://YOUR-API-GATEWAY/register \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'

# Тест входа
curl -X POST https://YOUR-API-GATEWAY/login \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'
```

## Устранение проблем

1. **Ошибка подключения к YDB:**
   - Проверьте переменные окружения
   - Убедитесь, что сервисный аккаунт имеет права `ydb.editor`
   - Проверьте endpoint и database path

2. **Ошибка "Table not found":**
   - Функция автоматически создает таблицу при первом вызове
   - Проверьте логи функции в консоли Yandex Cloud

3. **Ошибка CORS:**
   - Убедитесь, что функции возвращают правильные заголовки
   - Проверьте настройки API Gateway

