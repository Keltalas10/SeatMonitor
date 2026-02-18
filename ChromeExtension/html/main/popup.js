// Popup script для управления расширением

document.addEventListener('DOMContentLoaded', async function () {
  const activationWrapper = document.getElementById('activationWrapper');
  const activateBtn = document.getElementById('activateBtn');
  const activationKeyInput = document.getElementById('activationKeyInput');
  const monitorOptionsWrapper = document.getElementById('monitorOptionsWrapper');
  const statusDiv = document.getElementById('status');
  const monitorBtn = document.getElementById('toggleBtn');
  const monitorInfo = document.getElementById('monitorInfo');
  const colorSelectWrapper = document.getElementById('colorSelectWrapper');
  const checkIntervalInput = document.getElementById('checkIntervalInput');
  const seatTimeoutInput = document.getElementById('seatTimeoutInput');
  const isSeat = document.getElementById('isSeat');
  const vpipInput = document.getElementById('vpipInput');
  const vpipCheckbox = document.getElementById('vpipCheckbox');
  const stackInput = document.getElementById('stackInput');
  const buyInInput = document.getElementById('buyInInput');
  const stackCheckbox = document.getElementById('stackCheckbox');
  const subscriptionDateDiv = document.getElementById('subscriptionDate');

  // Проверка, что Auth загружен
  if (typeof Auth === 'undefined') {
    console.error('[Popup] Ошибка: Auth не загружен. Проверьте путь к auth.js');
    document.getElementById('status').textContent = 'Ошибка: модуль Auth не загружен';
    document.getElementById('status').className = 'status disabled';
    return;
  }

  // Проверка авторизации и обновление подписки при необходимости
  const accountData = await Auth.getAccountData();
  if (accountData.token === undefined || accountData.key === undefined) {
    activationWrapper.style.display = 'flex';
    monitorOptionsWrapper.style.display = 'none';
  } else {
    activationWrapper.style.display = 'none';
    monitorOptionsWrapper.style.display = 'flex';
    // Отображаем информацию об устройстве
    const userInfoDiv = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');


    userInfoDiv.style.display = 'block';
    // Показываем короткую версию UUID (первые 8 символов)
    const shortUUID = accountData.key;
    userEmailSpan.textContent = `ID: ${shortUUID}`;

    // Отображаем дату окончания подписки
    if (accountData.subscriptionEndDate) {
      const endDate = new Date(accountData.subscriptionEndDate);
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


  let enabled = false;
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
      option.style.margin = '5px';
      option.style.border = '3px solid white';
      option.setAttribute('data-color', color);

      // Обработчик выбора цвета
      option.addEventListener('click', function () {
        const selectedColor = this.getAttribute('data-color');
        if (option.style.border === '3px solid blue') {
          option.style.border = '3px solid white';
          removeColor(selectedColor)
        }
        else {
          option.style.border = '3px solid blue';

          // Сохраняем в storage
          addColor(selectedColor);
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
    chrome.storage.local.get(['selectedTargetColors'], function (result) {
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

  // Инициализация dropdown цветов
  initColorSelect();

  // Загрузка текущего режима и интервала из storage
  chrome.storage.local.get([
    'checkInterval',
    'seatTimeout',
    'isSeat',
    'stackStatus',
    'stackValue',
    'vpipStatus',
    'vpipValue',
    'buyInValue'], function (result) {
      if (result.checkInterval !== undefined) {
        checkIntervalInput.value = result.checkInterval / 1000;
      }
      if (result.seatTimeout !== undefined) {
        seatTimeoutInput.value = result.seatTimeout / 1000;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setSeatTimeout',
              interval: result.seatTimeout
            });
          }
        });
      }
      if (result.isSeat !== undefined) {
        isSeat.checked = result.isSeat;
        seatTimeoutInput.disabled = !result.isSeat;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setIsSeat',
              checked: result.isSeat
            });
          }
        });
      }
      if (result.vpipStatus !== undefined) {
        vpipCheckbox.checked = result.vpipStatus;
        vpipInput.disabled = !result.vpipStatus;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setVpipStatus',
              status: result.vpipStatus
            });
          }
        });
      }
      if (result.vpipValue !== undefined) {
        vpipInput.value = result.vpipValue;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setVpipValue',
              value: result.vpipValue
            });
          }
        });
      }
      if (result.stackStatus !== undefined) {
        stackCheckbox.checked = result.stackStatus;
        stackInput.disabled = !result.stackStatus;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setStackStatus',
              status: result.stackStatus
            });
          }
        });
      }
      if (result.stackValue !== undefined) {
        stackInput.value = result.stackValue;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setStackValue',
              value: result.stackValue
            });
          }
        });
      }
      if (result.buyInValue !== undefined) {
        buyInInput.value = result.buyInValue;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'setBuyInValue',
              value: result.buyInValue
            });
          }
        });
      }
    });

  isSeat.addEventListener('change', function () {
    chrome.storage.local.set({ isSeat: isSeat.checked });
    seatTimeoutInput.disabled = !isSeat.checked;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setIsSeat", checked: isSeat.checked })
      }
    })
  })


  vpipCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ vpipStatus: vpipCheckbox.checked });
    vpipInput.disabled = !vpipCheckbox.checked;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setVpipStatus", status: vpipCheckbox.checked })
      }
    })
  })

  vpipInput.addEventListener('change', function () {
    chrome.storage.local.set({ vpipValue: vpipInput.value });
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setVpipValue", value: vpipInput.value })
      }
    })
  })

  stackCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ stackStatus: stackCheckbox.checked });
    stackInput.disabled = !stackCheckbox.checked;
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setStackStatus", status: stackCheckbox.checked })
      }
    })
  })

  stackInput.addEventListener('change', function () {
    chrome.storage.local.set({ stackValue: stackInput.value });
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "setStackValue", value: stackInput.value })
      }
    })
  })

  // Обработчик изменения интервала проверки
  checkIntervalInput.addEventListener('change', function () {
    let interval = parseFloat(checkIntervalInput.value, 10);

    // Валидация: проверяем диапазон
    if (isNaN(interval) || interval < 0.1) {
      interval = 0.1;
      checkIntervalInput.value = interval;
    } else if (interval > 10) {
      interval = 10;
      checkIntervalInput.value = interval;
    }

    // Сохраняем в storage
    chrome.storage.local.set({ checkInterval: interval });

    // Отправляем в content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setCheckInterval',
          interval: interval * 1000
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

  seatTimeoutInput.addEventListener('change', function () {
    let interval = parseFloat(seatTimeoutInput.value, 10);

    // Валидация: проверяем диапазон
    if (isNaN(interval) || interval < 0.1) {
      interval = 0.1;
      seatTimeoutInput.value = interval;
    } else if (interval > 10) {
      interval = 10;
      seatTimeoutInput.value = interval;
    }

    // Сохраняем в storage
    chrome.storage.local.set({ seatTimeout: interval });

    // Отправляем в content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setSeatTimeout',
          interval: interval * 1000
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

  buyInInput.addEventListener('change', function () {
    let buyInValue = parseInt(buyInInput.value, 10);

    // Валидация: проверяем диапазон
    if (isNaN(buyInValue) || buyInValue < 10) {
      buyInValue = 10;
      buyInInput.value = buyInValue;
    } else if (buyInValue > 10000) {
      buyInValue = 10000;
      buyInInput.value = buyInValue;
    }

    // Сохраняем в storage
    chrome.storage.local.set({ buyInValue: buyInValue });

    // Отправляем в content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'setBuyInValue',
          value: buyInValue
        }, function (response) {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Ошибка при изменении buy-in:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log('[Popup] bui-in изменен на:', buyInValue, 'BB');
          }
        });
      }
    });
  });

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
        monitorBtn.disabled = true;
        monitorBtn.classList.remove('enable', 'disable');
        return;
      }

      // Проверяем, что вкладка на правильном домене
      const url = tabs[0].url;
      console.log('[Popup] URL вкладки:', url);

      if (!url || !url.includes('game.r-gaming.com')) {
        console.log('[Popup] Вкладка не на правильном домене');
        statusDiv.textContent = 'Откройте страницу game.r-gaming.com';
        statusDiv.className = 'status disabled';
        monitorBtn.disabled = true;
        monitorBtn.classList.remove('enable', 'disable');
        return;
      }

      console.log('[Popup] Отправка сообщения getStatus на вкладку:', tabs[0].id);
      console.log('[Popup] chrome.runtime доступен?', typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined');

      // Используем таймаут для обработки случая, когда ответ не приходит
      let responseReceived = false;
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.log('[Popup] Таймаут ожидания ответа (3 секунды)');
          statusDiv.textContent = 'Нет ответа от страницы. Перезагрузите страницу "Ctrl+R';
          statusDiv.className = 'status disabled';
          monitorBtn.disabled = true;
          monitorBtn.classList.remove('enable', 'disable');
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
              statusDiv.textContent = 'Extenstion не полностью инициализировался. Перезагрузите страницу "Ctrl+R"';
              statusDiv.className = 'status disabled';
              monitorBtn.disabled = true;
              monitorBtn.classList.remove('enable', 'disable');
            } else {
              statusDiv.textContent = `Ошибка подключения: ${errorMsg}`;
              statusDiv.className = 'status disabled';
              monitorBtn.disabled = true;
              monitorBtn.classList.remove('enable', 'disable');
            }
            return;
          }

          if (!response) {
            statusDiv.textContent = 'Нет ответа от страницы';
            statusDiv.className = 'status disabled';
            monitorBtn.disabled = true;
            monitorBtn.classList.remove('enable', 'disable');
            return;
          }

          // Проверка на требование авторизации
          if (response.requiresAuth) {
            statusDiv.textContent = '⚠️ Требуется авторизация';
            statusDiv.className = 'status disabled';
            monitorBtn.disabled = true;
            monitorBtn.classList.remove('enable', 'disable');
            return;
          }

          // Проверка на требование подписки
          if (response.requiresSubscription) {
            statusDiv.textContent = '⚠️ Требуется активная подписка';
            statusDiv.className = 'status disabled';
            monitorBtn.disabled = true;
            monitorBtn.classList.remove('enable', 'disable');
            return;
          }

          enabled = response.enabled;
          statusDiv.textContent = enabled ? '✅ Мониторинг включен' : '❌ Мониторинг выключен';
          statusDiv.className = enabled ? 'status enabled' : 'status disabled';
          monitorBtn.textContent = enabled ? 'Выключить' : 'Включить';
          monitorBtn.disabled = false;

          // Обновляем классы кнопки в зависимости от текста
          monitorBtn.classList.remove('enable', 'disable');
          if (monitorBtn.textContent === 'Включить') {
            monitorBtn.classList.add('enable');
          } else if (monitorBtn.textContent === 'Выключить') {
            monitorBtn.classList.add('disable');
          }

          monitorInfo.textContent = enabled ? `Активен Отслеживание игроков` : 'Остановлен';
        });
      } catch (error) {
        console.error('[Popup] Ошибка при отправке сообщения:', error);
        statusDiv.textContent = 'Ошибка отправки сообщения: ' + error.message;
        statusDiv.className = 'status disabled';
        monitorBtn.disabled = true;
        monitorBtn.classList.remove('enable', 'disable');
        clearTimeout(timeoutId);
      }
    });
  }

  // Переключение мониторинга
  monitorBtn.addEventListener('click', function () {
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

  activateBtn.addEventListener('click', function () {
    Auth.register(activationKeyInput.value)
      .then(registerResult => {
        if (!registerResult.success) {
          statusDiv.textContent = registerResult.error;
          statusDiv.className = 'status disabled';
        }

        Auth.login().then(
          loginResult => {
            if (loginResult.success) {

              activationWrapper.style.display = 'none';
              monitorOptionsWrapper.style.display = 'flex';
            }
          }
        )

      })
      .catch(error => {
        // Обработка ошибки
        console.error('Ошибка регистрации:', error);
      });
  });

  // Обновление статуса сразу и затем каждые 2 секунды
  updateStatus();
});

