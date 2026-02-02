// Утилиты для работы с элементами DOM

const ElementUtils = {
  /**
   * Получает уникальный идентификатор элемента для отслеживания
   * @param {HTMLElement} element - Элемент DOM
   * @returns {string} Уникальный идентификатор
   */
  getElementIdentifier(element) {
    try {
      const className = element.className || '';
      const rect = element.getBoundingClientRect();
      const position = `${rect.x},${rect.y}`;
      const dataFold = element.getAttribute('data-fold') || '';
      const dataPlay = element.getAttribute('data-play') || '';

      return `${className}|${position}|${dataFold}|${dataPlay}`;
    } catch (e) {
      return Math.random().toString(); // Fallback
    }
  },

  /**
   * Проверяет, видим ли элемент на странице
   * @param {HTMLElement} element - Элемент DOM
   * @returns {boolean} true если элемент видим
   */
  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  },

  /**
   * Находит кликабельный элемент (сам элемент или его дочерние элементы)
   * @param {HTMLElement} element - Родительский элемент
   * @returns {HTMLElement} Элемент для клика
   */
  findClickableElement(element) {
    // Ищем дочерние элементы, которые могут быть кликабельными
    const children = element.querySelectorAll('*');
    
    for (let child of children) {
      const childStyle = window.getComputedStyle(child);
      const childIsClickable = 
        childStyle.cursor === 'pointer' ||
        child.onclick !== null ||
        child.getAttribute('onclick') !== null ||
        child.tagName === 'BUTTON' ||
        child.tagName === 'A' ||
        child.tagName === 'DIV'; // DIV тоже может быть кликабельным

      if (childIsClickable && this.isElementVisible(child)) {
        return child;
      }
    }

    // Если ничего не найдено, возвращаем первый дочерний элемент или сам элемент
    return element.firstElementChild || element;
  }
};

