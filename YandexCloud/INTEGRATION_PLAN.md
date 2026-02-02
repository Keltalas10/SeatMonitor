# План интеграции Chrome Extension с Yandex Cloud Functions

## ✅ Выполнено

1. ✅ Созданы Yandex Cloud Functions:
   - `registerUser` - регистрация устройства по UUID
   - `loginUser` - вход устройства по UUID
2. ✅ Настроена база данных YDB с таблицей `users`
3. ✅ Функции протестированы и работают корректно

## 📋 Следующие шаги

### Шаг 1: Настройка API Gateway

**Цель:** Создать публичный endpoint для доступа к функциям из Chrome Extension

#### 1.1. Создание API Gateway через веб-интерфейс

1. Перейдите в [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Выберите ваш каталог
3. Перейдите в раздел **"API Gateway"**
4. Нажмите **"Создать API Gateway"**

#### 1.2. Настройка спецификации API Gateway

Создайте файл `api-gateway-spec.yaml` со следующей спецификацией:

```yaml
openapi: 3.0.0
info:
  title: Seat Monitor API
  version: 1.0.0
paths:
  /register:
    post:
      summary: Регистрация устройства
      operationId: register
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <FUNCTION_ID_REGISTER>
        service_account_id: <SERVICE_ACCOUNT_ID>
      responses:
        '200':
          description: Успешная регистрация
          content:
            application/json:
              schema:
                type: object
      x-yc-apigateway-any-method:
        x-yc-apigateway-integration:
          type: cloud_functions
          function_id: <FUNCTION_ID_REGISTER>
          service_account_id: <SERVICE_ACCOUNT_ID>
  /login:
    post:
      summary: Вход устройства
      operationId: login
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <FUNCTION_ID_LOGIN>
        service_account_id: <SERVICE_ACCOUNT_ID>
      responses:
        '200':
          description: Успешный вход
          content:
            application/json:
              schema:
                type: object
      x-yc-apigateway-any-method:
        x-yc-apigateway-integration:
          type: cloud_functions
          function_id: <FUNCTION_ID_LOGIN>
          service_account_id: <SERVICE_ACCOUNT_ID>
```

**Где найти ID функции:**
- Перейдите в функцию `registerUser` → скопируйте ID из URL или раздела "Общая информация"
- Аналогично для `loginUser`

**Где найти Service Account ID:**
- Перейдите в "Сервисные аккаунты" → найдите аккаунт, который использует функция → скопируйте ID

#### 1.3. Создание API Gateway через CLI (альтернатива)

```bash
# Создание API Gateway
yc serverless api-gateway create \
  --name seat-monitor-api \
  --description "API для Seat Monitor Extension" \
  --spec api-gateway-spec.yaml

# Получение URL API Gateway
yc serverless api-gateway get seat-monitor-api --format json | grep -oP '"domain": "\K[^"]*'
```

#### 1.4. Получение URL API Gateway

После создания API Gateway вы получите URL вида:
```
https://<api-gateway-id>.apigw.yandexcloud.net
```

Сохраните этот URL - он понадобится для настройки Chrome Extension.

---

### Шаг 2: Обновление Chrome Extension

#### 2.1. Обновление `auth.js`

Откройте `ChromeExtension/js/auth.js` и выполните следующие изменения:

1. **Установите API URL:**
```javascript
const Auth = {
  // URL API Gateway
  apiUrl: 'https://YOUR-API-GATEWAY-ID.apigw.yandexcloud.net', // ЗАМЕНИТЕ на ваш URL
  // ...
}
```

2. **Активируйте метод `register()`:**
Найдите строки 58-69 и раскомментируйте код:

```javascript
async register() {
  try {
    const deviceUUID = await this.getDeviceUUID();
    
    // Интеграция с Yandex Cloud
    if (this.apiUrl) {
      try {
        const response = await fetch(`${this.apiUrl}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceUUID })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          // Сохраняем данные с сервера
          const sessionData = {
            deviceUUID: data.deviceUUID,
            loginTime: new Date().toISOString(),
            subscriptionEndDate: data.subscriptionEndDate || null,
            token: data.token
          };
          await this._saveSession(sessionData);
          return {
            success: true,
            deviceUUID: data.deviceUUID,
            subscriptionEndDate: data.subscriptionEndDate
          };
        } else {
          return { success: false, error: data.error || 'Ошибка при регистрации' };
        }
      } catch (fetchError) {
        console.error('[Auth] Ошибка запроса к API:', fetchError);
        return { success: false, error: 'Ошибка подключения к серверу' };
      }
    }
    
    // Fallback на локальную регистрацию (если API недоступен)
    // ... (оставить существующий код как fallback)
  } catch (error) {
    // ...
  }
}
```

3. **Активируйте метод `login()`:**
Найдите строки 113-124 и раскомментируйте код:

```javascript
async login(subscriptionEndDate = null) {
  try {
    const deviceUUID = await this.getDeviceUUID();
    
    // Интеграция с Yandex Cloud
    if (this.apiUrl) {
      try {
        const response = await fetch(`${this.apiUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceUUID })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          const sessionData = {
            deviceUUID: data.deviceUUID,
            loginTime: new Date().toISOString(),
            subscriptionEndDate: data.subscriptionEndDate || null,
            token: data.token
          };
          await this._saveSession(sessionData);
          return {
            success: true,
            deviceUUID: data.deviceUUID,
            subscriptionEndDate: data.subscriptionEndDate
          };
        } else {
          return { success: false, error: data.error || 'Ошибка при входе' };
        }
      } catch (fetchError) {
        console.error('[Auth] Ошибка запроса к API:', fetchError);
        return { success: false, error: 'Ошибка подключения к серверу' };
      }
    }
    
    // Fallback на локальный логин (если API недоступен)
    // ... (оставить существующий код как fallback)
  } catch (error) {
    // ...
  }
}
```

---

### Шаг 3: Тестирование

#### 3.1. Тест API Gateway напрямую

```bash
# Тест регистрации
curl -X POST https://YOUR-API-GATEWAY-ID.apigw.yandexcloud.net/register \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'

# Тест входа
curl -X POST https://YOUR-API-GATEWAY-ID.apigw.yandexcloud.net/login \
  -H "Content-Type: application/json" \
  -d '{"deviceUUID":"123e4567-e89b-12d3-a456-426614174000"}'
```

**Ожидаемый ответ:**
```json
{
  "success": true,
  "deviceUUID": "123e4567-e89b-12d3-a456-426614174000",
  "subscriptionEndDate": null,
  "token": "..."
}
```

#### 3.2. Тест через Chrome Extension

1. Откройте Chrome Extension в режиме разработчика
2. Откройте DevTools (F12) → вкладка "Console"
3. Откройте любую веб-страницу
4. Проверьте логи в консоли:
   - `[Auth] Сгенерирован новый UUID устройства: ...`
   - `[Auth] Устройство успешно зарегистрировано: ...`
5. Откройте popup расширения
6. Проверьте отображение:
   - ID устройства (первые 8 символов UUID)
   - Дата окончания подписки (если установлена)

#### 3.3. Проверка базы данных

1. Перейдите в Yandex Cloud Console → YDB
2. Откройте вашу базу данных
3. Выполните запрос:
```sql
SELECT * FROM users;
```
4. Убедитесь, что запись создана с правильным `deviceUUID`, `token`, `loginTime`

---

### Шаг 4: Настройка подписки (опционально)

Если нужно установить дату окончания подписки для пользователя:

1. Обновите запись в базе данных:
```sql
UPDATE users 
SET subscriptionEndDate = '2024-12-31T23:59:59Z'
WHERE deviceUUID = 'YOUR-UUID';
```

2. Или создайте отдельную функцию `updateSubscription` в Yandex Cloud Functions

---

## 🔧 Устранение проблем

### Проблема: CORS ошибка

**Решение:** API Gateway автоматически обрабатывает CORS. Убедитесь, что функции возвращают правильные заголовки (уже настроено в `utils.js`).

### Проблема: "Failed to fetch"

**Возможные причины:**
1. Неверный URL API Gateway
2. API Gateway не создан или не активирован
3. Проблемы с сетью

**Решение:**
- Проверьте URL в `auth.js`
- Проверьте статус API Gateway в консоли
- Проверьте логи функции в Yandex Cloud Console

### Проблема: "Function not found"

**Решение:**
- Убедитесь, что ID функции в спецификации API Gateway правильный
- Проверьте, что функция существует и имеет версию

### Проблема: Данные не сохраняются в БД

**Решение:**
- Проверьте переменные окружения функции (`YDB_ENDPOINT`, `YDB_DATABASE`)
- Проверьте права доступа сервисного аккаунта (`ydb.editor`)
- Проверьте логи функции в Yandex Cloud Console

---

## 📝 Чеклист готовности

- [ ] API Gateway создан и настроен
- [ ] URL API Gateway получен и сохранен
- [ ] `auth.js` обновлен с реальным API URL
- [ ] Методы `register()` и `login()` активированы
- [ ] API Gateway протестирован через curl
- [ ] Chrome Extension протестирован
- [ ] Данные сохраняются в YDB
- [ ] Popup отображает информацию об устройстве
- [ ] Дата подписки отображается корректно

---

## 🎯 Следующие улучшения (опционально)

1. **Добавить функцию обновления подписки:**
   - Создать функцию `updateSubscription` в Yandex Cloud
   - Добавить endpoint в API Gateway
   - Добавить метод в `auth.js`

2. **Добавить валидацию токена:**
   - Проверять JWT токен при каждом запросе
   - Добавить middleware для проверки токена

3. **Добавить логирование:**
   - Логировать все запросы в Cloud Logging
   - Добавить мониторинг ошибок

4. **Добавить rate limiting:**
   - Ограничить количество запросов с одного устройства
   - Защита от злоупотреблений

