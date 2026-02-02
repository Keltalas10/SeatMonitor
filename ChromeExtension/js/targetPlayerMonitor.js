const TargetPlayerMonitor = {
  trackedSeats: new Set(), // Set строк вида "${parentSelector}:${index}"

  checkTargetPlayers() {
    if (SeatMonitorConfig.logActions) {
      console.log('[Seat Monitor] Режим: отслеживание целевых игроков');
    }
    this.addNewTrackedSeats();
    // 2. Проверяем уже отслеживаемые места на освобождение
    this.checkTrackedSeats();
  },

  checkTrackedSeats() {
    if (this.trackedSeats.size === 0) { return; }
    AvailableMonitor.checkFirstAvailable();
  },

  /**
   * Конвертирует HEX цвет в RGB формат
   * @private
   * @param {string} hex - HEX цвет (например, #F41317 или #f41317)
   * @returns {string} RGB цвет (например, rgb(244, 19, 23))
   */
  _hexToRgb(hex) {
    // Убираем # если есть
    hex = hex.replace('#', '');

    // Конвертируем короткий формат (#F41 -> #FF4411)
    if (hex.length === 3) {
      hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `rgb(${r}, ${g}, ${b})`;
  },

  /**
   * Проверяет, соответствует ли цвет в style целевому цвету
   * @param {string} style - Строка стиля элемента
   * @param {string} targetColor - Целевой цвет (может быть HEX или RGB)
   * @returns {boolean}
   */
  colorMatches(style, targetColor) {
    if (!style || !targetColor) return false;

    // Если цвет в HEX формате, конвертируем в RGB
    let rgbColor = targetColor;
    if (targetColor.startsWith('#')) {
      rgbColor = this._hexToRgb(targetColor);
    }

    // Проверяем оба формата (RGB и HEX)
    return style.includes(targetColor) || style.includes(rgbColor);
  },

  addNewTrackedSeats() {
    // Используем цвет из конфига
    this.trackedSeats = new Set();
    const targetColors = SeatMonitorConfig.selectedTargetColors;
    if(targetColors.size === 0){
      return;
    }
    // Находим все элементы с border и проверяем цвет программно
    const allProfileNames = document.querySelectorAll('div.profileName[style*="border"]');
    const matchingPlayers = Array.from(allProfileNames).filter(playerProfileDiv => {
      const style = playerProfileDiv.getAttribute('style') || '';
      // Проверяем, содержит ли style нужный цвет (поддерживаем HEX и RGB)
      return Array.from(targetColors).some(color => 
        this.colorMatches(style, color));
    });

    matchingPlayers.forEach(playerProfileDiv => {
      const gameSeatDiv = playerProfileDiv.closest("div[class*='game-seat']");
      if (gameSeatDiv) {
        const classList = Array.from(gameSeatDiv.classList);
        const seatClass = classList.find(cls => cls.startsWith('seat-') && cls !== 'seat-undefined');

        if (seatClass) {
          const seatIndex = this._getSeatIndex(gameSeatDiv);
          if (seatIndex) {
            const seatKey = `${seatIndex.parentSelector}:${seatIndex.index}`;

            // Добавляем только если еще не отслеживаем
            if (!this.trackedSeats.has(seatKey)) {
              this.trackedSeats.add(seatKey);
              if (SeatMonitorConfig.logActions) {
                console.log(`[Seat Monitor] Добавлено новое место для отслеживания (индекс: ${seatIndex.index})`);
              }
            }
          }
        }
      }
    });
  },
  /**
   * Получает индекс элемента относительно родителя-контейнера
   * @private
   * @param {HTMLElement} seat - Элемент места
   * @returns {{parentSelector: string, index: number}|null}
   */
  _getSeatIndex(seat) {
    // Находим родительский контейнер, который содержит все места
    let container = seat.parentElement;
    if (!container) return null;

    // Поднимаемся вверх по DOM дереву, пока не найдем контейнер с несколькими game-seat
    while (container && container !== document.body) {
      const seatsInContainer = container.querySelectorAll("div[class*='game-seat']");
      if (seatsInContainer.length > 1) {
        // Нашли контейнер с несколькими местами
        const allSeats = Array.from(seatsInContainer);
        const index = allSeats.indexOf(seat);

        if (index === -1) return null;

        // Генерируем селектор для родителя
        let parentSelector = '';
        if (container.id) {
          parentSelector = `#${container.id}`;
        } else if (container.className) {
          // Берем первый класс
          const firstClass = container.className.split(' ')[0];
          if (firstClass) {
            parentSelector = `.${firstClass}`;
          }
        }

        // Если не нашли подходящий селектор, используем тег
        if (!parentSelector) {
          parentSelector = container.tagName.toLowerCase();
        }

        return { parentSelector, index };
      }
      container = container.parentElement;
    }

    return null;
  },

  /**
   * Находит элемент места по индексу относительно родителя
   * @private
   * @param {string} parentSelector - Селектор родительского контейнера
   * @param {number} index - Индекс элемента
   * @returns {HTMLElement|null}
   */
  _findSeatByIndex(parentSelector, index) {
    const parent = document.querySelector(parentSelector);
    if (!parent) return null;

    const seats = Array.from(parent.querySelectorAll("div[class*='game-seat']"));
    return seats[index] || null;
  },

}