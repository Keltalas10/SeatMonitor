// Основная логика мониторинга элементов

const SeatMonitor = {
  monitoringInterval: null, // ID интервала мониторинга
  mutationObserver: null, // Наблюдатель за изменениями DOM
  monitoringStatus: null,
  // Отслеживаемые места для режима target-players (playerId -> { parentSelector, index })

  /**
   * Запускает мониторинг элементов
   */
  async start() {
    // Если мониторинг уже запущен, не запускаем повторно
    if (this.monitoringInterval !== null) {
      return;
    }

    // Проверка активной подписки перед запуском
    if (typeof Auth !== 'undefined' && Auth.hasActiveSubscription) {
      const hasSubscription = await Auth.hasActiveSubscription();
      if (!hasSubscription) {
        if (SeatMonitorConfig.logActions) {
          console.log('[Seat Monitor] Мониторинг не может быть запущен: требуется активная подписка');
        }
        SeatMonitorConfig.enabled = false;
        return;
      }
    }

    if (SeatMonitorConfig.logActions) {
      console.log('[Seat Monitor] Мониторинг запущен');
      console.log(`[Seat Monitor] Селектор: ${SeatMonitorConfig.selector}`);
      console.log(`[Seat Monitor] Интервал проверки: ${SeatMonitorConfig.checkInterval}мс`);
    }

    // Включаем мониторинг в конфиге
    SeatMonitorConfig.enabled = true;
    // Запускаем мониторинг сразу
    this.checkElements();

    // Запускаем периодическую проверку
    this.monitoringInterval = setInterval(() => {
      // Проверяем подписку при каждой итерации
      if (typeof Auth !== 'undefined' && Auth.hasActiveSubscription) {
        Auth.hasActiveSubscription().then(hasSubscription => {
          if (!hasSubscription) {
            this.stop();
            if (SeatMonitorConfig.logActions) {
              console.log('[Seat Monitor] Мониторинг остановлен: подписка истекла');
            }
          } else {
            this.checkElements();
          }
        });
      } else {
        this.checkElements();
      }
    }, SeatMonitorConfig.checkInterval);
    this._monitoring(SeatMonitorConfig.isSeat);
  },

  /**
   * Останавливает мониторинг
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    // Очищаем отслеживаемые места в зависимости от режима
    if (SeatMonitorConfig.mode === 'target-players' && typeof TargetPlayerMonitor !== 'undefined') {
      TargetPlayerMonitor.trackedSeats.clear();
    }

    // Отключаем мониторинг в конфиге
    SeatMonitorConfig.enabled = false;
    this._closeMonitoringStatus();
    if (SeatMonitorConfig.logActions) {
      console.log('[Seat Monitor] Мониторинг остановлен');
    }
  },

  /**
   * Проверяет элементы на странице
   */
  checkElements() {
    if (!SeatMonitorConfig.enabled) {
      return;
    }

    try {
      if (SeatMonitorConfig.mode === 'target-players') {
        TargetPlayerMonitor.checkTargetPlayers();
      } else {
        // Режим first-available (по умолчанию)
        AvailableMonitor.checkFirstAvailable();
      }
    } catch (e) {
      if (SeatMonitorConfig.logActions) {
        console.error(`[Seat Monitor] Ошибка при мониторинге:`, e);
      }
    }
  },
  // Множество уже обработанных элементов

  /**
   * Обрабатывает один элемент
   * @private
   * @param {HTMLElement} element - Элемент для обработки
   */
  _processElement(element) {

    // Проверяем, видим ли элемент
    if (!ElementUtils.isElementVisible(element)) {
      return;
    }

    // Кликаем по элементу
    if (ClickHandler.clickElement(element, SeatMonitorConfig.logActions)) {
      // После успешного клика обрабатываем popup
      this._logElementClicked();
      // Обрабатываем popup после клика на seat
      if (!SeatMonitorConfig.isSeat) {
        this.stop();
        this._notifyElementClicked(false);
        return;
      }
      PopupHandler.handlePopupAfterSeatClick(SeatMonitorConfig.logActions)
        .then(() => {
          this.stop();
          this._notifyElementClicked(true);
        })
        .catch((e) => {
          if (SeatMonitorConfig.logActions) {
            console.error('[Seat Monitor] Ошибка при обработке popup:', e);
          }
          this.stop();
        });

      return; // Выходим, так как мониторинг будет остановлен
    }
  },

  /**
   * Логирует клик по элементу
   * @private
   */
  _logElementClicked() {
    if (SeatMonitorConfig.logActions) {
      const now = new Date().toLocaleTimeString();
      console.log(`[${now}] [Seat Monitor] Найден и кликнут элемент 'seat-undefined'`);
      console.log(`[${now}] [Seat Monitor] Мониторинг остановлен`);
    }
  },

  /**
   * Показывает popup с сообщением о занятии места
   * @private
   */
  _notifyElementClicked(isSeat) {
    // Создаем полноэкранный overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.7);
      z-index: 999999;
      display: flex;
      justify-content: center;
      align-items: center;
      opacity: 1;
    `;

    // Создаем popup окно
    const popup = document.createElement('div');
    popup.style.cssText = `
      background-color: #28a745;
      color: white;
      padding: 40px 60px;
      border-radius: 10px;
      font-size: 32px;
      font-weight: bold;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      cursor: pointer;
    `;
    popup.textContent = isSeat ? '✅ Занято место!' : '✅ Найдено место!';

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Функция для закрытия
    const closeOverlay = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    // Закрываем по клику на overlay
    overlay.addEventListener('click', closeOverlay);

    // Останавливаем всплытие клика на popup
    popup.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOverlay();
    });

  },

  _monitoring(isSeat) {
    // Создаем overlay для popup (прозрачный фон для позиционирования)
    const popupOverlay = document.createElement('div');

    // Стили overlay - только для позиционирования
    Object.assign(popupOverlay.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: '2147483647', // Максимальный z-index
      pointerEvents: 'none' // Пропускаем клики сквозь
    });

    // Создаем сам popup
    const popup = document.createElement('div');

    // Стили popup
    Object.assign(popup.style, {
      backgroundColor: isSeat ? '#28a745' : '#ffc107',
      color: isSeat ? 'white' : '#212529',
      padding: '5px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: 'bold',
      textAlign: 'center',
      boxShadow: '0 6px 25px rgba(0, 0, 0, 0.3)',
      pointerEvents: 'auto', // Включаем клики для popup
      cursor: 'pointer',
      maxWidth: '350px',
      wordBreak: 'break-word',
      border: '2px solid ' + (isSeat ? '#1e7e34' : '#e0a800'),
      animation: 'fadeIn 0.3s ease'
    });

    popup.textContent = '✅ Мониторинг включен';

    // Собираем структуру
    popupOverlay.appendChild(popup);
    document.body.appendChild(popupOverlay);

    // Сохраняем ссылку если нужно управлять извне
    this.monitoringStatus = popupOverlay;
  },

  // Функция для закрытия
  _closeMonitoringStatus() {
    setTimeout(() => {
      if (this.monitoringStatus.parentNode) {
        this.monitoringStatus.parentNode.removeChild(this.monitoringStatus);
      }
    }, 300);
  },
  /**
   * Получает статистику
   * @returns {Object} Статистика мониторинга
   */
  getStats() {
    return {
      enabled: SeatMonitorConfig.enabled,
      clickedCount: 0 // История не хранится, всегда 0
    };
  }
};

