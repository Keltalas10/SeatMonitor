// Seat Monitor - Content Script
// Главный файл, который инициализирует все модули

(function () {
  'use strict';

  console.log('[Content] Content script загружен');
  console.log('[Content] MessageHandler доступен?', typeof MessageHandler !== 'undefined');
  console.log('[Content] SeatMonitorConfig доступен?', typeof SeatMonitorConfig !== 'undefined');

  /**
   * Инициализирует расширение
   */
  async function init() {
    console.log('[Content] Функция init() вызвана');
    try {
      // Инициализируем обработчик сообщений
      console.log('[Content] Инициализация MessageHandler...');
      console.log('[Content] MessageHandler определен?', typeof MessageHandler !== 'undefined');

      if (typeof MessageHandler === 'undefined') {
        console.error('[Content] MessageHandler не определен! Проверьте порядок загрузки скриптов.');
        return;
      }

      console.log('[Content] Вызов MessageHandler.init()...');
      MessageHandler.init();
      console.log('[Content] MessageHandler.init() вызван успешно');
    } catch (error) {
      console.error('[Content] Ошибка при инициализации MessageHandler:', error);
    }

    // Загружаем сохраненный режим мониторинга, цвет и интервал
    try {
      const result = await chrome.storage.local.get(['monitorMode', 'selectedTargetColor', 'checkInterval']);
      if (result.monitorMode && (result.monitorMode === 'first-available' || result.monitorMode === 'target-players')) {
        SeatMonitorConfig.mode = result.monitorMode;
        if (SeatMonitorConfig.logActions) {
          console.log('[Seat Monitor] Загружен режим мониторинга:', result.monitorMode);
        }
      }
      if (result.selectedTargetColor) {
        SeatMonitorConfig.selectedTargetColor = result.selectedTargetColor;
        if (SeatMonitorConfig.logActions) {
          console.log('[Seat Monitor] Загружен цвет целевых игроков:', result.selectedTargetColor);
        }
      }
      if (result.checkInterval && result.checkInterval >= 100 && result.checkInterval <= 10000) {
        SeatMonitorConfig.checkInterval = result.checkInterval;
        if (SeatMonitorConfig.logActions) {
          console.log('[Seat Monitor] Загружен интервал проверки:', result.checkInterval, 'мс');
        }
      }
    } catch (error) {
      console.error('[Seat Monitor] Ошибка при загрузке настроек:', error);
    }

    // Автоматическая регистрация/логин устройства при первой загрузке
    try {
      const isAuth = await Auth.checkAuth();
      if (!isAuth) {
        // Если не авторизован, регистрируем автоматически
        const registerResult = await Auth.register();
        if (registerResult.success) {
          if (SeatMonitorConfig.logActions) {
            console.log('[Seat Monitor] Устройство автоматически зарегистрировано:', registerResult.deviceUUID);
          }
        }
      } else {
        // Проверяем, нужно ли обновить подписку (если она истекла или отсутствует)
        const shouldRefresh = await Auth.shouldRefreshSubscription();
        if (shouldRefresh) {
          if (SeatMonitorConfig.logActions) {
            console.log('[Seat Monitor] Подписка истекла или отсутствует, обновляем через login...');
          }
          await Auth.login();
        } else {
          if (SeatMonitorConfig.logActions) {
            console.log('[Seat Monitor] Подписка активна, логин не требуется');
          }
        }
      }
    } catch (error) {
      console.error('[Seat Monitor] Ошибка при автоматической регистрации:', error);
    }

    // Мониторинг не запускается автоматически
    // Запуск происходит только вручную через popup (кнопка "Включить")
    if (SeatMonitorConfig.logActions) {
      console.log('[Seat Monitor] Расширение загружено. Используйте popup для запуска мониторинга.');
    }
  }

  // Запускаем инициализацию
  init();

})();

