const AvailableMonitor = {
  /**
   * Проверяет первое доступное место (режим first-available)
   */
  checkFirstAvailable(startIndex) {
    const allSeats = document.querySelectorAll("div[class*='game-seat']");
    if (allSeats.length === 0) return;
    if (startIndex) {
      if (SeatMonitorConfig.logActions) {
        console.log('[SeatMonitor] Check first available after', startIndex);
      }
      const totalSeats = allSeats.length;
      // Ищем по кругу: startIndex, startIndex+1, ..., totalSeats-1, 0, 1, ..., startIndex-1
      for (let offset = 0; offset < totalSeats; offset++) {
        const actualIndex = (startIndex + offset) % totalSeats;
        const seat = allSeats[actualIndex];

        if (Array.from(seat.classList).includes('seat-undefined')) {
          if (SeatMonitorConfig.logActions) {
            console.log('[SeatMonitor] Found first available', actualIndex);
          }
          SeatMonitor._processElement(seat);
          return;
        }
      }
      return;
    }

    if (SeatMonitorConfig.logActions) {
      console.log('[SeatMonitor] Check first available');
    }
    // Ищем все элементы game-seat
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