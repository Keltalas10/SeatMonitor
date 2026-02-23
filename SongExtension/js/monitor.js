const EventMonitor = {
  originalWebSocket: window.WebSocket,
  isMonitoring: false,
  pendingWebSockets: [],

  init() {
    console.log('[Song Replacer] WebSocket перехватчик инициализирован', {
      currentWebSocket: window.WebSocket.toString().includes('native code'),
      hasOriginal: !!this.originalWebSocket
    });
    console.log('[Song Replacer] WebSocket перехватчик инициализирован');

    const self = this;
    const OriginalWS = window.WebSocket;

    // Переопределяем WebSocket
    window.WebSocket = function (...args) {
      console.log('[Song Replacer] 🔵 СОЗДАН НОВЫЙ WEBSOCKET:', {
        url: args[0],
        protocols: args[1],
        isMonitoring: self.isMonitoring,
        timestamp: new Date().toISOString()
      });

      try {
        const ws = new OriginalWS(...args);
        ws._monitorUrl = args[0];
        ws._createdAt = new Date().toISOString();

        console.log('[Song Replacer] ✅ Оригинальный WS создан:', {
          readyState: ws.readyState,
          url: ws.url
        });

        // Проверяем, что ws - реальный объект
        if (!ws || typeof ws.send !== 'function') {
          console.log('[Song Replacer] ❌ WS не валидный');
          return ws;
        }

        // Добавляем слушатель открытия соединения
        ws.addEventListener('open', () => {
          console.log('[Song Replacer] 🔓 WebSocket соединение открыто:', args[0]);
        });

        ws.addEventListener('close', () => {
          console.log('[Song Replacer] 🔒 WebSocket соединение закрыто:', args[0]);
        });

        ws.addEventListener('error', (e) => {
          console.log('[Song Replacer] ❌ WebSocket ошибка:', args[0], e);
        });

        if (!self.isMonitoring) {
          console.log('[Song Replacer] ⏳ Мониторинг не активен, сохраняем в очередь');
          self.pendingWebSockets.push(ws);
        } else {
          console.log('[Song Replacer] ⚡ Мониторинг активен, добавляем слушатели сразу');
          self.attachListeners(ws, args[0]);
        }

        return ws;

      } catch (e) {
        console.log('[Song Replacer] ❌ Ошибка создания WebSocket:', e);
        throw e;
      }
    };

    this.originalWebSocket = OriginalWS;
  },

  attachListeners(ws, url) {
    if (ws._isMonitored) {
      console.log('[Song Replacer] ⚠️ WebSocket уже отслеживается');
      return;
    }

    console.log('[Song Replacer] 📍 Добавляем слушатели к WebSocket:', {
      url: url,
      readyState: ws.readyState,
      createdAt: ws._createdAt
    });

    ws._isMonitored = true;

    // Перехватываем send
    const originalSend = ws.send;
    ws.send = function (data) {
      console.log('[Song Replacer] 📤 SEND:', {
        data: typeof data === 'string' ? data : 'бинарные данные',
        type: typeof data,
        isMonitoring: EventMonitor.isMonitoring
      });

      if (EventMonitor.isMonitoring) {
        try {
          chrome.runtime.sendMessage({
            type: 'WEBSOCKET_SENT',
            data: data,
            url: url || ws._monitorUrl
          }, () => {
            if (chrome.runtime.lastError) {
              console.log('[Song Replacer] ⚠️ Ошибка отправки сообщения:', chrome.runtime.lastError);
            }
          });
        } catch (e) {
          console.log('[Song Replacer] ❌ Ошибка в send:', e);
        }
      }
      return originalSend.call(ws, data);
    };

    // Перехватываем message
    ws.addEventListener('message', (event) => {
      console.log('[Song Replacer] 📥 MESSAGE:', {
        data: typeof event.data === 'string' ? event.data : 'бинарные данные',
        type: typeof event.data,
        isMonitoring: EventMonitor.isMonitoring
      });

      if (EventMonitor.isMonitoring) {
        try {
          chrome.runtime.sendMessage({
            type: 'WEBSOCKET_RECEIVED',
            data: event.data,
            url: url || ws._monitorUrl
          }, () => {
            if (chrome.runtime.lastError) {
              console.log('[Song Replacer] ⚠️ Ошибка отправки сообщения:', chrome.runtime.lastError);
            }
          });
        } catch (e) {
          console.log('[Song Replacer] ❌ Ошибка в message:', e);
        }
      }
    });

    console.log('[Song Replacer] ✅ Слушатели добавлены, проверяем состояние:', {
      hasSendInterceptor: ws.send !== originalSend,
      hasMessageListener: true
    });
  },

  processPendingWebSockets() {
    console.log('[Song Replacer] Обработка накопленных WebSocket соединений:', this.pendingWebSockets.length);

    this.pendingWebSockets.forEach((ws, index) => {
      console.log(`[Song Replacer] Обработка ${index}:`, {
        url: ws._monitorUrl,
        readyState: ws.readyState,
        createdAt: ws._createdAt
      });
      this.attachListeners(ws, ws._monitorUrl);
    });

    this.pendingWebSockets = [];
  },

  enableWebSocketMonitoring() {
    console.log('[Song Replacer] 1. enableWebSocketMonitoring ВЫЗВАН!', {
      isMonitoring: this.isMonitoring,
      pendingCount: this.pendingWebSockets.length
    });

    if (this.isMonitoring) {
      console.log('[Song Replacer] 2. Уже мониторинг включен, выход');
      return;
    }

    console.log('[Song Replacer] 3. Начинаю установку перехватчика');
    this.processPendingWebSockets();

    this.isMonitoring = true;
    console.log('[Song Replacer] 8. WebSocket мониторинг включен', {
      isMonitoring: this.isMonitoring
    });
  },

  disableWebSocketMonitoring() {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    console.log('[Song Replacer] WebSocket мониторинг отключен');

    // Не восстанавливаем оригинал, просто перестаем отправлять сообщения
    // (перехватчик остается, но isMonitoring = false блокирует отправку)
  },

  async start() {
    console.log('[Song Replacer] START ВЫЗВАН');

    // Проверка активной подписки
    if (typeof Auth !== 'undefined' && Auth.hasActiveSubscription) {
      const hasSubscription = await Auth.hasActiveSubscription();
      if (!hasSubscription) {
        if (SeatMonitorConfig.logActions) {
          console.log('[Song Replacer] Мониторинг не может быть запущен: требуется активная подписка');
        }
        SeatMonitorConfig.enabled = false;
        return;
      }
    }

    if (SeatMonitorConfig.logActions) {
      console.log('[Song Replacer] Мониторинг запущен');
    }

    SeatMonitorConfig.enabled = true;
    this.enableWebSocketMonitoring();
  },

  stop() {
    SeatMonitorConfig.enabled = false;
    this.disableWebSocketMonitoring();
    if (SeatMonitorConfig.logActions) {
      console.log('[Song Replacer] Мониторинг остановлен');
    }
  },

  getStats() {
    return {
      enabled: SeatMonitorConfig.enabled
    };
  }
};

// ВАЖНО: Инициализируем перехватчик СРАЗУ при загрузке скрипта
EventMonitor.init();