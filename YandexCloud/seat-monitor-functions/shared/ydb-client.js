// Клиент для подключения к Yandex Database
const { Driver, getCredentialsFromEnv } = require('ydb-sdk');

let driverByKey = new Map();

/**
 * Инициализация клиента YDB
 */
async function initYdbClient(endpoint, database) {
  var key = [endpoint, database].join('/');
  console.log('[YDB] Подключение к базе данных:', key);
  if (driverByKey.has(key)) {
    return driverByKey.get(key);
  }

  try {
    const credentials = getCredentialsFromEnv();

    const driver = new Driver({
      endpoint: endpoint,
      database: database,
      authService: credentials
    });

    // Проверяем подключение
    await driver.ready(5000);
    console.log('[YDB] Подключение к базе данных установлено:', key);
    driverByKey.set(key, driver);
    return driver;
  } catch (error) {
    console.error('[YDB] Ошибка подключения:', key, error);
    throw error;
  }
}

module.exports = {
  initYdbClient
};

