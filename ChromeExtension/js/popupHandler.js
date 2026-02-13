// Обработчик popup после клика на seat

const PopupHandler = {
  isProcessing: false, // Флаг для предотвращения повторных вызовов

  /**
   * Обрабатывает popup после клика на seat
   * @param {boolean} logActions - Логировать ли действия
   */
  async handlePopupAfterSeatClick(logActions = true) {
    // Предотвращаем повторные вызовы
    if (this.isProcessing) {
      if (logActions) {
        console.log('[Seat Monitor] Popup уже обрабатывается, пропускаем повторный вызов');
      }
      return false;
    }

    this.isProcessing = true;// Сбрасываем при новом вызове

    try {
      // Ждем появления popup
      const popup = await this._waitForPopup(logActions);
      if (!popup) {
        if (logActions) {
          console.log('[Seat Monitor] Popup не найден');
        }
        return false;
      }

      // Ждем немного, чтобы popup полностью отобразился
      await this._delay(500);
      // Кликаем на элемент "P5,000"
      const isAmountProcessed = await this.setAmount(popup, logActions);
      if (!isAmountProcessed) {
        if (logActions) {
          console.log('[Seat Monitor] Не удалось установить минимальную сумму');
        }
      }

      if (!SeatMonitorConfig.isSeat) {
        return true;
      }
      // Ждем немного после клика на сумму
      await this._delay(Math.floor(Math.random() * (4000 - 1000 + 1)) + 1500);

      // Кликаем на кнопку "Buy-in" если она disabled
      const buyInClicked = await this._clickBuyInButton(popup, logActions);
      if (!buyInClicked && logActions) {
        console.log('[Seat Monitor] Кнопка Buy-in не найдена или не disabled');
      }

      return buyInClicked;
    } finally {
      // Сбрасываем флаг после завершения обработки
      this.isProcessing = false;
    }
  },

  /**
   * Ожидает появления popup с data-show="true"
   * @private
   * @param {boolean} logActions - Логировать ли действия
   * @returns {Promise<HTMLElement|null>} Элемент popup или null
   */
  _waitForPopup(logActions) {
    return new Promise((resolve) => {
      const maxAttempts = 20; // Максимум 20 попыток (2 секунды)
      let attempts = 0;

      const checkPopup = () => {
        attempts++;

        // Ищем popup: div с data-show="true"
        const popup = document.querySelector('div[data-show="true"]');

        if (popup) {
          if (logActions) {
            console.log('[Seat Monitor] Popup найден');
          }
          resolve(popup);
          return;
        }

        if (attempts >= maxAttempts) {
          if (logActions) {
            console.log('[Seat Monitor] Popup не появился за отведенное время');
          }
          resolve(null);
          return;
        }

        // Проверяем каждые 100мс
        setTimeout(checkPopup, 100);
      };

      checkPopup();
    });
  },

  getDivChildren(element) {
    return Array.from(element.children).filter(child => child.tagName === 'DIV');
  },

  getDivChildrenByPath(element, paths) {
    let currentElement = element;
    for (const path of paths) {
      if (path < 0) {
        currentElement = this.getDivChildren(currentElement);
        if (currentElement.length <= ((path + 1) * -1)) {
          return undefined;
        }
        currentElement = currentElement[currentElement.length + path];
      }
      else {
        currentElement = this.getDivChildren(currentElement);
        if (currentElement.length <= path) {
          return undefined;
        }
        currentElement = currentElement[path];
      }
    }
    return currentElement;
  },

  /**
   * Кликает на первый вариант суммы по структуре вложенности
   * Путь: popup -> div[1] -> div[0] -> div[6] -> div[0]
   * @private
   * @param {HTMLElement} popup - Элемент popup
   * @param {boolean} logActions - Логировать ли действия
   * @returns {Promise<boolean>} true если клик выполнен
   */
  async setAmount(popup, logActions) {
    try {
      const input = document.querySelector("input[placeholder='Deposit Amount']");
      if (!input) {
        if (logActions) {
          console.log('[Seat Monitor] Не найден input[placeholder="Deposit Amount"]');
        }
        return false;
      }
      const minAmountDiv = this.getDivChildrenByPath(popup, [1, 0, 3, 0, 1]);
      if (!minAmountDiv) {
        if (logActions) {
          console.log('[Seat Monitor] Не найден min buy-in value');
        }
        return false;
      }
      const minAmount = minAmountDiv.textContent.trim().replace(',', ''); // "30,000"
      const minBBDiv = this.getDivChildrenByPath(popup, [1, 0, 3, 0]);
      if (!minBBDiv) {
        if (logActions) {
          console.log('[Seat Monitor] Не найден min BB value');
        }
        return false;
      }
      const itemNameDiv = minBBDiv.querySelector('.item-name');
      const minBB = parseInt(itemNameDiv?.nextSibling?.nextSibling?.data);
      // Устанавливаем значение разными способами сразу
      input.value = SeatMonitorConfig.buyInBB ? minAmount / minBB * SeatMonitorConfig.buyInBB : minAmount;
      input.setAttribute('value', minAmount);

      // Принудительно вызываем события
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Даем фокус
      input.focus();
      input.select();

      console.log('Значение установлено:', input.value);
      return true;
    } catch (e) {
      if (logActions) {
        console.error('[Seat Monitor] Ошибка при клике на сумму:', e);
      }
      return false;
    }
  },

  /**
   * Кликает на кнопку "Buy-in" по структуре вложенности
   * Путь: popup -> div[1] -> div[0] -> div[7] (последний div на том же уровне что и контейнер сумм)
   * @private
   * @param {HTMLElement} popup - Элемент popup
   * @param {boolean} logActions - Логировать ли действия
   * @returns {Promise<boolean>} true если клик выполнен
   */
  async _clickBuyInButton(popup, logActions) {
    try {
      // Получаем только div элементы (фильтруем другие теги)

      const buyInButton = this.getDivChildrenByPath(popup, [1, 0, -1]);
      // Проверяем, что это действительно кнопка Buy-in с disabled
      const text = buyInButton.textContent.trim();

      if (text === 'Buy-in') {
        if (logActions) {
          console.log('[Seat Monitor] Найдена кнопка Buy-in по структуре вложенности');
          console.log('[Seat Monitor] Путь: popup -> div[1] -> div[0] -> div[последний]');
          console.log('[Seat Monitor] Элемент:', buyInButton);
        }

        // Кликаем на кнопку
        if (ClickHandler.clickElement(buyInButton, logActions)) {
          if (logActions) {
            console.log('[Seat Monitor] Клик на кнопку Buy-in выполнен');
          }

          return true;
        }
      } else {
        if (logActions) {
          console.log('[Seat Monitor] Последний div не является кнопкой Buy-in с disabled');
          console.log('[Seat Monitor] Текст:', text);
          console.log('[Seat Monitor] Disabled:', disabledAttr);
        }
      }

      return false;
    } catch (e) {
      if (logActions) {
        console.error('[Seat Monitor] Ошибка при клике на Buy-in:', e);
      }
      return false;
    }
  },

  /**
   * Задержка
   * @private
   * @param {number} ms - Миллисекунды
   * @returns {Promise}
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  _getBuyInButton(popup, logActions) {
    const getDivChildren = (element) => {
      return Array.from(element.children).filter(child => child.tagName === 'DIV');
    };

    // Путь по структуре: popup -> div[1] -> div[0] -> div[7] (последний div)
    // popup -> div[1] (второй дочерний div popup)
    const popupDivs = getDivChildren(popup);
    if (popupDivs.length < 2) {
      if (logActions) {
        console.log('[Seat Monitor] Popup не имеет достаточно дочерних div элементов');
      }
      return false;
    }

    const secondDiv = popupDivs[1]; // div[1]

    // div[1] -> div[0] (первый дочерний div второго div)
    const secondDivChildren = getDivChildren(secondDiv);
    if (secondDivChildren.length === 0) {
      if (logActions) {
        console.log('[Seat Monitor] Второй div не имеет дочерних элементов');
      }
      return false;
    }

    const firstChild = secondDivChildren[0]; // div[0]

    // div[0] -> div[7] (восьмой дочерний div, индекс 7 - последний на этом уровне)
    const firstChildDivs = getDivChildren(firstChild);
    if (firstChildDivs.length < 8) {
      if (logActions) {
        console.log('[Seat Monitor] Не найдено достаточно дочерних div элементов (нужно минимум 8)');
      }
      return false;
    }

    // Берем последний div (кнопка Buy-in)
    return firstChildDivs[firstChildDivs.length - 1]; // последний div
  },
};

