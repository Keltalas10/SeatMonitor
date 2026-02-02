// Обработчик кликов по элементам

const ClickHandler = {
  /**
   * Выполняет клик по элементу различными способами
   * @param {HTMLElement} element - Элемент для клика
   * @param {boolean} logActions - Логировать ли действия
   * @returns {boolean} true если клик выполнен
   */
  clickElement(element, logActions = true) {
    try {
      // Прокручиваем к элементу, если нужно
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Небольшая задержка перед кликом
      setTimeout(() => {
        // Находим элемент для клика (сам элемент или дочерний)
        const clickTarget = ElementUtils.findClickableElement(element);

        if (logActions) {
          console.log(`[Seat Monitor] Клик по элементу:`, element);
          console.log(`[Seat Monitor] Цель клика:`, clickTarget);
        }

        // Пробуем несколько способов клика
        this._tryClickMethods(clickTarget, element, logActions);
      }, 100);

      return true;
    } catch (e) {
      if (logActions) {
        console.error(`[Seat Monitor] Ошибка при клике:`, e);
      }
      return false;
    }
  },

  /**
   * Пробует различные способы клика
   * @private
   * @param {HTMLElement} clickTarget - Целевой элемент для клика
   * @param {HTMLElement} originalElement - Оригинальный элемент
   * @param {boolean} logActions - Логировать ли действия
   */
  _tryClickMethods(clickTarget, originalElement, logActions) {
    // Способ 1: Обычный клик
    this._tryNormalClick(clickTarget, logActions);

    if (logActions) {
      console.log(`[Seat Monitor] Все способы клика применены`);
    }
  },

  /**
   * Пробует обычный клик
   * @private
   */
  _tryNormalClick(element, logActions) {
    try {
      element.click();
    } catch (e) {
      if (logActions) {
        console.log(`[Seat Monitor] Обычный клик не сработал, пробуем другие способы`);
      }
    }
  },

  /**
   * Пробует программный клик через MouseEvent
   * @private
   */
  _tryProgrammaticClick(element, logActions) {
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });
    element.dispatchEvent(clickEvent);
  },

  /**
   * Пробует клик через mousedown + mouseup + click
   * @private
   */
  _tryMouseEvents(element, logActions) {
    const mouseDownEvent = new MouseEvent('mousedown', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });

    const mouseUpEvent = new MouseEvent('mouseup', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });

    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1
    });

    element.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      element.dispatchEvent(mouseUpEvent);
      element.dispatchEvent(clickEvent);
    }, 10);
  },

  /**
   * Пробует клик на родительском элементе
   * @private
   */
  _tryParentClick(element, logActions) {
    setTimeout(() => {
      const parentClickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true,
        buttons: 1
      });
      element.dispatchEvent(parentClickEvent);
    }, 50);
  }
};

