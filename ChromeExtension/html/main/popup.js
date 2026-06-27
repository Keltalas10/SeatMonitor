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
  const soundToggle = document.getElementById('soundToggle');

  function getTargetTab(callback) {

    // Если нет targetTabId, ищем все вкладки с нужным доменом
    chrome.tabs.query({ url: '*://game.r-gaming.com/*' }, (tabs) => {
      const activeTab = tabs.find(t => t.active);
      callback(activeTab || tabs[0] || null);
    });

  }

  // Проверка, что Auth загружен
  if (typeof Auth === 'undefined') {
    console.error('[Popup] Ошибка: Auth не загружен. Проверьте путь к auth.js');
    document.getElementById('status').textContent = 'Ошибка: модуль Auth не загружен';
    document.getElementById('status').className = 'status disabled';
    return;
  }
  await Auth.login();
  // Проверка авторизации и обновление подписки при необходимости
  const accountData = await Auth.getAccountData();
  if (accountData.token === undefined || accountData.accountKey === undefined) {
    activationWrapper.style.display = 'flex';
    monitorOptionsWrapper.style.display = 'none';
  } else {
    activationWrapper.style.display = 'none';
    monitorOptionsWrapper.style.display = 'flex';
    const userInfoDiv = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');
    userInfoDiv.style.display = 'block';
    const shortUUID = accountData.accountKey;
    userEmailSpan.textContent = `ID: ${shortUUID}`;

    if (await Auth.hasActiveSubscription()) {
      const endDate = new Date(accountData.subscriptionEndDate);
      subscriptionDateDiv.textContent = `Подписка активна до: ${endDate.toLocaleDateString('ru-RU')}`;
      subscriptionDateDiv.className = 'subscription-date';
      monitorBtn.disabled = false;
      statusDiv.textContent = '✅ Подписка активна';
      statusDiv.className = 'status active';
    } else {
      subscriptionDateDiv.textContent = 'Подписка не активна';
      subscriptionDateDiv.className = 'subscription-date';
      monitorBtn.disabled = true;
      statusDiv.textContent = '⚠️ Требуется активная подписка';
      statusDiv.className = 'status disabled';
    }
  }

  let enabled = false;

  // --- Инициализация выбора цветов ---
  function initColorSelect() {
    if (typeof SeatMonitorConfig === 'undefined' || !SeatMonitorConfig.targetColors) {
      console.error('[Popup] SeatMonitorConfig не загружен');
      return;
    }
    colorSelectWrapper.innerHTML = '';
    SeatMonitorConfig.targetColors.forEach(color => {
      const option = document.createElement('div');
      option.className = 'color-option';
      option.style.backgroundColor = color;
      option.style.margin = '5px';
      option.style.border = '3px solid white';
      option.setAttribute('data-color', color);

      option.addEventListener('click', function () {
        const selectedColor = this.getAttribute('data-color');
        if (option.style.border === '3px solid blue') {
          option.style.border = '3px solid white';
          removeColor(selectedColor);
        } else {
          option.style.border = '3px solid blue';
          addColor(selectedColor);
        }
        getTargetTab(function (tab) {
          if (tab) {
            chrome.tabs.sendMessage(tab.id, {
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

    chrome.storage.local.get(['selectedTargetColors'], function (result) {
      const selectedColors = new Set(result.selectedTargetColors || []);
      if (SeatMonitorConfig?.selectedTargetColors) {
        SeatMonitorConfig.selectedTargetColors.forEach(color => {
          selectedColors.add(color);
        });
      }
      Array.from(colorSelectWrapper.children).forEach(option => {
        const elementColor = option.style.backgroundColor;
        const normalizedElementColor = normalizeColor(elementColor);
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
          if (SeatMonitorConfig?.selectedTargetColors) {
            SeatMonitorConfig.selectedTargetColors.add(normalizedElementColor);
          }
        }
      });
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setTargetColors',
            colors: Array.from(SeatMonitorConfig.selectedTargetColors)
          });
        }
      });
    });
  }

  function normalizeColor(color) {
    if (!color) return '';
    const hexMatch = color.trim().match(/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/);
    if (hexMatch) return color.trim().toUpperCase();
    const tempDiv = document.createElement('div');
    tempDiv.style.color = color;
    document.body.appendChild(tempDiv);
    try {
      const computedColor = getComputedStyle(tempDiv).color;
      const rgbMatch = computedColor.match(/^rgb(a?)\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/i);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[2]);
        const g = parseInt(rgbMatch[3]);
        const b = parseInt(rgbMatch[4]);
        const a = rgbMatch[5] ? parseFloat(rgbMatch[5]) : null;
        const toHex = (n) => { const hex = n.toString(16); return hex.length === 1 ? '0' + hex : hex; };
        let hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        if (a !== null) {
          const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
          hexColor += alphaHex;
        }
        return hexColor.toUpperCase();
      }
      return computedColor.toUpperCase();
    } finally {
      document.body.removeChild(tempDiv);
    }
  }

  function addColor(color) {
    chrome.storage.local.get(['selectedTargetColors'], (result) => {
      const colors = new Set(result.selectedTargetColors || []);
      colors.add(color);
      chrome.storage.local.set({ selectedTargetColors: Array.from(colors) }, () => {
        console.log('Цвет добавлен:', color);
      });
    });
  }

  function removeColor(color) {
    chrome.storage.local.get(['selectedTargetColors'], (result) => {
      const colors = new Set(result.selectedTargetColors || []);
      colors.delete(color);
      chrome.storage.local.set({ selectedTargetColors: Array.from(colors) }, () => {
        console.log('Цвет удален:', color);
      });
    });
  }

  initColorSelect();

  // --- Загрузка настроек из storage ---
  chrome.storage.local.get([
    'checkInterval',
    'seatTimeout',
    'isSeat',
    'stackStatus',
    'stackValue',
    'vpipStatus',
    'vpipValue',
    'buyInValue'
  ], function (result) {
    if (result.checkInterval !== undefined) {
      checkIntervalInput.value = result.checkInterval / 1000;
    }
    if (result.seatTimeout !== undefined) {
      seatTimeoutInput.value = result.seatTimeout / 1000;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setSeatTimeout',
            interval: result.seatTimeout
          });
        }
      });
    }
    if (result.isSeat !== undefined) {
      isSeat.checked = result.isSeat;
      seatTimeoutInput.disabled = !result.isSeat;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setIsSeat',
            checked: result.isSeat
          });
        }
      });
    }
    if (result.vpipStatus !== undefined) {
      vpipCheckbox.checked = result.vpipStatus;
      vpipInput.disabled = !result.vpipStatus;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setVpipStatus',
            status: result.vpipStatus
          });
        }
      });
    }
    if (result.vpipValue !== undefined) {
      vpipInput.value = result.vpipValue;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setVpipValue',
            value: result.vpipValue
          });
        }
      });
    }
    if (result.stackStatus !== undefined) {
      stackCheckbox.checked = result.stackStatus;
      stackInput.disabled = !result.stackStatus;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setStackStatus',
            status: result.stackStatus
          });
        }
      });
    }
    if (result.stackValue !== undefined) {
      stackInput.value = result.stackValue;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setStackValue',
            value: result.stackValue
          });
        }
      });
    }
    if (result.buyInValue !== undefined) {
      buyInInput.value = result.buyInValue;
      getTargetTab(function (tab) {
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'setBuyInValue',
            value: result.buyInValue
          });
        }
      });
    }
  });

  // --- Обработчики событий ---
  isSeat.addEventListener('change', function () {
    chrome.storage.local.set({ isSeat: isSeat.checked });
    seatTimeoutInput.disabled = !isSeat.checked;
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "setIsSeat", checked: isSeat.checked });
      }
    });
  });

  vpipCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ vpipStatus: vpipCheckbox.checked });
    vpipInput.disabled = !vpipCheckbox.checked;
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "setVpipStatus", status: vpipCheckbox.checked });
      }
    });
  });

  vpipInput.addEventListener('change', function () {
    chrome.storage.local.set({ vpipValue: vpipInput.value });
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "setVpipValue", value: vpipInput.value });
      }
    });
  });

  stackCheckbox.addEventListener('change', function () {
    chrome.storage.local.set({ stackStatus: stackCheckbox.checked });
    stackInput.disabled = !stackCheckbox.checked;
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "setStackStatus", status: stackCheckbox.checked });
      }
    });
  });

  stackInput.addEventListener('change', function () {
    chrome.storage.local.set({ stackValue: stackInput.value });
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "setStackValue", value: stackInput.value });
      }
    });
  });

  checkIntervalInput.addEventListener('change', function () {
    let interval = parseFloat(checkIntervalInput.value, 10);
    if (isNaN(interval) || interval < 0.1) {
      interval = 0.1;
      checkIntervalInput.value = interval;
    } else if (interval > 10) {
      interval = 10;
      checkIntervalInput.value = interval;
    }
    chrome.storage.local.set({ checkInterval: interval });
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
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
    if (isNaN(interval) || interval < 0.1) {
      interval = 0.1;
      seatTimeoutInput.value = interval;
    } else if (interval > 10) {
      interval = 10;
      seatTimeoutInput.value = interval;
    }
    chrome.storage.local.set({ seatTimeout: interval });
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
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
    if (isNaN(buyInValue) || buyInValue < 10) {
      buyInValue = 10;
      buyInInput.value = buyInValue;
    } else if (buyInValue > 10000) {
      buyInValue = 10000;
      buyInInput.value = buyInValue;
    }
    chrome.storage.local.set({ buyInValue: buyInValue });
    getTargetTab(function (tab) {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'setBuyInValue',
          value: buyInValue
        }, function (response) {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Ошибка при изменении buy-in:', chrome.runtime.lastError);
          } else if (response && response.success) {
            console.log('[Popup] buy-in изменен на:', buyInValue, 'BB');
          }
        });
      }
    });
  });

  // --- Обновление статуса ---
  function updateStatus() {
    console.log('[Popup] updateStatus вызван');
    if (monitorBtn.disabled) {
      console.log('[Popup] Подписка неактивна, статус не обновляем');
      return;
    }
    statusDiv.textContent = 'Проверка подключения...';
    statusDiv.className = 'status disabled';

    getTargetTab(function (tab) {
      console.log('[Popup] Найдена вкладка:', tab);
      if (!tab) {
        statusDiv.textContent = 'Нет активной вкладки с game.r-gaming.com';
        statusDiv.className = 'status disabled';
        monitorBtn.disabled = true;
        monitorBtn.classList.remove('enable', 'disable');
        return;
      }

      const url = tab.url;
      if (!url || !url.includes('game.r-gaming.com')) {
        statusDiv.textContent = 'Откройте страницу game.r-gaming.com';
        statusDiv.className = 'status disabled';
        monitorBtn.disabled = true;
        monitorBtn.classList.remove('enable', 'disable');
        return;
      }

      let responseReceived = false;
      const timeoutId = setTimeout(() => {
        if (!responseReceived) {
          console.log('[Popup] Таймаут ожидания ответа (3 секунды)');
          statusDiv.textContent = 'Нет ответа от страницы. Перезагрузите страницу (Ctrl+R)';
          statusDiv.className = 'status disabled';
          monitorBtn.disabled = true;
          monitorBtn.classList.remove('enable', 'disable');
        }
      }, 3000);

      try {
        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, function (response) {
          responseReceived = true;
          clearTimeout(timeoutId);

          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.log('[Popup] Ошибка подключения:', errorMsg);
            if (errorMsg && (errorMsg.includes('Could not establish connection') || errorMsg.includes('Receiving end does not exist'))) {
              statusDiv.textContent = 'Расширение не инициализировано. Перезагрузите страницу (Ctrl+R)';
            } else {
              statusDiv.textContent = `Ошибка: ${errorMsg}`;
            }
            statusDiv.className = 'status disabled';
            monitorBtn.disabled = true;
            monitorBtn.classList.remove('enable', 'disable');
            return;
          }

          if (!response) {
            statusDiv.textContent = 'Нет ответа от страницы';
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
          monitorBtn.classList.remove('enable', 'disable');
          if (monitorBtn.textContent === 'Включить') {
            monitorBtn.classList.add('enable');
          } else {
            monitorBtn.classList.add('disable');
          }
          monitorInfo.textContent = enabled ? 'Активен' : 'Остановлен';
        });
      } catch (error) {
        console.error('[Popup] Ошибка при отправке сообщения:', error);
        statusDiv.textContent = 'Ошибка отправки: ' + error.message;
        statusDiv.className = 'status disabled';
        monitorBtn.disabled = true;
        clearTimeout(timeoutId);
      }
    });
  }

  // --- Переключение мониторинга ---
  monitorBtn.addEventListener('click', function () {
    getTargetTab(function (tab) {
      if (!tab) {
        alert('Нет активной вкладки');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { action: 'toggle' }, function (response) {
        if (chrome.runtime.lastError) {
          alert('Ошибка: убедитесь, что страница полностью загружена');
          return;
        }
        updateStatus();
      });
    });
  });

  // --- Активация ключа ---
  activateBtn.addEventListener('click', function () {
    statusDiv.textContent = "Проверка ключа активации...";
    Auth.register(activationKeyInput.value)
      .then(registerResult => {
        if (!registerResult.success) {
          statusDiv.textContent = registerResult.error;
          statusDiv.className = 'status disabled';
          return;
        }
        Auth.login().then(loginResult => {
          if (!loginResult.success) {
            statusDiv.textContent = registerResult.error || 'Ошибка входа';
            statusDiv.className = 'status disabled';
            return;
          }
          activationWrapper.style.display = 'none';
          monitorOptionsWrapper.style.display = 'flex';
          Auth.hasActiveSubscription().then(isHas => {
            if (!isHas) {
              monitorBtn.disabled = true;
              statusDiv.textContent = '⚠️ Требуется активная подписка';
              statusDiv.className = 'status disabled';
              monitorBtn.disabled = true;
            } else {
              chrome.storage.local.get(['subscriptionEndDate'], function (getResponse) {
                subscriptionDateDiv.textContent = `Подписка активна до: ${getResponse.subscriptionEndDate}`;
                subscriptionDateDiv.className = 'subscription-date';
                monitorBtn.disabled = false;
                statusDiv.textContent = '✅ Подписка активна';
                statusDiv.className = 'status active';
              });
            }
          });
        });
      })
      .catch(error => {
        console.error('Ошибка регистрации:', error);
      });
  });

  // --- Звуки ---
  soundToggle.addEventListener('change', function (event) {
    const isEnabled = event.target.checked;
    if (isEnabled) {
      console.log('🎵 Звуки включены');
      chrome.runtime.sendMessage({ action: 'onSounds' });
    } else {
      console.log('🔇 Звуки выключены');
      chrome.runtime.sendMessage({ action: 'offSounds' });
    }
  });

  // --- Запуск обновления статуса ---
  updateStatus();
});