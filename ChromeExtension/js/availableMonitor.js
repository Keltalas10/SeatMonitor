const AvailableMonitor = {
  /**
   * Проверяет первое доступное место (режим first-available)
   */
  checkFirstAvailable() {

    // Ищем все элементы game-seat
    const allSeats = document.querySelectorAll("div[class*='game-seat']");
    let firstAvailableSeat = null;

    // Проверяем каждый элемент на наличие класса seat-undefined
    for (const seat of allSeats) {
      const classList = Array.from(seat.classList);
      const hasSeatUndefined = classList.includes('seat-undefined');

      if (hasSeatUndefined) {
        firstAvailableSeat = seat;
        break; // Нашли первое свободное место
      }
    }


    // Обрабатываем первое найденное свободное место
    if (firstAvailableSeat) {
      SeatMonitor._processElement(firstAvailableSeat);
    }
  },
}