// Yandex Cloud Function: Login
// Вход устройства по UUID

const { initYdbClient } = require('./shared/ydb-client');
const { isValidUUID, createResponse, handleOptions, generateToken } = require('./shared/utils');
const { TypedValues } = require('ydb-sdk');

/**
 * Обработчик функции входа для Yandex Cloud Functions
 * Формат события: { httpMethod, headers, body, ... }
 */
exports.handler = async (event, context) => {
  // Обработка CORS preflight запроса
  // Проверяем различные форматы события от API Gateway
  const httpMethod = event.httpMethod ||
    event.requestContext?.httpMethod ||
    event.method ||
    (event.requestContext && event.requestContext.http && event.requestContext.http.method);

  const isOptions = httpMethod === 'OPTIONS' ||
    httpMethod === 'options' ||
    (event.headers && (
      event.headers['access-control-request-method'] ||
      event.headers['Access-Control-Request-Method']
    ));

  if (isOptions) {
    console.log('[Login] Обработка OPTIONS запроса');
    return handleOptions();
  }

  try {
    // Парсинг тела запроса
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return createResponse(400, {
        success: false,
        error: 'Неверный формат JSON'
      });
    }

    const { deviceUUID, version } = body;
    const lastVersion = process.env.LAST_VERSION;
    if (lastVersion !== version) {
      console.log(`[Login] Устройство имеет старую версию: ${deviceUUID}`);
      return createResponse(400, {
        success: false,
        error: 'Ваша версия extionsion не совпадает с последеной ' + lastVersion
      });
    }
    // Валидация UUID
    if (!deviceUUID) {
      return createResponse(400, {
        success: false,
        error: 'deviceUUID обязателен'
      });
    }

    if (!isValidUUID(deviceUUID)) {
      return createResponse(400, {
        success: false,
        error: 'Неверный формат UUID'
      });
    }

    // Инициализация клиента YDB
    await initYdbClient();

    // Поиск пользователя в БД
    const driver = await initYdbClient();
    const selectQuery = `
      DECLARE $deviceUUID AS Utf8;
      
      SELECT deviceUUID, subscriptionEndDate, registeredAt
      FROM user
      WHERE deviceUUID = $deviceUUID;
    `;

    let user = null;
    await driver.tableClient.withSession(async (session) => {
      const preparedQuery = await session.prepareQuery(selectQuery);
      const result = await session.executeQuery(preparedQuery, {
        $deviceUUID: TypedValues.utf8(deviceUUID)
      });

      if (result.resultSets && result.resultSets.length > 0 && result.resultSets[0].rows.length > 0) {
        const row = result.resultSets[0].rows[0];
        user = {
          deviceUUID: row.items[0].textValue,
          subscriptionEndDate: row.items[1].textValue || null,
          registeredAt: row.items[2].textValue || null
        };
      }
    });

    // Если пользователь не найден, возвращаем ошибку
    if (!user) {
      return createResponse(401, {
        success: false,
        error: 'Устройство не зарегистрировано'
      });
    }

    // Генерируем новый токен
    const token = generateToken(deviceUUID);
    const loginTime = new Date().toISOString();

    // Обновляем время входа и токен
    await driver.tableClient.withSession(async (session) => {
      const updateQuery = `
        DECLARE $deviceUUID AS Utf8;
        DECLARE $loginTime AS Utf8;
        DECLARE $token AS Utf8;
        
        UPDATE user
        SET loginTime = $loginTime, token = $token
        WHERE deviceUUID = $deviceUUID;
      `;
      const preparedQuery = await session.prepareQuery(updateQuery);
      await session.executeQuery(preparedQuery, {
        $deviceUUID: TypedValues.utf8(deviceUUID),
        $loginTime: TypedValues.utf8(loginTime),
        $token: TypedValues.utf8(token)
      });
    });

    console.log(`[Login] Устройство вошло: ${deviceUUID}`);

    return createResponse(200, {
      success: true,
      deviceUUID: deviceUUID,
      token: token,
      subscriptionEndDate: user.subscriptionEndDate,
      message: 'Успешный вход'
    });

  } catch (error) {
    console.error('[Login] Ошибка:', error);
    return createResponse(500, {
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

