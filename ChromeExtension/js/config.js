// Конфигурация расширения
const SeatMonitorConfig = {
  checkInterval: 1000, // Интервал проверки в миллисекундах
  selector: "div[class*='seat-undefined']", // Селектор для поиска элементов
  enabled: false, // Включен ли мониторинг (по умолчанию выключен, включается вручную)
  logActions: false, // Логировать действия в консоль
  mode: 'first-available', // Режим мониторинга: 'first-available' или 'target-players'
  targetPlayerIds: [],
  targetColors: ['#F41317', '#65F6E2', '#F87C1E', '#279DFF', '#FFD825', '#7B300A', '#97FB46', '#8130D1', '#01AF4E', '#FF99BE'],
  selectedTargetColors: new Set(), // ID игроков, за которыми следим (для режима target-players)
  isSeat: true,
  vpipStatus: true,
  vpipValue: 50
};

