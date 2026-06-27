// Обработчик сообщений от content script


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "onSounds") {
    // Сначала пробуем отсоединить, если было подключено
    chrome.tabs.query({ url: '*://game.r-gaming.com/*', active: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;

      const targetTabId = activeTab.id;
      await chrome.debugger.detach({ tabId: targetTabId }).catch(() => {
        // Ошибка означает, что не было подключено - игнорируем
        console.log('Отладчик не был подключен, продолжаем...');
      });
      // 2. Подключаем debugger
      chrome.debugger.attach({ tabId: targetTabId }, "1.3", () => {
        if (chrome.runtime.lastError) {
          console.error("Ошибка подключения:", chrome.runtime.lastError.message);
          return;
        }

        console.log(`Отладчик подключен к вкладке ${targetTabId}`);
        chrome.debugger.sendCommand({ tabId: targetTabId }, "Network.enable", () => {
          // Воспроизводим звук подключения ПОСЛЕ включения Network
          playSound('check', 0.5);
        });
      });
    });

    return true; // Держим канал открытым для асинхронности
  }
  if (request.action === "offSounds") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab) return;

      const targetTabId = activeTab.id;

      try {
        // Проверяем, есть ли вообще отладчик на этой вкладке
        const targets = await chrome.debugger.getTargets();
        const isAttached = targets.some(t => t.tabId === targetTabId && t.attached);

        if (!isAttached) {
          console.log(`Отладчик не был подключен к вкладке ${targetTabId}`);
          return;
        }

        // Пробуем отключить Network (может быть уже отключено)
        try {
          await chrome.debugger.sendCommand({ tabId: targetTabId }, "Network.disable");
          console.log(`Network отключен для вкладки ${targetTabId}`);
        } catch (e) {
          console.log("Network уже был отключен");
        }

        // Отсоединяем отладчик
        await chrome.debugger.detach({ tabId: targetTabId });
        console.log(`Отладчик отсоединен от вкладки ${targetTabId}`);

      } catch (error) {
        console.error("Ошибка при отключении:", error);
      }
    });

    return true;
  }
  if (request.action === 'showBuyInNotification') {
    showBuyInNotification(sender.tab?.id);
    sendResponse({ success: true });
  }

  if (request.action === 'openPopup') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      // Если нет tabId, пробуем открыть обычный popup
      chrome.action.openPopup().catch(() => { });
      sendResponse({ success: true });
      return true;
    }

    chrome.action.openPopup()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        // Fallback: открываем окно с tabId в URL
        const url = chrome.runtime.getURL('html/main/popup.html');
        chrome.windows.create({
          url: url,
          type: 'popup',
          width: 400,
          height: 600
        }, () => sendResponse({ success: true, fallback: true }));
      });
    return true;
  }
  return true; // Асинхронный ответ
});



// Управление offscreen документом
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({});
  const offscreenDocument = existingContexts.find(
    context => context.contextType === 'OFFSCREEN_DOCUMENT'
  );

  if (!offscreenDocument) {
    await chrome.offscreen.createDocument({
      url: 'html/offscreen/offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Воспроизведение звуков покера'
    });
  }
}

// Функция воспроизведения звука
async function playSound(soundName, volume = 1.0) {
  try {
    await ensureOffscreenDocument();

    await chrome.runtime.sendMessage({
      type: 'playSound',
      sound: soundName,
      volume: volume
    });

    console.log(`Запрос на воспроизведение звука: ${soundName}`);
  } catch (error) {
    console.error('Ошибка воспроизведения звука:', error);
  }
}

// Маппинг действий в названия звуков
const actionToSound = {
  1: 'check',
  2: 'call',
  3: 'fold',
  4: 'raise',
  5: 'all-in',
  6: 'bet'
};

// Слушаем события
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.webSocketFrameReceived") {
    chrome.tabs.get(source.tabId, (tab) => {
      const windowId = tab.windowId;

      // Проверяем, активно ли это окно
      chrome.windows.get(windowId, (window) => {
        if (window.focused) {

          const jsonStartIndex = params.response.payloadData.indexOf('[');
          if (jsonStartIndex !== -1) {
            const jsonString = params.response.payloadData.substring(jsonStartIndex);
            try {
              const data = JSON.parse(jsonString);

              // Обработка действий после ставки
              if (data[0].includes("from:game:emitAfterBet")) {
                const actionCode = data[1].model.myStatus.lastAction;
                const soundName = actionToSound[actionCode];

                if (soundName) {
                  // Воспроизводим звук действия
                  playSound(soundName);
                  console.log(`Действие: ${soundName}`);
                }
              }

              // Обработка смены раунда
              if (data[0].includes("from:game:changeRound") &&
                data[1].currentRound !== null) {
                console.log(data[1].currentRound);

                // Воспроизводим звук смены раунда
                playSound('round', 0.8);
              }

            } catch (error) {
              console.log('Ошибка парсинга:', error);
            }
          }
        }
      }
      )

    })
  }
});
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

