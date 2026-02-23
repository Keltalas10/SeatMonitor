// Yandex Cloud Function: Register
const { initYdbClient } = require('./shared/ydb-client');
const { TypedValues } = require('ydb-sdk');

function formatYMD(date) {
  return date.toISOString().split('T')[0];
}

exports.handler = async (event, context) => {
  try {
    const { Key, Days, Amount } = event;

    if (!Key || !Days || !Amount) {
      return {
        result: 'Не успешно',
        error: 'Отсутствуют обязательные параметры: Key, Days, Amount'
      };
    }

    const databaseClient = await initYdbClient(process.env.DATABASE_ENDPOINT, process.env.DATABASE_NAME);

    // Проверяем существование аккаунта
    const checkQuery = `
      DECLARE $key AS Uuid;
      SELECT key, isActivated, subscriptionEndDate
      FROM account
      WHERE key = $key;
    `;

    let existingAccount = null;
    await databaseClient.tableClient.withSession(async (session) => {
      const preparedQuery = await session.prepareQuery(checkQuery);
      const result = await session.executeQuery(preparedQuery, {
        $key: TypedValues.uuid(Key)
      });

      if (result.resultSets?.[0]?.rows?.length > 0) {
        const row = result.resultSets[0].rows[0];
        existingAccount = {
          key: row.items[0].textValue,
          isActivated: row.items[1].boolValue,
          subscriptionEndDate: row.items[2].textValue
        };
      }
    });

    if (!existingAccount) {
      return {
        result: 'Не успешно',
        error: 'Указанного ключа не существует'
      };
    }

    // Рассчитываем новую дату
    const transactionDateTime = new Date().toISOString();

    let newSubscriptionEndDate;
    if (existingAccount.subscriptionEndDate) {
      newSubscriptionEndDate = new Date(existingAccount.subscriptionEndDate);
    } else {
      newSubscriptionEndDate = new Date();
      newSubscriptionEndDate.setHours(0, 0, 0, 0);
    }

    newSubscriptionEndDate.setDate(newSubscriptionEndDate.getDate() + Days);
    const formattedEndDate = formatYMD(newSubscriptionEndDate);

    // Обновляем подписку
    await databaseClient.tableClient.withSession(async (session) => {
      // Начинаем транзакцию (в YDB транзакция начинается с первого запроса)

      // 1. Обновляем подписку
      const updateQuery = `
    DECLARE $key AS Uuid;
    DECLARE $activationDateTime AS Utf8;
    DECLARE $subscriptionEndDate AS Utf8;
    
    UPDATE account
    SET
      updatedDateTime = $activationDateTime,
      subscriptionEndDate = $subscriptionEndDate
    WHERE key = $key
  `;

      const updatePrepared = await session.prepareQuery(updateQuery);
      await session.executeQuery(updatePrepared, {
        $key: TypedValues.uuid(Key),
        $activationDateTime: TypedValues.utf8(transactionDateTime),
        $subscriptionEndDate: TypedValues.utf8(formattedEndDate)
      });

      // 2. Записываем транзакцию (в той же транзакции)
      const insertQuery = `
    DECLARE $key AS Uuid;
    DECLARE $days AS Int32;
    DECLARE $transactionDateTime AS Utf8;
    DECLARE $amount AS Decimal(22,9);
    
    INSERT INTO transaction (accountKey, transactionDateTime, days, amount)
    VALUES ($key, $transactionDateTime, $days, $amount);
  `;

      const insertPrepared = await session.prepareQuery(insertQuery);
      await session.executeQuery(insertPrepared, {
        $key: TypedValues.uuid(Key),
        $transactionDateTime: TypedValues.utf8(transactionDateTime),
        $days: TypedValues.int32(Days),
        $amount: TypedValues.decimal(Amount.toString(), 22, 9)
      });

      // Транзакция автоматически закоммитится после успешного выполнения всех запросов
    });

    return {
      result: "Успешно",
      key: Key,
      subscriptionEndDate: formattedEndDate
    };

  } catch (error) {
    console.error('[Register] Ошибка:', error);
    return {
      result: 'Не успешно',
      error: error.message
    };
  }
};