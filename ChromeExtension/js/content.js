// Seat Monitor - Content Script
// Главный файл, который инициализирует все модули

// Seat Monitor - Content Script
// Главный файл, который инициализирует все модули и добавляет кнопку для открытия popup

(function () {
  'use strict';

  /**
   * Добавляет на страницу кнопку для открытия системного popup
   */
  function injectOpenPopupButton() {
    // Проверяем, не добавлена ли уже кнопка
    if (document.getElementById('seat-monitor-open-popup')) return;

    const btn = document.createElement('button');
    btn.id = 'seat-monitor-open-popup';
    btn.textContent = '🪑';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      padding: 8px 14px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-size: 14px;
    `;
    document.body.appendChild(btn);

    // При клике отправляем сообщение в background
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });
  }

  /**
   * Инициализирует расширение (ваш существующий код)
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

      // Добавляем кнопку для открытия popup (новая функциональность)
      injectOpenPopupButton();
      console.log('[Content] Кнопка открытия popup добавлена');

    } catch (error) {
      console.error('[Content] Ошибка при инициализации:', error);
    }
  }

  // Запускаем инициализацию
  init();

})();

