// Модуль аутентификации
// Управляет автоматической регистрацией по UUID и проверкой сессии (30 дней)

const Auth = {
  // URL API (будет использоваться при интеграции с Yandex Cloud)
  apiUrl: "https://d5d6sqot3a11trmsqsne.trruwy79.apigw.yandexcloud.net", // Пока null, так как API еще не настроен

  /**
   * Получение или создание UUID устройства
   * @returns {Promise<string>} UUID устройства
   */
  async getAccountData() {
    return await chrome.storage.local.get(["accountKey", "token", "subscriptionEndDate", "loginTime"]);
  },

  /**
   * Автоматическая регистрация по UUID устройства
   * Вызывается при первом запуске расширения
   */
  async register(key) {
    try {
      const response = await fetch(`${this.apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, version: chrome.runtime.getManifest().version })
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        // Сохраняем данные с сервера
        const sessionData = {
          key: key,
          token: data.token
        };
        await chrome.storage.local.set({ ...sessionData });

        return { success: true };
      } else {
        console.error('[Auth] Ошибка регистрации через API:', data.error);
        return { success: false, error: data.error }
      }
    } catch (fetchError) {
      console.error('[Auth] Ошибка запроса к API:', fetchError);
      return { success: false, error: "Ошибка сервера" }
    }
  },

  /**
   * Автоматический вход по UUID устройства
   * Проверяет сессию и обновляет её при необходимости
   */
  async login() {
    try {
      const accountData = this.getAccountData();
      const response = await fetch(`${this.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: accountData.accountKey, token: accountData.token })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Сохраняем данные с сервера
        const sessionData = {
          accountKey: accountData.accountKey,
          loginTime: new Date().toISOString(),
          subscriptionEndDate: data.subscriptionEndDate || null,
          token: data.token
        };
        await chrome.storage.local.set({ ...sessionData });

        return {
          success: true,
          subscriptionEndDate: data.subscriptionEndDate
        };
      } else {
        console.error('[Auth] Ошибка входа через API:', data.error);
        return {
          success: false,
          error: data.error
        }
      }
    } catch (fetchError) {
      console.error('[Auth] Ошибка запроса к API:', fetchError);
      return {
        success: false,
        error: "Внутреннея ошибка обратитесь в техподержку"
      }
    }
  },

  /**
   * Проверка активной подписки
   * @returns {Promise<boolean>} true если подписка активна (дата окончания >= текущей даты)
   */
  async hasActiveSubscription() {
    try {
      const subscriptionEndDate = await chrome.storage.local.get(['subscriptionEndDate']);

      // Если подписка не установлена
      if (!subscriptionEndDate) {
        return false;
      }

      // Проверяем, что дата окончания подписки >= текущей даты (сравниваем только даты, без времени)
      const endDate = new Date(subscriptionEndDate);
      const now = new Date();

      // Устанавливаем время на начало дня для сравнения
      endDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      // Подписка активна, если дата окончания >= текущей даты (включая сегодняшний день)
      return endDate >= now;

    } catch (error) {
      console.error('[Auth] Ошибка при проверке подписки:', error);
      return false;
    }
  },
};

