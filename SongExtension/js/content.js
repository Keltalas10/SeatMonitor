// Seat Monitor - Content Script
// Главный файл, который инициализирует все модули

(function () {
  'use strict';

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
  }

  // Запускаем инициализацию
  init();

})();

