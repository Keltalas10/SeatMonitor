// websocketInterceptor.js — внедряется в страницу через <script src="...">
(function() {
  'use strict';

  if (window.__wsInterceptorInstalled) return;
  window.__wsInterceptorInstalled = true;

  console.log('[Interceptor] Установка перехватчика WebSocket');

  const OriginalWebSocket = window.WebSocket;

  window.WebSocket = function(...args) {
    const ws = new OriginalWebSocket(...args);

    // Перехватываем входящие сообщения
    const originalOnMessage = ws.onmessage;
    ws.onmessage = function(event) {
      // Вызываем оригинальный обработчик, если был
      if (originalOnMessage) {
        originalOnMessage.call(this, event);
      }

      try {
        const payload = event.data;
        if (typeof payload === 'string') {
          const jsonStart = payload.indexOf('[');
          if (jsonStart !== -1) {
            const jsonString = payload.substring(jsonStart);
            const data = JSON.parse(jsonString);

            // --- Обработка действий после ставки ---
            if (data[0] && data[0].includes && data[0].includes('from:game:emitAfterBet')) {
              const actionCode = data[1]?.model?.myStatus?.lastAction;
              if (actionCode) {
                const actionToSound = {
                  1: 'check',
                  2: 'call',
                  3: 'fold',
                  4: 'raise',
                  5: 'all-in',
                  6: 'bet'
                };
                const soundName = actionToSound[actionCode];
                if (soundName) {
                  window.postMessage({
                    type: 'wsEvent',
                    sound: soundName,
                    volume: 1.0
                  }, '*');
                }
              }
            }

            // --- Обработка смены раунда ---
            if (data[0] && data[0].includes && data[0].includes('from:game:changeRound') &&
                data[1]?.currentRound !== undefined && data[1].currentRound !== null) {
              window.postMessage({
                type: 'wsEvent',
                sound: 'round',
                volume: 0.8
              }, '*');
            }
          }
        }
      } catch (e) {
        // игнорируем ошибки парсинга
      }
    };

    return ws;
  };

  // Копируем статические свойства и прототип
  for (let key in OriginalWebSocket) {
    if (OriginalWebSocket.hasOwnProperty(key)) {
      window.WebSocket[key] = OriginalWebSocket[key];
    }
  }
  window.WebSocket.prototype = OriginalWebSocket.prototype;

  console.log('[Interceptor] Перехватчик установлен');
})();