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
        case 'setTargetColor':
          this._handleSetTargetColor(request.color, sendResponse);
          break;
        case 'setTargetColors':
          this._handleSetTargetColors(request.colors, sendResponse);
          break;
        case 'setCheckInterval':
          this._handleSetCheckInterval(request.interval, sendResponse);
          break;
        case 'setSeatTimeout':
          this._handleSetSeatTimeout(request.interval, sendResponse);
          break;
        case 'setIsSeat':
          this._handleSetIsSeat(request.checked, sendResponse);
          break;
        case 'setVpipStatus':
          this._handleSetVpipStatus(request.status, sendResponse);
          break;
        case 'setVpipValue':
          this._handleSetVpipValue(request.value, sendResponse);
          break;
        case 'setStackStatus':
          this._handleSetStackStatus(request.status, sendResponse);
          break;
        case 'setStackValue':
          this._handleSetStackValue(request.value, sendResponse);
          break;
        case 'setBuyInValue':
          this._handleSetBuyInValue(request.value, sendResponse);
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
      SeatMonitor.stop();
      sendResponse({ enabled: false });
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

    const stats = SeatMonitor.getStats();
    const response = {
      ...stats,
    };
    console.log('[MessageHandler] Отправка ответа:', response);
    sendResponse(response);
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
  async _handleSetSeatTimeout(interval, sendResponse) {
    if (!interval || interval < 100 || interval > 10000) {
      sendResponse({ success: false, error: 'Интервал должен быть от 100 до 10000 мс' });
      return;
    }

    SeatMonitorConfig.seatTimeout = interval;

    // Сохраняем интервал в storage
    try {
      await chrome.storage.local.set({ seatTimeout: interval });
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
  },
  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetStackStatus(status, sendResponse) {
    SeatMonitorConfig.stackStatus = status;
    sendResponse({ success: true });
  },

  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetStackValue(value, sendResponse) {
    SeatMonitorConfig.stackValue = value;
    sendResponse({ success: true });
  },

  /**
 * Обрабатывает изменение интервала проверки
 * @private
 */
  async _handleSetBuyInValue(value, sendResponse) {
    SeatMonitorConfig.buyInBB = value;
    sendResponse({ success: true });
  }
};

