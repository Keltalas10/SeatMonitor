// Модуль аутентификации
// Управляет автоматической регистрацией по UUID и проверкой сессии (30 дней)

const Auth = {
  // URL API (будет использоваться при интеграции с Yandex Cloud)
  apiUrl: "https://d5daknevq1vgram63gsk.laqt4bj7.apigw.yandexcloud.net", // Пока null, так как API еще не настроен

  // Константы
  SESSION_DURATION_DAYS: 1,
  UUID_STORAGE_KEY: 'deviceUUID',
  EXTENSION_VERSION: "1.26",

  /**
   * Генерация UUID v4
   * @private
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Получение или создание UUID устройства
   * @returns {Promise<string>} UUID устройства
   */
  async getDeviceUUID() {
    try {
      const result = await chrome.storage.local.get([this.UUID_STORAGE_KEY]);

      if (result[this.UUID_STORAGE_KEY]) {
        return result[this.UUID_STORAGE_KEY];
      }

      // Генерируем новый UUID
      const uuid = this._generateUUID();
      await chrome.storage.local.set({ [this.UUID_STORAGE_KEY]: uuid });

      console.log('[Auth] Сгенерирован новый UUID устройства:', uuid);
      return uuid;
    } catch (error) {
      console.error('[Auth] Ошибка при получении UUID:', error);
      // Fallback: генерируем временный UUID
      return this._generateUUID();
    }
  },

  /**
   * Автоматическая регистрация по UUID устройства
   * Вызывается при первом запуске расширения
   */
  async register() {
    try {
      // Получаем UUID устройства
      const deviceUUID = await this.getDeviceUUID();

      // Интеграция с Yandex Cloud API
      if (this.apiUrl) {
        try {
          const response = await fetch(`${this.apiUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceUUID, version: this.EXTENSION_VERSION })
          });

          const data = await response.json();

          if (response.ok && data.success) {
            // Сохраняем данные с сервера
            const sessionData = {
              deviceUUID: data.deviceUUID || deviceUUID,
              registeredAt: data.registeredAt || new Date().toISOString(),
              loginTime: new Date().toISOString(),
              subscriptionEndDate: data.subscriptionEndDate || null,
              token: data.token || this._generateToken()
            };
            await this._saveSession(sessionData);

            console.log('[Auth] Устройство успешно зарегистрировано через API:', deviceUUID);
            return {
              success: true,
              deviceUUID: data.deviceUUID || deviceUUID,
              subscriptionEndDate: data.subscriptionEndDate,
              alreadyRegistered: false
            };
          } else {
            console.error('[Auth] Ошибка регистрации через API:', data.error);
            // Fallback на локальную регистрацию
          }
        } catch (fetchError) {
          console.error('[Auth] Ошибка запроса к API:', fetchError);
          // Fallback на локальную регистрацию
        }
      }

      // Локальная регистрация (fallback или если apiUrl = null)
      // Проверяем, не зарегистрирован ли уже этот UUID
      const existingSession = await chrome.storage.local.get(['authSession']);
      if (existingSession.authSession && existingSession.authSession.deviceUUID === deviceUUID) {
        // Уже зарегистрирован, просто возвращаем успех
        return { success: true, deviceUUID, alreadyRegistered: true };
      }

      // Создание сессии для нового устройства
      const sessionData = {
        deviceUUID: deviceUUID,
        registeredAt: new Date().toISOString(),
        loginTime: new Date().toISOString(),
        subscriptionEndDate: null,
        token: this._generateToken()
      };

      // Сохранение сессии
      await this._saveSession(sessionData);

      console.log('[Auth] Устройство успешно зарегистрировано локально:', deviceUUID);

      return {
        success: true,
        deviceUUID: deviceUUID,
        alreadyRegistered: false
      };

    } catch (error) {
      console.error('[Auth] Ошибка при регистрации:', error);
      return { success: false, error: 'Ошибка при регистрации' };
    }
  },

  /**
   * Автоматический вход по UUID устройства
   * Проверяет сессию и обновляет её при необходимости
   */
  async login(subscriptionEndDate = null) {
    try {
      // Получаем UUID устройства
      const deviceUUID = await this.getDeviceUUID();

      // Интеграция с Yandex Cloud API
      if (this.apiUrl) {
        try {
          const response = await fetch(`${this.apiUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceUUID, version: this.EXTENSION_VERSION })
          });

          const data = await response.json();

          if (response.ok && data.success) {
            // Сохраняем данные с сервера
            const sessionData = {
              deviceUUID: data.deviceUUID || deviceUUID,
              loginTime: new Date().toISOString(),
              subscriptionEndDate: data.subscriptionEndDate || null,
              token: data.token || this._generateToken()
            };
            await this._saveSession(sessionData);

            console.log('[Auth] Успешный вход через API:', deviceUUID);
            return {
              success: true,
              deviceUUID: data.deviceUUID || deviceUUID,
              subscriptionEndDate: data.subscriptionEndDate
            };
          } else {
            console.error('[Auth] Ошибка входа через API:', data.error);
            // Если устройство не зарегистрировано, регистрируем
            if (response.status === 401) {
              return await this.register();
            }
            // Fallback на локальный логин
          }
        } catch (fetchError) {
          console.error('[Auth] Ошибка запроса к API:', fetchError);
        }
      }

      // Локальный логин (fallback или если apiUrl = null)
      // Проверяем существующую сессию
      const result = await chrome.storage.local.get(['authSession']);
      const existingSession = result.authSession;

      // Если сессия существует и UUID совпадает, обновляем время входа
      if (existingSession && existingSession.deviceUUID === deviceUUID) {
        existingSession.loginTime = new Date().toISOString();
        if (subscriptionEndDate) {
          existingSession.subscriptionEndDate = subscriptionEndDate;
        }
        await this._saveSession(existingSession);

        return {
          success: true,
          deviceUUID: deviceUUID,
          subscriptionEndDate: existingSession.subscriptionEndDate
        };
      }

      // Если сессии нет или UUID не совпадает, регистрируем заново
      return await this.register();

    } catch (error) {
      console.error('[Auth] Ошибка при входе:', error);
      return { success: false, error: 'Ошибка при входе' };
    }
  },

  async logout() {
    try {
      await chrome.storage.local.remove(['authSession', 'authUser']);
      // UUID не удаляем, чтобы при следующем запуске устройство было узнано
      return { success: true };
    } catch (error) {
      console.error('[Auth] Ошибка при выходе:', error);
      return { success: false, error: 'Ошибка при выходе' };
    }
  },

  /**
   * Проверка авторизации и валидности сессии
   */
  async checkAuth() {
    try {
      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return false;
      }

      const session = result.authSession;

      // Проверка срока действия сессии (30 дней)
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);

      if (daysSinceLogin > this.SESSION_DURATION_DAYS) {
        // Сессия истекла
        await this.logout();
        return false;
      }

      // Сессия валидна
      return true;

    } catch (error) {
      console.error('[Auth] Ошибка при проверке авторизации:', error);
      return false;
    }
  },

  /**
   * Проверяет, нужно ли обновить подписку (если она истекла или отсутствует)
   * @returns {Promise<boolean>} true если нужно обновить подписку через login
   */
  async shouldRefreshSubscription() {
    try {
      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return true; // Нет сессии - нужно зарегистрироваться/войти
      }

      const session = result.authSession;
      const subscriptionEndDate = session.subscriptionEndDate;

      // Если подписка не установлена - нужно обновить
      if (!subscriptionEndDate) {
        return true;
      }

      // Проверяем, истекла ли подписка (сравниваем только даты, без времени)
      const endDate = new Date(subscriptionEndDate);
      const now = new Date();

      // Устанавливаем время на начало дня для сравнения
      endDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      // Если подписка истекла (дата окончания меньше текущей даты) - нужно обновить
      // Если даты совпадают - подписка еще активна, обновлять не нужно
      return endDate < now;
    } catch (error) {
      console.error('[Auth] Ошибка при проверке необходимости обновления подписки:', error);
      return true; // В случае ошибки лучше обновить
    }
  },

  /**
   * Проверка активной подписки
   * @returns {Promise<boolean>} true если подписка активна (дата окончания >= текущей даты)
   */
  async hasActiveSubscription() {
    try {
      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return false;
      }

      const session = result.authSession;
      const subscriptionEndDate = session.subscriptionEndDate;

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

  /**
   * Получить данные текущего устройства
   */
  async getUser() {
    try {
      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return null;
      }

      // Проверяем валидность сессии
      const isValid = await this.checkAuth();
      if (!isValid) {
        return null;
      }

      return {
        deviceUUID: result.authSession.deviceUUID,
        subscriptionEndDate: result.authSession.subscriptionEndDate,
        registeredAt: result.authSession.registeredAt
      };

    } catch (error) {
      console.error('[Auth] Ошибка при получении данных устройства:', error);
      return null;
    }
  },

  /**
   * Обновить дату окончания подписки (будет вызываться из AWS ответа)
   */
  async updateSubscriptionEndDate(subscriptionEndDate) {
    try {
      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return false;
      }

      result.authSession.subscriptionEndDate = subscriptionEndDate;
      await chrome.storage.local.set({ authSession: result.authSession });

      return true;

    } catch (error) {
      console.error('[Auth] Ошибка при обновлении даты подписки:', error);
      return false;
    }
  },


  /**
   * Генерация токена (для будущей интеграции с AWS)
   * @private
   */
  _generateToken() {
    // Простая генерация токена
    // При интеграции с AWS токен будет приходить с сервера
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  },

  /**
   * Сохранение сессии в chrome.storage
   * @private
   */
  async _saveSession(sessionData) {
    await chrome.storage.local.set({
      authSession: sessionData,
      authUser: {
        deviceUUID: sessionData.deviceUUID,
        subscriptionEndDate: sessionData.subscriptionEndDate
      }
    });
  }
};

