/**
 * Backend для приложения "Здоровье" — Google Таблица как простая мульти-пользовательская БД.
 *
 * Два листа (создаются автоматически при первом запросе, вручную ничего готовить не нужно):
 * - "Users"   — email | passwordHash | userId | createdAt
 * - "AppData" — key (вида "userId:formData") | value (JSON)
 *
 * ОБНОВЛЕНИЕ СУЩЕСТВУЮЩЕГО ДЕПЛОЯ:
 * 1. Откройте Apps Script вашего проекта.
 * 2. Выделите весь код в редакторе (Cmd+A), удалите, вставьте содержимое этого файла целиком.
 * 3. Сохраните (Cmd+S).
 * 4. Deploy → Manage deployments → ✏️ у активного деплоя → Version: "New version" → Deploy.
 *    (URL остаётся тем же — повторно вставлять в index.html не нужно, если вы не меняли Who has access)
 *
 * Если ещё не разворачивали: Deploy → New deployment → Web app,
 * Execute as: Me, Who has access: Anyone.
 */

function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(['email', 'passwordHash', 'userId', 'createdAt']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAppDataSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AppData');
  if (!sheet) {
    sheet = ss.insertSheet('AppData');
    sheet.appendRow(['key', 'value']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findUserByEmail_(email) {
  var sheet = getUsersSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase() === email) {
      return { row: i + 1, email: rows[i][0], passwordHash: rows[i][1], userId: rows[i][2], createdAt: rows[i][3] };
    }
  }
  return null;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Чтение данных конкретного пользователя: GET ?userId=... ----------
function doGet(e) {
  var userId = e.parameter && e.parameter.userId;
  if (!userId) return jsonOut_({});

  var sheet = getAppDataSheet_();
  var rows = sheet.getDataRange().getValues();
  var prefix = userId + ':';
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0];
    if (!key || key.indexOf(prefix) !== 0) continue;
    var shortKey = key.substring(prefix.length);
    try {
      result[shortKey] = JSON.parse(rows[i][1]);
    } catch (err) {
      result[shortKey] = rows[i][1];
    }
  }
  return jsonOut_(result);
}

// ---------- Регистрация / вход / сохранение данных: POST ----------
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ status: 'error', message: 'Некорректный запрос' });
  }

  if (payload.action === 'register') return handleRegister_(payload);
  if (payload.action === 'login') return handleLogin_(payload);
  return handleSaveData_(payload);
}

function handleRegister_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var passwordHash = payload.passwordHash;
  if (!email || !passwordHash) return jsonOut_({ status: 'error', message: 'Заполните email и пароль' });

  var existing = findUserByEmail_(email);
  if (existing) return jsonOut_({ status: 'error', message: 'Этот email уже зарегистрирован' });

  var userId = Utilities.getUuid();
  var sheet = getUsersSheet_();
  sheet.appendRow([email, passwordHash, userId, new Date().toISOString()]);

  return jsonOut_({ status: 'ok', userId: userId, email: email });
}

function handleLogin_(payload) {
  var email = String(payload.email || '').trim().toLowerCase();
  var passwordHash = payload.passwordHash;
  if (!email || !passwordHash) return jsonOut_({ status: 'error', message: 'Заполните email и пароль' });

  var user = findUserByEmail_(email);
  if (!user) return jsonOut_({ status: 'error', message: 'Пользователь с таким email не найден' });
  if (user.passwordHash !== passwordHash) return jsonOut_({ status: 'error', message: 'Неверный пароль' });

  return jsonOut_({ status: 'ok', userId: user.userId, email: user.email });
}

function handleSaveData_(payload) {
  var userId = payload.userId;
  if (!userId) return jsonOut_({ status: 'error', message: 'Не указан userId' });

  var sheet = getAppDataSheet_();
  var rows = sheet.getDataRange().getValues();
  var rowIndexByKey = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) rowIndexByKey[rows[i][0]] = i + 1;
  }

  Object.keys(payload).forEach(function (key) {
    if (key === 'userId' || key === 'action') return;
    var fullKey = userId + ':' + key;
    var value = JSON.stringify(payload[key]);
    if (rowIndexByKey[fullKey]) {
      sheet.getRange(rowIndexByKey[fullKey], 2).setValue(value);
    } else {
      sheet.appendRow([fullKey, value]);
    }
  });

  return jsonOut_({ status: 'ok' });
}
