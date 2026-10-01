const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "!\"\$%&'()+, -./:;<=>?@[]^_{|}~`";
const SIMILAR_CHARS = ["l", "I", "1", "o", "O", "0"];

const lengthSlider = document.getElementById('length');
const lenVal = document.getElementById('lenVal');
const passwordInput = document.getElementById('passwordResult');
const historyContainer = document.getElementById('historyContainer');
const checkboxGroup = document.getElementById('checkboxGroup');

const chkLowercase = document.getElementById('chkLowercase');
const chkUppercase = document.getElementById('chkUppercase');
const chkNumbers = document.getElementById('chkNumbers');
const chkSymbols = document.getElementById('chkSymbols');
const chkExcludeSimilar = document.getElementById('chkExcludeSimilar');
const btnGovMode = document.getElementById('btnGovMode');

let isGovMode = false;

// Включение/выключение режима госсервисов
btnGovMode.addEventListener('click', () => {
  isGovMode = !isGovMode;
  if (isGovMode) {
    btnGovMode.textContent = "🇷🇺 Режим: Для госсервисов (ВКЛ)";
    btnGovMode.classList.add('active');
    checkboxGroup.classList.add('disabled');
    lengthSlider.min = 8;
    if (parseInt(lengthSlider.value) < 8) {
      lengthSlider.value = 8;
      lenVal.textContent = 8;
    }
  } else {
    btnGovMode.textContent = "🇷🇺 Режим: Для госсервисов (ВЫКЛ)";
    btnGovMode.classList.remove('active');
    checkboxGroup.classList.remove('disabled');
    lengthSlider.min = 6;
  }
  // Пересчитываем сложность, если в поле уже есть текст ошибки
  if (passwordInput.value === "Выберите настройки!") checkPasswordStrength("");
});

lengthSlider.addEventListener('input', () => {
  lenVal.textContent = lengthSlider.value;
});

document.addEventListener('DOMContentLoaded', updateHistoryDOM);

// Генерация пароля
document.getElementById('generate').addEventListener('click', async () => {
  let allowedChars = "";
  
  if (isGovMode) {
    allowedChars = LOWERCASE + UPPERCASE + NUMBERS + SYMBOLS;
  } else {
    if (chkLowercase.checked) allowedChars += LOWERCASE;
    if (chkUppercase.checked) allowedChars += UPPERCASE;
    if (chkNumbers.checked) allowedChars += NUMBERS;
    if (chkSymbols.checked) allowedChars += SYMBOLS;
  }

  if (chkExcludeSimilar.checked) {
    allowedChars = allowedChars.split('').filter(char => !SIMILAR_CHARS.includes(char)).join('');
  }

  if (allowedChars === "") {
    passwordInput.value = "Выберите настройки!";
    checkPasswordStrength("");
    return;
  }

  const length = parseInt(lengthSlider.value);
  let password = "";
  let attempts = 0;

  while (attempts < 1000) {
    password = "";
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      password += allowedChars[randomValues[i] % allowedChars.length];
    }

    if (!isGovMode) break;

    const hasLower = [...password].some(c => LOWERCASE.includes(c));
    const hasUpper = [...password].some(c => UPPERCASE.includes(c));
    const hasNum = [...password].some(c => NUMBERS.includes(c));
    const hasSym = [...password].some(c => SYMBOLS.includes(c));

    if (hasLower && hasUpper && hasNum && hasSym) break;
    attempts++;
  }
  
  passwordInput.value = password;
  
  // Вызов функции проверки сложности пароля
  checkPasswordStrength(password);

  // Определение сайта
  let siteName = "Неизвестный сайт";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const urlObj = new URL(tab.url);
      siteName = urlObj.hostname || "Внутренняя страница";
    }
  } catch (e) { console.error(e); }

  const now = new Date();
  const dateTimeStr = now.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });

  const displayedSite = isGovMode ? `🇷🇺 [Гос] \${siteName}` : siteName;
  saveToHistory({ password, site: displayedSite, time: dateTimeStr });
});

// Кнопка копирования главного пароля
document.getElementById('copy').addEventListener('click', () => {
  if (!passwordInput.value || passwordInput.value === "Выберите настройки!") return;
  copyToClipboard(passwordInput.value, document.getElementById('copy'), "Копировать", "Скопировано!");
});

// Очистить историю
document.getElementById('clearHistory').addEventListener('click', () => {
  chrome.storage.local.set({ passwordHistory: [] }, updateHistoryDOM);
});

// Функция оценки надежности пароля
function checkPasswordStrength(password) {
  const bar = document.getElementById('strengthBar');
  const text = document.getElementById('strengthText');
  
  if (!password) {
    bar.style.width = "0%";
    text.textContent = "";
    return;
  }

  let score = 0;
  
  // Очки за длину
  if (password.length >= 8) score += 1;
  if (password.length >= 14) score += 1;
  
  // Очки за разнообразие символов
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  // Экранируем минус внутри регулярного выражения
  if (/[!"$%&'()+, \-./:;<=>?@[\]^_{|}~`]/.test(password)) score += 1;

  // Рассчитываем и визуализируем результат
  if (score <= 3) {
    bar.style.width = "33%";
    bar.style.background = "#dc3545"; // Красный
    text.textContent = "⚠️ Слабый пароль (легко взломать)";
    text.style.color = "#dc3545";
  } else if (score === 4 || score === 5) {
    bar.style.width = "66%";
    bar.style.background = "#ffc107"; // Желтый
    text.textContent = "🟨 Средний пароль";
    text.style.color = "#b58100";
  } else {
    bar.style.width = "100%";
    bar.style.background = "#28a745"; // Зеленый
    text.textContent = "✅ Отличный, надежный пароль!";
    text.style.color = "#28a745";
  }
}

function copyToClipboard(text, element, originalText, successText) {
  navigator.clipboard.writeText(text).then(() => {
    if (element.tagName === 'BUTTON' && !element.classList.contains('btn-action')) {
      element.textContent = successText;
      setTimeout(() => { element.textContent = originalText; }, 1000);
    } else {
      const oldHtml = element.innerHTML;
      element.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { element.innerHTML = oldHtml; }, 1000);
    }
  });
}

function saveToHistory(newItem) {
  chrome.storage.local.get({ passwordHistory: [] }, (data) => {
    const history = data.passwordHistory;
    history.unshift(newItem);
    if (history.length > 30) history.pop();
    chrome.storage.local.set({ passwordHistory: history }, updateHistoryDOM);
  });
}

function updateHistoryDOM() {
  chrome.storage.local.get({ passwordHistory: [] }, (data) => {
    const history = data.passwordHistory;
    
    if (history.length === 0) {
      historyContainer.innerHTML = 'Нет записей';
      return;
    }

    historyContainer.innerHTML = '';
    history.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      const infoEl = document.createElement('div');
      infoEl.className = 'history-info';
      
      const maskedPassword = "•".repeat(item.password.length);
      
      infoEl.innerHTML = `
        <strong class="password-text" id="pass-${index}" data-raw="${escapeHtml(item.password)}">${maskedPassword}</strong>
        <div class="meta">${escapeHtml(item.site)} | ${item.time}</div>
      `;
      
      const actionsEl = document.createElement('div');
      actionsEl.className = 'actions-group';

      const viewBtn = document.createElement('button');
      viewBtn.className = 'btn-action';
      viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
      viewBtn.addEventListener('click', () => {
        const passTextEl = document.getElementById(`pass-${index}`);
        const isMasked = passTextEl.textContent.includes('•');
        if (isMasked) {
          passTextEl.textContent = passTextEl.getAttribute('data-raw');
          viewBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
        } else {
          passTextEl.textContent = "•".repeat(passTextEl.getAttribute('data-raw').length);
          viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
        }
      });

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-action btn-copy-mini';
      copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
      copyBtn.addEventListener('click', () => copyToClipboard(item.password, copyBtn));

      actionsEl.appendChild(viewBtn);
      actionsEl.appendChild(copyBtn);
      itemEl.appendChild(infoEl);
      itemEl.appendChild(actionsEl);
      historyContainer.appendChild(itemEl);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
