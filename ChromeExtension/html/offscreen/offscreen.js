// Карта соответствия действий и звуковых файлов
const soundMap = {
  'check': 'sounds/check.mp3',
  'call': 'sounds/bet.mp3',
  'fold': 'sounds/fold.mp3',
  'raise': 'sounds/bet.mp3',
  'all-in': 'sounds/bet.mp3',
  'bet': 'sounds/bet.mp3',
  'round': 'sounds/round.mp3'
};

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'playSound') {
    playSound(message.sound, message.volume || 1.0)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Асинхронный ответ
  }
});

async function playSound(soundName, volume = 1.0) {
  return new Promise((resolve, reject) => {
    try {
      // Получаем путь к звуковому файлу
      const soundFile = soundMap[soundName];
      if (!soundFile) {
        reject(new Error(`Звук ${soundName} не найден`));
        return;
      }

      // Создаем аудио элемент
      const audio = new Audio(chrome.runtime.getURL(soundFile));
      audio.volume = volume;

      audio.onended = () => {
        console.log(`Звук ${soundName} воспроизведен`);
        resolve();
      };

      audio.onerror = (error) => {
        console.error(`Ошибка воспроизведения ${soundName}:`, error);
        reject(error);
      };

      audio.play().catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Функция для предзагрузки звуков
function preloadSounds() {
  Object.values(soundMap).forEach(soundFile => {
    const audio = new Audio(chrome.runtime.getURL(soundFile));
    audio.preload = 'auto';
    audio.load();
  });
}

// Предзагружаем звуки при инициализации
preloadSounds();