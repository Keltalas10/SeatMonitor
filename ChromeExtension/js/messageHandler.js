// Обработчик сообщений от popup или background script

const MessageHandler = {
  /**
   * Инициализирует обработчик сообщений
   */
  init() {
    console.log('[MessageHandler] init вызван');

    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.error('[MessageHandler] chrome или chrome.runtime не определен');
      return;
    }

    console.log('[MessageHandler] Регистрация обработчика сообщений');
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[MessageHandler] Получено сообщение:', request);

      switch (request.action) {
        case 'toggle':
          this._handleToggle(sendResponse);
          break;
        case 'getStatus':
          console.log('[MessageHandler] Обработка getStatus');
          this._handleGetStatus(sendResponse);
          break;
        case 'getMode':
          this._handleGetMode(sendResponse);
          break;
        case 'setMode':
          this._handleSetMode(request.mode, sendResponse);
          break;
        case 'setTargetColor':
          this._handleSetTargetColor(request.color, sendResponse);
          break;
        case 'setTargetColors':
          this._handleSetTargetColors(request.colors, sendResponse);
          break;
        case 'setCheckInterval':
          this._handleSetCheckInterval(request.interval, sendResponse);
          break;
        case 'setIsSeat':
          this._handleSetIsSeat(request.checked, sendResponse);
          break;
        case 'setVpipStatus':
          this._handleSettVpipStatus(request.checked, sendResponse);
          break;
        case 'setVpipValue':
          this._handleSetVpipValue(request.value, sendResponse);
          break;
        default:
          console.log('[MessageHandler] Неизвестное действие:', request.action);
          sendResponse({ error: 'Unknown action' });
      }
      return true; // Асинхронный ответ
    });

    console.log('[MessageHandler] Обработчик сообщений зарегистрирован');
  },

  /**
   * Обрабатывает переключение мониторинга
   * @private
   */
  async _handleToggle(sendResponse) {
    // Проверка авторизации перед выполнением действий
    const isAuth = await this._checkAuth();
    if (!isAuth) {
      sendResponse({
        enabled: false,
        error: 'Требуется авторизация',
        requiresAuth: true
      });
      return;
    }

    // Проверка активной подписки перед включением мониторинга
    const hasSubscription = await this._checkSubscription();
    if (!hasSubscription && !SeatMonitorConfig.enabled) {
      // Пытаемся включить мониторинг, но подписка неактивна
      sendResponse({
        enabled: false,
        error: 'Требуется активная подписка для работы мониторинга',
        requiresSubscription: true
      });
      return;
    }

    const wasEnabled = SeatMonitorConfig.enabled;

    // Если выключаем - всегда разрешаем
    if (wasEnabled) {
      SeatMonitorConfig.enabled = false;
      SeatMonitor.stop();
      sendResponse({ enabled: false });
      return;
    }

    // Если включаем - проверяем подписку еще раз
    if (!hasSubscription) {
      sendResponse({
        enabled: false,
        error: 'Требуется активная подписка для работы мониторинга',
        requiresSubscription: true
      });
      return;
    }

    SeatMonitorConfig.enabled = true;

    if (SeatMonitorConfig.logActions) {
      console.log(`[Seat Monitor] Мониторинг включен`);
    }
    SeatMonitor.start(); // Запускаем заново

    sendResponse({ enabled: true });
  },

  /**
   * Обрабатывает запрос статуса
   * @private
   */
  async _handleGetStatus(sendResponse) {
    console.log('[MessageHandler] _handleGetStatus вызван');

    // Проверка авторизации
    const isAuth = await this._checkAuth();
    console.log('[MessageHandler] Авторизация:', isAuth);

    if (!isAuth) {
      console.log('[MessageHandler] Отправка ответа: requiresAuth');
      sendResponse({
        enabled: false,
        requiresAuth: true
      });
      return;
    }

    // Проверка подписки
    const hasSubscription = await this._checkSubscription();
    console.log('[MessageHandler] Подписка:', hasSubscription);

    if (!hasSubscription) {
      // Если подписка неактивна, но мониторинг включен - выключаем его
      if (SeatMonitorConfig.enabled) {
        SeatMonitorConfig.enabled = false;
        SeatMonitor.stop();
      }
      console.log('[MessageHandler] Отправка ответа: requiresSubscription');
      sendResponse({
        enabled: false,
        requiresSubscription: true
      });
      return;
    }

    const stats = SeatMonitor.getStats();
    const response = {
      ...stats,
      mode: SeatMonitorConfig.mode || 'first-available'
    };
    console.log('[MessageHandler] Отправка ответа:', response);
    sendResponse(response);
  },

  /**
   * Проверка авторизации
   * @private
   */
  async _checkAuth() {
    try {
      // Используем Auth модуль, если доступен
      if (typeof Auth !== 'undefined' && Auth.checkAuth) {
        return await Auth.checkAuth();
      }

      // Fallback: проверка напрямую через storage
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return false;
      }

      const result = await chrome.storage.local.get(['authSession']);

      if (!result.authSession) {
        return false;
      }

      const session = result.authSession;
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);

      // Проверка срока действия сессии (30 дней)
      if (daysSinceLogin > 30) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[MessageHandler] Ошибка при проверке авторизации:', error);
      return false;
    }
  },

  /**
   * Проверка активной подписки
   * @private
   */
  async _checkSubscription() {
    try {
      // Используем Auth модуль, если доступен
      if (typeof Auth !== 'undefined' && Auth.hasActiveSubscription) {
        return await Auth.hasActiveSubscription();
      }

      // Fallback: проверка напрямую через storage
      if (typeof chrome === 'undefined' || !chrome.storage) {
        return false;
      }

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
      console.error('[MessageHandler] Ошибка при проверке подписки:', error);
      return false;
    }
  },

  /**
   * Обрабатывает запрос текущего режима
   * @private
   */
  _handleGetMode(sendResponse) {
    sendResponse({
      mode: SeatMonitorConfig.mode || 'first-available'
    });
  },

  /**
   * Обрабатывает изменение режима
   * @private
   */
  async _handleSetMode(mode, sendResponse) {
    if (mode !== 'first-available' && mode !== 'target-players') {
      sendResponse({ success: false, error: 'Неверный режим' });
      return;
    }

    SeatMonitorConfig.mode = mode;

    // Сохраняем режим в storage
    try {
      await chrome.storage.local.set({ monitorMode: mode });
    } catch (error) {
      console.error('[MessageHandler] Ошибка при сохранении режима:', error);
    }

    // Если мониторинг включен, перезапускаем его с новым режимом
    if (SeatMonitorConfig.enabled) {
      SeatMonitor.stop();
      SeatMonitor.start();
    }

    if (SeatMonitorConfig.logActions) {
      console.log(`[MessageHandler] Режим изменен на: ${mode}`);
    }

    sendResponse({ success: true, mode: mode });
  },

  /**
   * Обрабатывает изменение цвета для целевых игроков
   * @private
   */
  async _handleSetTargetColor(color, sendResponse) {
    if (!color) {
      sendResponse({ success: false, error: 'Цвет не указан' });
      return;
    }

    if (SeatMonitorConfig.selectedTargetColors.has(color)) {
      SeatMonitorConfig.selectedTargetColors.delete(color);
    } else {
      SeatMonitorConfig.selectedTargetColors.add(color);
    }

    if (SeatMonitorConfig.logActions) {
      console.log(`[MessageHandler] Цвет изменен на: ${color}`);
    }

    sendResponse({ success: true, color: color });
  },

  /**
 * Обрабатывает изменение цвета для целевых игроков
 * @private
 */
  async _handleSetTargetColors(colors, sendResponse) {
    if (!colors) {
      sendResponse({ success: false, error: 'Цвет не указан' });
      return;
    }

    SeatMonitorConfig.selectedTargetColors = new Set([...colors]);

    sendResponse({ success: true, color: colors });
  },

  /**
   * Обрабатывает изменение интервала проверки
   * @private
   */
  async _handleSetCheckInterval(interval, sendResponse) {
    if (!interval || interval < 100 || interval > 10000) {
      sendResponse({ success: false, error: 'Интервал должен быть от 100 до 10000 мс' });
      return;
    }

    SeatMonitorConfig.checkInterval = interval;

    // Сохраняем интервал в storage
    try {
      await chrome.storage.local.set({ checkInterval: interval });
    } catch (error) {
      console.error('[MessageHandler] Ошибка при сохранении интервала:', error);
    }

    // Если мониторинг включен, перезапускаем его с новым интервалом
    if (SeatMonitorConfig.enabled) {
      SeatMonitor.stop();
      SeatMonitor.start();
    }

    if (SeatMonitorConfig.logActions) {
      console.log(`[MessageHandler] Интервал изменен на: ${interval}мс`);
    }

    sendResponse({ success: true, interval: interval });
  },

  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetIsSeat(checked, sendResponse) {

    SeatMonitorConfig.isSeat = checked;
    sendResponse({ success: true, checked: checked });
  },

  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetVpipStatus(status, sendResponse) {
    SeatMonitorConfig.vpipStatus = status;
    sendResponse({ success: true });
  },

  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetVpipValue(value, sendResponse) {
    SeatMonitorConfig.vpipValue = value;
    sendResponse({ success: true });
  }
};

