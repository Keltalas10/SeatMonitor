// Popup script для управления расширением

document.addEventListener('DOMContentLoaded', async function () {
  // Проверка, что Auth загружен
  if (typeof Auth === 'undefined') {
    console.error('[Popup] Ошибка: Auth не загружен. Проверьте путь к auth.js');
    document.getElementById('status').textContent = 'Ошибка: модуль Auth не загружен';
    document.getElementById('status').className = 'status disabled';
    return;
  }

  // Проверка авторизации и обновление подписки при необходимости
  const isAuth = await Auth.checkAuth();
  if (!isAuth) {
    // Если не авторизован, пытаемся зарегистрироваться автоматически
    const registerResult = await Auth.register();
    if (!registerResult.success) {
      console.error('[Popup] Ошибка регистрации:', registerResult.error);
    }
  } else {
    // Проверяем, нужно ли обновить подписку (если она истекла или отсутствует)
    const shouldRefresh = await Auth.shouldRefreshSubscription();
    if (shouldRefresh) {
      const authResult = await Auth.login();
      if (!authResult.success) {
        console.error('[Popup] Ошибка обновления подписки:', authResult.error);
      }
    }
  }

  // Получаем данные устройства
  const device = await Auth.getUser();
  if (device) {
    // Отображаем информацию об устройстве
    const userInfoDiv = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');
    const subscriptionDateDiv = document.getElementById('subscriptionDate');

    userInfoDiv.style.display = 'block';
    // Показываем короткую версию UUID (первые 8 символов)
    const shortUUID = device.deviceUUID ? device.deviceUUID.substring(0, 8) + '...' : 'Неизвестно';
    userEmailSpan.textContent = `ID: ${shortUUID}`;

    // Отображаем дату окончания подписки
    if (device.subscriptionEndDate) {
      const endDate = new Date(device.subscriptionEndDate);
      const now = new Date();

      // Устанавливаем время на начало дня для сравнения
      const endDateOnly = new Date(endDate);
      const nowOnly = new Date(now);
      endDateOnly.setHours(0, 0, 0, 0);
      nowOnly.setHours(0, 0, 0, 0);

      // Подписка истекла, если дата окончания меньше текущей даты (не включая сегодняшний день)
      const isExpired = endDateOnly < nowOnly;

      subscriptionDateDiv.textContent = `Подписка до: ${endDate.toLocaleDateString('ru-RU')}`;
      subscriptionDateDiv.className = isExpired ? 'subscription-date expired' : 'subscription-date';
    } else {
      subscriptionDateDiv.textContent = 'Подписка: не установлена';
      subscriptionDateDiv.className = 'subscription-date';
    }
  }

  const statusDiv = document.getElementById('status');
  const toggleBtn = document.getElementById('toggleBtn');
  const monitorInfo = document.getElementById('monitorInfo');
  const modeSelect = document.getElementById('modeSelect');
  const colorSelectContainer = document.getElementById('colorSelectContainer');
  const colorSelectWrapper = document.getElementById('colorSelectWrapper');
  const checkIntervalInput = document.getElementById('checkIntervalInput');

  // Проверяем, что все необходимые элементы найдены
  if (!statusDiv || !toggleBtn || !monitorInfo || !modeSelect || !colorSelectContainer || !colorSelectWrapper || !checkIntervalInput) {
    console.error('[Popup] Не все элементы найдены:', {
      statusDiv: !!statusDiv,
      toggleBtn: !!toggleBtn,
      monitorInfo: !!monitorInfo,
      modeSelect: !!modeSelect,
      colorSelectContainer: !!colorSelectContainer,
      colorSelectWrapper: !!colorSelectWrapper,
      checkIntervalInput: !!checkIntervalInput
    });
    if (statusDiv) {
      statusDiv.textContent = 'Ошибка: не все элементы найдены';
      statusDiv.className = 'status disabled';
    }
    return;
  }

  let enabled = false;
  let isModeChanging = false; // Флаг, что пользователь меняет режим

  // Инициализация dropdown цветов
  function initColorSelect() {
    // Проверяем, что config загружен
    if (typeof SeatMonitorConfig === 'undefined' || !SeatMonitorConfig.targetColors) {
      console.error('[Popup] SeatMonitorConfig не загружен');
      return;
    }

    // Очищаем существующие опции
    colorSelectWrapper.innerHTML = '';

    // Заполняем dropdown цветами из конфига
    SeatMonitorConfig.targetColors.forEach(color => {
      const option = document.createElement('div');
      option.className = 'color-option';
      option.style.backgroundColor = color;
      option.style.margin ='5px';
      option.style.border = '3px solid white';
      option.setAttribute('data-color', color);

      // Обработчик выбора цвета
      option.addEventListener('click', function () {
        const selectedColor = this.getAttribute('data-color');
        if(option.style.border === '3px solid blue'){
           option.style.border = '3px solid white';
           removeColor(selectedColor)
        }
        else{
          option.style.border = '3px solid blue';

          // Сохраняем в storage
          addColor(selectedColor);

          // Отправляем в content script
          
        }
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'setTargetColor',
                color: selectedColor
              }, function (response) {
                if (chrome.runtime.lastError) {
                  console.error('[Popup] Ошибка при изменении цвета:', chrome.runtime.lastError);
                } else if (response && response.success) {
                  console.log('[Popup] Цвет изменен на:', selectedColor);
                }
              });
            }
          });
      });

      colorSelectWrapper.appendChild(option);
    });

    // Загружаем сохраненный цвет из storage
    chrome.storage.local.get(['selectedTargetColors'], function(result) {
      // Получаем цвета из хранилища или используем дефолтные
      const selectedColors = new Set(result.selectedTargetColors || []);
      
      // Добавляем цвета из конфига, если они есть
      if (SeatMonitorConfig?.selectedTargetColors) {
        SeatMonitorConfig.selectedTargetColors.forEach(color => {
          selectedColors.add(color);
        });
      }
      
      // Проверяем каждый элемент
      Array.from(colorSelectWrapper.children).forEach(option => {
        // Получаем цвет элемента
        const elementColor = option.style.backgroundColor;
        
        // Приводим цвета к единому формату для сравнения
        const normalizedElementColor = normalizeColor(elementColor);
        
        // Проверяем, есть ли такой цвет в выбранных
        let isSelected = false;
        for (let selectedColor of selectedColors) {
          const normalizedSelectedColor = normalizeColor(selectedColor);
          if (normalizedElementColor === normalizedSelectedColor) {
            isSelected = true;
            break;
          }
        }
        
        if (isSelected) {
          option.style.border = '3px solid blue';
          // Добавляем в конфиг
          if (SeatMonitorConfig?.selectedTargetColors) {
            SeatMonitorConfig.selectedTargetColors.add(normalizedElementColor);
          }
        }
      });
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, {
                action: 'setTargetColors',
                colors: Array.from(SeatMonitorConfig.selectedTargetColors)
              }, function (response) {
              });
            }
          });
    });
  }
  // Функция для нормализации цвета
  function normalizeColor(color) {
      if (!color) return '';
      
      // Если цвет уже в формате hex (3, 4, 6 или 8 символов), возвращаем как есть
      const hexMatch = color.trim().match(/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
      if (hexMatch) {
          // Возвращаем в нижнем регистре для консистентности
          return color.trim().toUpperCase();
      }
      
      // Создаем временный элемент для парсинга цвета
      const tempDiv = document.createElement('div');
      tempDiv.style.color = color;
      document.body.appendChild(tempDiv);
      
      try {
          const computedColor = getComputedStyle(tempDiv).color;
          const rgbMatch = computedColor.match(/^rgb(a?)\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
          
          if (rgbMatch) {
              // Извлекаем компоненты цвета
              const r = parseInt(rgbMatch[2]);
              const g = parseInt(rgbMatch[3]);
              const b = parseInt(rgbMatch[4]);
              const a = rgbMatch[5] ? parseFloat(rgbMatch[5]) : null;
              
              // Преобразуем в HEX
              const toHex = (n) => {
                  const hex = n.toString(16);
                  return hex.length === 1 ? '0' + hex : hex;
              };
              
              let hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
              
              // Добавляем альфа-канал если есть
              if (a !== null) {
                  const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
                  hexColor += alphaHex;
              }
              
              return hexColor.toUpperCase();
          }
          
          // Если не удалось распарсить как rgb/rgba, возвращаем computedColor
          return computedColor.toUpperCase();
      } finally {
          document.body.removeChild(tempDiv);
      }
  }

  function addColor(color) {
    chrome.storage.local.get(['selectedTargetColors'], (result) => {
      const colors = new Set(result.selectedTargetColors || []);
      colors.add(color);
      
      chrome.storage.local.set({ 
        selectedTargetColors: Array.from(colors) 
      }, () => {
        console.log('Цвет добавлен:', color);
      });
    });
  }
  
  // Удаление цвета
  function removeColor(color) {
    chrome.storage.local.get(['selectedTargetColors'], (result) => {
      const colors = new Set(result.selectedTargetColors || []);
      colors.delete(color);
      
      chrome.storage.local.set({ 
        selectedTargetColors: Array.from(colors) 
      }, () => {
        console.log('Цвет удален:', color);
      });
    });
  }
  // Функция для определения контрастного цвета текста
  function getContrastColor(rgb) {
    // Парсим rgb строку
    const match = rgb.match(/\d+/g);
    if (!match || match.length < 3) return '#000';
    const r = parseInt(match[0]);
    const g = parseInt(match[1]);
    const b = parseInt(match[2]);
    // Вычисляем яркость
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000' : '#fff';
  }

  // Показ/скрытие dropdown цветов в зависимости от режима
  function updateColorSelectVisibility() {
    if (modeSelect.value === 'target-players') {
      colorSelectContainer.style.display = 'block';
      colorSelectWrapper.style.display = 'flex';
    } else {
      colorSelectContainer.style.display = 'none';
      // Закрываем dropdown если он открыт
      if (colorSelectWrapper) {
        colorSelectWrapper.style.display = 'none';
      }
    }
  }

  // Инициализация dropdown цветов
  initColorSelect();

  // Загрузка текущего режима и интервала из storage
  chrome.storage.local.get(['monitorMode', 'checkInterval'], function (result) {
    if (result.monitorMode) {
      modeSelect.value = result.monitorMode;
      updateColorSelectVisibility();
    }
    if (result.checkInterval) {
      checkIntervalInput.value = result.checkInterval;
    } else if (typeof SeatMonitorConfig !== 'undefined' && SeatMonitorConfig.checkInterval) {
      checkIntervalInput.value = SeatMonitorConfig.checkInterval;
    }
  });

  // Загрузка текущего режима из content script
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getMode' }, function (response) {
        if (response && response.mode && !isModeChanging) {
          modeSelect.value = response.mode;
          // Сохраняем в storage
          chrome.storage.local.set({ monitorMode: response.mode });
          updateColorSelectVisibility();
        }
      });
    }
  });

  // Обработчик изменения режима
  modeSelect.addEventListener('change', function () {
    const selectedMode = modeSelect.value;
    isModeChanging = true; // Устанавливаем флаг

    // Обновляем видимость dropdown цветов
    updateColorSelectVisibility();

    // Сохраняем в storage
    chrome.storage.local.set({ monitorMode: selectedMode });

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'setMode', mode: selectedMode }, function (response) {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Ошибка при изменении режима:', chrome.runtime.lastError);
            isModeChanging = false;
          } else if (response && response.success) {
            console.log('[Popup] Режим изменен на:', selectedMode);
            // Сбрасываем флаг через небольшую задержку
            setTimeout(() => {
              isModeChanging = false;
            }, 1000);
            updateStatus();
          } else {
            isModeChanging = false;
          }
        });
      } else {
        isModeChanging = false;
      }
    });
  });

  // Обработчик изменения цвета теперь в initColorSelect (обработчик клика на опции)

  // Обработчик изменения интервала проверки
  checkIntervalInput.addEventListener('change', function () {
    let interval = parseInt(checkIntervalInput.value, 10);

    // Валидация: проверяем диапазон
    if (isNaN(interval) || interval < 100) {
      interval = 100;
      checkIntervalInput.value = interval;
    } else if (interval > 10000) {
      interval = 10000;
      checkIntervalInput.value = interval;
    }

    // Сохраняем в storage
    chrome.storage.local.set({ checkInterval: interval });

    // Отправляем в content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setCheckInterval',
          interval: interval
        }, function (response) {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Ошибка при изменении интервала:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log('[Popup] Интервал изменен на:', interval, 'мс');
          }
        });
      }
    });
  });

  function colorMatches(color, targetColor) {
    if (!color || !targetColor) return false;

    // Если цвет в HEX формате, конвертируем в RGB
    let rgbColor = targetColor;
    if (targetColor.startsWith('#')) {
      rgbColor = hexToRgb(targetColor);
    }

    // Проверяем оба формата (RGB и HEX)
    return color == targetColor || color == rgbColor;
  }
  function hexToRgb(hex) {
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
  }
  // Получение статуса
  function updateStatus() {
    console.log('[Popup] updateStatus вызван');

    // Обновляем статус сразу, чтобы убрать "Проверка статуса..."
    statusDiv.textContent = 'Проверка подключения...';
    statusDiv.className = 'status disabled';

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      console.log('[Popup] Вкладки найдены:', tabs);

      if (!tabs || !tabs[0]) {
        console.log('[Popup] Нет активной вкладки');
        statusDiv.textContent = 'Нет активной вкладки';
        statusDiv.className = 'status disabled';
        toggleBtn.disabled = true;
        toggleBtn.classList.remove('enable', 'disable');
        return;
      }

      // Проверяем, что вкладка на правильном домене
      const url = tabs[0].url;
      console.log('[Popup] URL вкладки:', url);

      if (!url || !url.includes('game.r-gaming.com')) {
        console.log('[Popup] Вкладка не на правильном домене');
        statusDiv.textContent = 'Откройте страницу game.r-gaming.com';
        statusDiv.className = 'status disabled';
        toggleBtn.disabled = true;
        toggleBtn.classList.remove('enable', 'disable');
        return;
      }

      console.log('[Popup] Отправка сообщения getStatus на вкладку:', tabs[0].id);
      console.log('[Popup] chrome.runtime доступен?', typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined');

      // Используем таймаут для обработки случая, когда ответ не приходит
      let responseReceived = false;
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.log('[Popup] Таймаут ожидания ответа (3 секунды)');
          statusDiv.textContent = 'Нет ответа от страницы. Перезагрузите страницу';
          statusDiv.className = 'status disabled';
          toggleBtn.disabled = true;
          toggleBtn.classList.remove('enable', 'disable');
        }
      }, 3000);

      try {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, function (response) {
          responseReceived = true;
          clearTimeout(timeoutId);

          console.log('[Popup] Ответ от content script:', response);
          console.log('[Popup] Ошибка runtime:', chrome.runtime.lastError);

          if (chrome.runtime.lastError) {
            // Ошибка подключения - возможно content script еще не загружен или страница не на правильном домене
            const errorMsg = chrome.runtime.lastError.message;
            console.log('[Popup] Ошибка подключения:', errorMsg);

            if (errorMsg && (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist'))) {
              statusDiv.textContent = 'Content script не загружен. Перезагрузите страницу';
              statusDiv.className = 'status disabled';
              toggleBtn.disabled = true;
              toggleBtn.classList.remove('enable', 'disable');
            } else {
              statusDiv.textContent = `Ошибка подключения: ${errorMsg}`;
              statusDiv.className = 'status disabled';
              toggleBtn.disabled = true;
              toggleBtn.classList.remove('enable', 'disable');
            }
            return;
          }

          if (!response) {
            statusDiv.textContent = 'Нет ответа от страницы';
            statusDiv.className = 'status disabled';
            toggleBtn.disabled = true;
            toggleBtn.classList.remove('enable', 'disable');
            return;
          }

          // Проверка на требование авторизации
          if (response.requiresAuth) {
            statusDiv.textContent = '⚠️ Требуется авторизация';
            statusDiv.className = 'status disabled';
            toggleBtn.disabled = true;
            toggleBtn.classList.remove('enable', 'disable');
            return;
          }

          // Проверка на требование подписки
          if (response.requiresSubscription) {
            statusDiv.textContent = '⚠️ Требуется активная подписка';
            statusDiv.className = 'status disabled';
            toggleBtn.disabled = true;
            toggleBtn.classList.remove('enable', 'disable');
            return;
          }

          enabled = response.enabled;
          statusDiv.textContent = enabled ? '✅ Мониторинг включен' : '❌ Мониторинг выключен';
          statusDiv.className = enabled ? 'status enabled' : 'status disabled';
          toggleBtn.textContent = enabled ? 'Выключить' : 'Включить';
          toggleBtn.disabled = false;

          // Обновляем классы кнопки в зависимости от текста
          toggleBtn.classList.remove('enable', 'disable');
          if (toggleBtn.textContent === 'Включить') {
            toggleBtn.classList.add('enable');
          } else if (toggleBtn.textContent === 'Выключить') {
            toggleBtn.classList.add('disable');
          }

          // Обновляем режим, если он изменился (но не если пользователь только что его менял)
          if (response.mode && modeSelect.value !== response.mode && !isModeChanging) {
            modeSelect.value = response.mode;
            // Сохраняем в storage
            chrome.storage.local.set({ monitorMode: response.mode });
            updateColorSelectVisibility();
          }

          // Отображаем информацию о режиме
          const modeText = response.mode === 'target-players' ? 'Отслеживание игроков' : 'Первое место';
          monitorInfo.textContent = enabled ? `Активен (${modeText})` : 'Остановлен';
        });
      } catch (error) {
        console.error('[Popup] Ошибка при отправке сообщения:', error);
        statusDiv.textContent = 'Ошибка отправки сообщения: ' + error.message;
        statusDiv.className = 'status disabled';
        toggleBtn.disabled = true;
        toggleBtn.classList.remove('enable', 'disable');
        clearTimeout(timeoutId);
      }
    });
  }

  // Переключение мониторинга
  toggleBtn.addEventListener('click', function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle' }, function (response) {
        if (chrome.runtime.lastError) {
          alert('Ошибка: убедитесь, что страница полностью загружена');
          return;
        }

        // Проверка на требование авторизации
        if (response && response.requiresAuth) {
          alert('Требуется авторизация. Расширение попытается автоматически зарегистрировать устройство.');
          updateStatus();
          return;
        }

        // Проверка на требование подписки
        if (response && response.requiresSubscription) {
          alert('Требуется активная подписка для работы мониторинга.');
          updateStatus();
          return;
        }

        updateStatus();
      });
    });
  });

  // Обновление статуса сразу и затем каждые 2 секунды
  updateStatus();
  setInterval(updateStatus, 2000);
});

