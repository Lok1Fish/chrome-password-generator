const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMBERS = "0123456789";
const SYMBOLS = "!\"\$%&'()+, -./:;<=>?@[]^_{|}~`";

const lengthSlider = document.getElementById('length');
const lenVal = document.getElementById('lenVal');
const passwordInput = document.getElementById('passwordResult');
const historyContainer = document.getElementById('historyContainer');
const checkboxGroup = document.getElementById('checkboxGroup');

// Элементы настроек
const chkLowercase = document.getElementById('chkLowercase');
const chkUppercase = document.getElementById('chkUppercase');
const chkNumbers = document.getElementById('chkNumbers');
const chkSymbols = document.getElementById('chkSymbols');
const btnGovMode = document.getElementById('btnGovMode');

let isGovMode = false;

// Переключение режима «Для госсервисов»
btnGovMode.addEventListener('click', () => {
  isGovMode = !isGovMode;
  if (isGovMode) {
    btnGovMode.textContent = "🇷🇺 Режим: Для госсервисов (ВКЛ)";
    btnGovMode.classList.add('active');
    checkboxGroup.classList.add('disabled'); // блокируем чекбоксы
    
    // По правилам госсервисов нужно минимум 8 знаков
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
});

lengthSlider.addEventListener('input', () => {
  lenVal.textContent = lengthSlider.value;
});

document.addEventListener('DOMContentLoaded', updateHistoryDOM);

// Генерация пароля с учетом жесткой валидации
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

  if (allowedChars === "") {
    passwordInput.value = "Выберите настройки!";
    return;
  }

  const length = parseInt(lengthSlider.value);
  let password = "";
  let attempts = 0;

  // Цикл работает, пока пароль не пройдет проверку госсервисов (если режим активен)
  while (attempts < 1000) {
    password = "";
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
      password += allowedChars[randomValues[i] % allowedChars.length];
    }

    // Если обычный режим — валидация не нужна, выходим сразу
    if (!isGovMode) break;

    // В режиме госсервисов проверяем жесткое присутствие каждого обязательного типа
    const hasLower = [...password].some(c => LOWERCASE.includes(c));
    const hasUpper = [...password].some(c => UPPERCASE.includes(c));
    const hasNum = [...password].some(c => NUMBERS.includes(c));
    const hasSym = [...password].some(c => SYMBOLS.includes(c));

    if (hasLower && hasUpper && hasNum && hasSym) {
      break; // Все требования выполнены
    }
    attempts++;
  }
  
  passwordInput.value = password;

  // Определение сайта
  let siteName = "Неизвестный сайт";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const urlObj = new URL(tab.url);
      siteName = urlObj.hostname || "Внутренняя страница";
    }
  } catch (e) { console.error(e); }

  // Дата и время
  const now = new Date();
  const dateTimeStr = now.toLocaleString('ru-RU', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit', second: '2-digit' 
  });

  // Если был включен режим госсервисов, сделаем пометку в истории рядом с сайтом
  const displayedSite = isGovMode ? `🇷🇺 [Гос] ${siteName}` : siteName;

  saveToHistory({ password, site: displayedSite, time: dateTimeStr });
});

// Скопировать основной пароль
document.getElementById('copy').addEventListener('click', () => {
  if (!passwordInput.value || passwordInput.value === "Выберите настройки!") return;
  copyToClipboard(passwordInput.value, passwordInput);
});

// Очистить историю
document.getElementById('clearHistory').addEventListener('click', () => {
  chrome.storage.local.set({ passwordHistory: [] }, updateHistoryDOM);
});

function copyToClipboard(text, elementToAnimate) {
  navigator.clipboard.writeText(text).then(() => {
    if (elementToAnimate.tagName === 'INPUT') {
      const originalText = elementToAnimate.value;
      elementToAnimate.value = "Скопировано!";
      setTimeout(() => { elementToAnimate.value = originalText; }, 1000);
    } else {
      const originalText = elementToAnimate.textContent;
      elementToAnimate.textContent = "✓";
      setTimeout(() => { elementToAnimate.textContent = originalText; }, 1000);
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
    history.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'history-item';
      
      const infoEl = document.createElement('div');
      infoEl.className = 'history-info';
      infoEl.innerHTML = `
        <strong>${escapeHtml(item.password)}</strong>
        <div class="meta">${escapeHtml(item.site)} | ${item.time}</div>
      `;
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn-mini-copy';
      copyBtn.textContent = 'Копи';
      copyBtn.addEventListener('click', () => copyToClipboard(item.password, copyBtn));

      itemEl.appendChild(infoEl);
      itemEl.appendChild(copyBtn);
      historyContainer.appendChild(itemEl);
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
