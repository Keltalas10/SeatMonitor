# Yandex Cloud Functions для Seat Monitor

Функции для регистрации и входа устройств по UUID.

## Структура проекта

```
seat-monitor-functions/
├── register/
│   └── index.js          # Функция регистрации устройства
├── login/
│   └── index.js          # Функция входа устройства
├── shared/
│   ├── ydb-client.js     # Клиент для работы с Yandex Database
│   └── utils.js          # Утилиты (JWT, валидация)
├── package.json
└── README.md
```

## Переменные окружения

В настройках каждой функции в Yandex Cloud необходимо установить:

- `YDB_ENDPOINT` - endpoint вашей БД (например: `ydb.serverless.yandexcloud.net:2135`)
- `YDB_DATABASE` - путь к базе данных (например: `/ru-central1/b1g.../etn...`)
- `JWT_SECRET` - секретный ключ для подписи JWT токенов (минимум 32 символа)
- `YDB_SERVICE_ACCOUNT_KEY` - JSON ключ сервисного аккаунта (или используйте IAM)

## Установка зависимостей

```bash
npm install
```

## Загрузка функций в Yandex Cloud

### Вариант 1: Через веб-интерфейс

1. Откройте функцию в консоли Yandex Cloud
2. Перейдите в раздел "Редактор кода"
3. Скопируйте код из `register/index.js` или `login/index.js`
4. Сохраните и создайте версию

### Вариант 2: Через Yandex Cloud CLI

```bash
# Загрузка функции регистрации
yc serverless function version create \
  --function-name registerUser \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 10s \
  --source-path ./register \
  --environment YDB_ENDPOINT=your-endpoint,YDB_DATABASE=your-database,JWT_SECRET=your-secret

# Загрузка функции входа
yc serverless function version create \
  --function-name loginUser \
  --runtime nodejs18 \
  --entrypoint index.handler \
  --memory 128m \
  --execution-timeout 10s \
  --source-path ./login \
  --environment YDB_ENDPOINT=your-endpoint,YDB_DATABASE=your-database,JWT_SECRET=your-secret
```

## API Endpoints

### POST /register

Регистрация устройства по UUID.

**Запрос:**
```json
{
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Ответ (успех):**
```json
{
  "success": true,
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "subscriptionEndDate": null,
  "alreadyRegistered": false,
  "message": "Устройство успешно зарегистрировано"
}
```

**Ответ (уже зарегистрирован):**
```json
{
  "success": true,
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "subscriptionEndDate": "2024-12-31T23:59:59.000Z",
  "alreadyRegistered": true,
  "message": "Устройство уже зарегистрировано"
}
```

### POST /login

Вход устройства по UUID.

**Запрос:**
```json
{
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Ответ (успех):**
```json
{
  "success": true,
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "subscriptionEndDate": "2024-12-31T23:59:59.000Z",
  "message": "Успешный вход"
}
```

**Ответ (ошибка):**
```json
{
  "success": false,
  "error": "Устройство не зарегистрировано"
}
```

## Структура таблицы users в YDB

```sql
CREATE TABLE users (
  deviceUUID Utf8 NOT NULL,
  subscriptionEndDate Utf8,
  token Utf8,
  loginTime Utf8,
  registeredAt Utf8,
  PRIMARY KEY (deviceUUID)
);
```

Таблица создается автоматически при первом вызове функции.

## Интеграция с Chrome Extension

В `ChromeExtension/js/auth.js` обновите методы:

```javascript
async register() {
  const deviceUUID = await this.getDeviceUUID();
  
  if (this.apiUrl) {
    const response = await fetch(`${this.apiUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceUUID })
    });
    const data = await response.json();
    if (data.success) {
      // Сохраняем токен и subscriptionEndDate
      return data;
    }
  }
  // ... локальная логика
}
```

## Тестирование

```bash
# Тест регистрации
curl -X POST https://YOUR-FUNCTION-URL/register \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'

# Тест входа
curl -X POST https://YOUR-FUNCTION-URL/login \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'
```

