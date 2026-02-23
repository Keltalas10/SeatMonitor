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

    const wasEnabled = SeatMonitorConfig.enabled;

    // Если выключаем - всегда разрешаем
    if (wasEnabled) {
      SeatMonitorConfig.enabled = false;
      EventMonitor.stop();
      sendResponse({ enabled: false });
      return;
    }

    SeatMonitorConfig.enabled = true;

    if (SeatMonitorConfig.logActions) {
      console.log(`[Seat Monitor] Мониторинг включен`);
    }
    EventMonitor.start(); // Запускаем заново

    sendResponse({ enabled: true });
  },

  /**
   * Обрабатывает запрос статуса
   * @private
   */
  async _handleGetStatus(sendResponse) {
    console.log('[MessageHandler] _handleGetStatus вызван');

    const stats = EventMonitor.getStats();
    const response = {
      ...stats,
    };
    console.log('[MessageHandler] Отправка ответа:', response);
    sendResponse(response);
  }
};

