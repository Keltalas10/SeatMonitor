// Функция воспроизведения звука из popup
function playSound(soundName) {
  const audio = new Audio(chrome.runtime.getURL(`sounds/${soundName}.mp3`));
  audio.volume = 0.5;
  audio.play();
}

// Назначаем обработчики на кнопки
document.getElementById('check').onclick = () => playSound('check');
document.getElementById('call').onclick = () => playSound('call');
document.getElementById('fold').onclick = () => playSound('fold');
document.getElementById('raise').onclick = () => playSound('raise');
document.getElementById('all-in').onclick = () => playSound('all-in');
document.getElementById('bet').onclick = () => playSound('bet');
document.getElementById('round').onclick = () => playSound('round');