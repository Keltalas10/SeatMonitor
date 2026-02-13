// Background Service Worker для обработки уведомлений

/**
 * Создает простую иконку для уведомления через canvas
 * @returns {Promise<string>} Data URL иконки
 */
async function createNotificationIcon() {
  return new Promise((resolve) => {
    const canvas = new OffscreenCanvas(48, 48);
    const ctx = canvas.getContext('2d');

    // Рисуем зеленый круг
    ctx.fillStyle = '#28a745';
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, 2 * Math.PI);
    ctx.fill();

    // Рисуем галочку
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(16, 24);
    ctx.lineTo(22, 30);
    ctx.lineTo(32, 18);
    ctx.stroke();

    // Конвертируем в blob и создаем data URL
    canvas.convertToBlob({ type: 'image/png' }).then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  });
}

// Обработчик сообщений от content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showBuyInNotification') {
    showBuyInNotification(sender.tab?.id);
    sendResponse({ success: true });
  }
  return true; // Асинхронный ответ
});

/**
 * Показывает уведомление о клике на buy-in
 * @param {number} tabId - ID вкладки
 */
async function showBuyInNotification(tabId) {
  try {
    // Подсвечиваем вкладку и переключаемся на неё
    if (tabId) {
      try {
        // Получаем информацию о вкладке
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId) {
          // Подсвечиваем вкладку в её окне
          await chrome.tabs.highlight({
            windowId: tab.windowId,
            tabs: [tab.index]
          });

          // Также активируем окно (если оно не активно)
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      } catch (tabError) {
        // Если не удалось подсветить, просто обновляем вкладку
        await chrome.tabs.update(tabId, { highlighted: true });
      }
    }

    // Создаем простую иконку через canvas, если её нет
    let iconUrl = chrome.runtime.getURL('icon48.png');

    // Если иконки нет, создаем её программно
    try {
      // Проверяем, существует ли файл иконки
      await fetch(iconUrl);
    } catch (e) {
      // Если иконки нет, создаем простую через canvas
      iconUrl = await createNotificationIcon();
    }

    // Показываем системное уведомление
    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: iconUrl,
      title: '🎯 Seat Monitor',
      message: 'Mecто найдено!',
      priority: 2
    });

    // Автоматически закрываем уведомление через 3 секунды
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 3000);
  } catch (error) {
    console.error('[Background] Ошибка при показе уведомления:', error);
  }
}

