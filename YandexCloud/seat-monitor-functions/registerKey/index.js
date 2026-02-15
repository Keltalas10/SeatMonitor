// Yandex Cloud Function: Register
// Регистрация устройства по UUID

const { initYdbClient } = require('./shared/ydb-client');
const { createResponse } = require('./shared/utils');
const { TypedValues } = require('ydb-sdk');

/**
 * Обработчик функции регистрации для Yandex Cloud Functions
 * Формат события: { httpMethod, headers, body, ... }
 */
exports.handler = async (event, context) => {
  try {
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (e) {
      return createResponse(400, {
        success: false,
        error: 'Неверный формат JSON'
      });
    }

    const { key, version } = body;
    const lastVersion = process.env.LAST_VERSION;
    if (lastVersion !== version) {
      return createResponse(400, {
        success: false,
        error: 'Ваша версия extionsion не совпадает с последней ' + lastVersion
      });
    }

    if (!key) {
      return createResponse(400, {
        success: false,
        error: 'Отсутствует ключ'
      });
    }

    const databaseClient = await initYdbClient(process.env.DATABASE_ENDPOINT, process.env.DATABASE_NAME);
    const checkQuery = `
      DECLARE $key AS Uuid;
      SELECT key, isActivated
      FROM account
      WHERE key = $key;
    `;

    let existingAccount = null;
    await databaseClient.tableClient.withSession(async (session) => {
      const preparedQuery = await session.prepareQuery(checkQuery);
      const result = await session.executeQuery(preparedQuery, {
        $key: TypedValues.uuid(key)
      });

      if (result.resultSets && result.resultSets.length > 0 && result.resultSets[0].rows.length > 0) {
        const row = result.resultSets[0].rows[0];
        existingAccount = {
          key: row.items[0].textValue,
          isActivated: row.items[1].boolValue
        };
      }
    });

    if (existingAccount === null) {
      return createResponse(400, {
        success: false,
        error: 'Указанного ключа не существует'
      });
    }

    if (existingAccount.isActivated === true) {
      return createResponse(400, {
        success: false,
        error: 'Указанный ключ уже активирован'
      });
    }

    // Регистрация нового устройства
    const token = crypto.randomUUID();
    const activationDateTime = new Date().toISOString();

    await databaseClient.tableClient.withSession(async (session) => {
      const insertQuery = `
        DECLARE $key AS Uuid;
        DECLARE $token AS Uuid;
        DECLARE $activationDateTime AS Utf8;
        
        UPDATE account
          SET
            isActivated = true,
            token = $token,
            activationDateTime = $activationDateTime,
            updatedDateTime = $activationDateTime
        WHERE key = $key;
      `;
      const preparedQuery = await session.prepareQuery(insertQuery);
      await session.executeQuery(preparedQuery, {
        $key: TypedValues.uuid(key),
        $token: TypedValues.uuid(token),
        $activationDateTime: TypedValues.utf8(activationDateTime)
      });
    });

    console.log(`[Register] Устройство зарегистрировано: ${key}`);

    return createResponse(200, {
      success: true,
      key: key,
      token: token
    });

  } catch (error) {
    console.error('[Register] Ошибка:', error);
    return createResponse(500, {
      success: false,
      error: "Ошибка на сервере пожалуйста попробуйте еще раз или обратитесь в службу поддержки"
    });
  }
};

