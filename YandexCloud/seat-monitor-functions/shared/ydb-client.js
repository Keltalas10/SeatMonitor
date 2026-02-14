// Клиент для подключения к Yandex Database
const { Driver, getCredentialsFromEnv } = require('ydb-sdk');

let driver = null;

/**
 * Инициализация клиента YDB
 */
async function initYdbClient() {
  if (driver) {
    return driver;
  }

  try {
    let endpoint = process.env.YDB_ENDPOINT;
    let database = process.env.YDB_DATABASE;

    // Если database не указан отдельно, пытаемся извлечь из endpoint
    if (!database && endpoint && endpoint.includes('?database=')) {
      // Извлекаем database из параметров URL
      const match = endpoint.match(/[?&]database=([^&]+)/);
      if (match) {
        database = decodeURIComponent(match[1]);
      }
      // Убираем параметры из endpoint
      endpoint = endpoint.split('?')[0];
    }

    if (!endpoint || !database) {
      throw new Error('YDB_ENDPOINT и YDB_DATABASE должны быть установлены в переменных окружения');
    }

    // Очищаем endpoint от лишних символов
    endpoint = endpoint.trim();
    database = database.trim();

    // Убираем все протоколы из endpoint (grpc://, grpcs://, dns:, http://, https://)
    endpoint = endpoint.replace(/^(grpc|grpcs|dns|http|https):\/\//i, '');
    endpoint = endpoint.replace(/^dns:/i, '');

    // Убираем слеш в конце
    endpoint = endpoint.replace(/\/+$/, '');

    // Убираем параметры из endpoint (всё после ?)
    endpoint = endpoint.split('?')[0].trim();

    // Убираем пробелы
    endpoint = endpoint.trim();

    // Добавляем правильный протокол grpcs://
    endpoint = `grpcs://${endpoint}`;

    // Проверяем, что endpoint содержит хост и порт
    if (!endpoint.match(/grpcs:\/\/[^:]+:\d+$/)) {
      throw new Error('YDB_ENDPOINT должен содержать хост и порт (например: ydb.serverless.yandexcloud.net:2135)');
    }

    // Убеждаемся, что database начинается с /
    if (!database.startsWith('/')) {
      database = `/${database}`;
    }

    console.log('[YDB] Подключение к:', endpoint);
    console.log('[YDB] База данных:', database);

    // Используем сервисный аккаунт из переменных окружения
    // Для Yandex Cloud Functions используется IAM автоматически через getCredentialsFromEnv()
    const credentials = getCredentialsFromEnv();

    driver = new Driver({
      endpoint: endpoint,
      database: database,
      authService: credentials
    });

    // Проверяем подключение
    await driver.ready(5000);
    console.log('[YDB] Подключение к базе данных установлено');

    return driver;
  } catch (error) {
    console.error('[YDB] Ошибка подключения:', error);
    throw error;
  }
}

module.exports = {
  initYdbClient
};

