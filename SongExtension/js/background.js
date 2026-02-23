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

chrome.action.onClicked.addListener((tab) => {
  const targetTabId = tab.id;

  chrome.debugger.attach({ tabId: targetTabId }, "1.3", () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }

    console.log(`Отладчик подключен к вкладке ${targetTabId}`);
    chrome.debugger.sendCommand({ tabId: targetTabId }, "Network.enable");

    // Воспроизводим звук подключения
    playSound('check', 0.5); // Просто тестовый звук
  });
});

// Слушаем события
chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Network.webSocketFrameReceived") {
    const jsonStartIndex = params.response.payloadData.indexOf('[');
    if (jsonStartIndex !== -1) {
      const jsonString = params.response.payloadData.substring(jsonStartIndex);
      try {
        const data = JSON.parse(jsonString);
        console.log(jsonString);

        // Обработка действий после ставки
        if (data[0].includes("from:game:emitAfterBet")) {
          const actionCode = data[1].model.lastAction;
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
        console.error('Ошибка парсинга:', error);
      }
    }
  }
});