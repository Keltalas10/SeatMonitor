// Yandex Cloud Function: Register
// Регистрация устройства по UUID

const { initYdbClient, ensureTableExists } = require('./shared/ydb-client');
const { isValidUUID, createResponse, handleOptions, generateToken } = require('./shared/utils');
const { TypedValues } = require('ydb-sdk');

/**
 * Обработчик функции регистрации для Yandex Cloud Functions
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
    console.log('[Register] Обработка OPTIONS запроса');
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

    const { deviceUUID } = body;

    // Валидация UUID
    if (!deviceUUID) {
      return createResponse(400, {
        success: false,
        error: 'deviceUUID обязателен'
      });
    }

    // Инициализация клиента YDB
    await initYdbClient();
    await ensureTableExists();

    // Проверка, существует ли уже пользователь
    const driver = await initYdbClient();
    const checkQuery = `
      DECLARE $deviceUUID AS Utf8;
      
      SELECT deviceUUID, subscriptionEndDate, registeredAt
      FROM user
      WHERE deviceUUID = $deviceUUID;
    `;

    let existingUser = null;
    await driver.tableClient.withSession(async (session) => {
      const preparedQuery = await session.prepareQuery(checkQuery);
      const result = await session.executeQuery(preparedQuery, {
        $deviceUUID: TypedValues.utf8(deviceUUID)
      });

      if (result.resultSets && result.resultSets.length > 0 && result.resultSets[0].rows.length > 0) {
        const row = result.resultSets[0].rows[0];
        existingUser = {
          deviceUUID: row.items[0].textValue,
          subscriptionEndDate: row.items[1].textValue || null,
          registeredAt: row.items[2].textValue || null
        };
      }
    });

    // Если пользователь уже существует
    if (existingUser) {
      const token = generateToken(deviceUUID);
      const loginTime = new Date().toISOString();

      // Обновляем время входа
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

      return createResponse(200, {
        success: true,
        deviceUUID: deviceUUID,
        token: token,
        subscriptionEndDate: existingUser.subscriptionEndDate,
        alreadyRegistered: true,
        message: 'Устройство уже зарегистрировано'
      });
    }

    // Регистрация нового устройства
    const token = generateToken(deviceUUID);
    const registeredAt = new Date().toISOString();
    const loginTime = new Date().toISOString();

    await driver.tableClient.withSession(async (session) => {
      const insertQuery = `
        DECLARE $deviceUUID AS Utf8;
        DECLARE $token AS Utf8;
        DECLARE $loginTime AS Utf8;
        DECLARE $registeredAt AS Utf8;
        
        INSERT INTO user (deviceUUID, subscriptionEndDate, token, loginTime, registeredAt)
        VALUES ($deviceUUID, NULL, $token, $loginTime, $registeredAt);
      `;
      const preparedQuery = await session.prepareQuery(insertQuery);
      await session.executeQuery(preparedQuery, {
        $deviceUUID: TypedValues.utf8(deviceUUID),
        $token: TypedValues.utf8(token),
        $loginTime: TypedValues.utf8(loginTime),
        $registeredAt: TypedValues.utf8(registeredAt)
      });
    });

    console.log(`[Register] Устройство зарегистрировано: ${deviceUUID}`);

    return createResponse(200, {
      success: true,
      deviceUUID: deviceUUID,
      token: token,
      subscriptionEndDate: null,
      alreadyRegistered: false,
      message: 'Устройство успешно зарегистрировано'
    });

  } catch (error) {
    console.error('[Register] Ошибка:', error);
    return createResponse(500, {
      success: false,
      error: error.toString(),
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

