// Yandex Cloud Function: Login
// Вход устройства по UUID

const { initYdbClient } = require('./shared/ydb-client');
const { createResponse } = require('./shared/utils');
const { TypedValues } = require('ydb-sdk');


exports.handler = async (event, context) => {

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

    const { key, token } = body;
    const driver = await initYdbClient(process.env.DATABASE_ENDPOINT, process.env.DATABASE_NAME);
    const selectQuery = `
      DECLARE $key AS Uuid;
      DECLARE $token AS Uuid;
      
      SELECT subscriptionEndDate
      FROM account
      WHERE key = $key
      AND token = $token
      AND isActivated = true;
    `;

    let account = null;
    await driver.tableClient.withSession(async (session) => {
      const preparedQuery = await session.prepareQuery(selectQuery);
      const result = await session.executeQuery(preparedQuery, {
        $key: TypedValues.uuid(key),
        $token: TypedValues.uuid(token),
      });

      if (result.resultSets && result.resultSets.length > 0 && result.resultSets[0].rows.length > 0) {
        const row = result.resultSets[0].rows[0];
        account = {
          subscriptionEndDate: row.items[0].textValue || null,
        };
      }
    });

    // Если пользователь не найден, возвращаем ошибку
    if (!account) {
      return createResponse(401, {
        success: false,
        error: 'Ключ или токен неверны'
      });
    }

    return createResponse(200, {
      success: true,
      subscriptionEndDate: account.subscriptionEndDate,
    });

  } catch (error) {
    console.error('[Login] Ошибка:', error);
    return createResponse(500, {
      success: false,
      error: 'Внутренняя ошибка сервера',
    });
  }
};

