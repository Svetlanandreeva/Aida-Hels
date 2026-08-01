/**
 * Backend для приложения "Здоровье" — превращает Google Таблицу в простое API.
 * Хранит данные в виде пар ключ→значение (JSON) на листе "AppData".
 *
 * УСТАНОВКА:
 * 1. Создайте новую пустую Google Таблицу (sheets.google.com → пустой файл).
 * 2. В таблице: Расширения → Apps Script.
 * 3. Удалите весь код-заглушку в открывшемся редакторе, вставьте вместо него содержимое этого файла целиком.
 * 4. Нажмите "Развернуть" (Deploy) → "Новое развёртывание" (New deployment).
 * 5. Тип: "Веб-приложение" (Web app).
 *    - Execute as: Me
 *    - Who has access: Anyone (важно! иначе сайт не сможет достучаться)
 * 6. Нажмите "Развернуть", разрешите доступ (это ваш собственный скрипт к вашей же таблице).
 * 7. Скопируйте выданный URL веб-приложения (заканчивается на /exec).
 * 8. Вставьте этот URL в index.html вместо 'ВСТАВЬТЕ_СЮДА_URL_ПОСЛЕ_ДЕПЛОЯ' (константа GOOGLE_SCRIPT_URL в начале <script>).
 *
 * Лист "AppData" создастся в таблице автоматически при первом запросе — ничего создавать вручную не нужно.
 * Если захотите отредактировать данные вручную — открывайте таблицу и правьте значения в колонке B
 * (там лежит JSON, будьте аккуратны с кавычками/запятыми, чтобы не сломать структуру).
 */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('AppData');
  if (!sheet) {
    sheet = ss.insertSheet('AppData');
    sheet.appendRow(['key', 'value']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Чтение всех данных: GET-запрос без параметров возвращает весь объект целиком
function doGet(e) {
  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0];
    var value = rows[i][1];
    if (!key) continue;
    try {
      result[key] = JSON.parse(value);
    } catch (err) {
      result[key] = value;
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Запись данных: POST с JSON-телом вида { formData: {...}, uploadedFiles: {...}, ... }
// Каждый ключ верхнего уровня сохраняется/обновляется отдельной строкой
function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON' }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = getSheet_();
  var rows = sheet.getDataRange().getValues();
  var rowIndexByKey = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) rowIndexByKey[rows[i][0]] = i + 1; // строки в Sheets нумеруются с 1
  }

  Object.keys(payload).forEach(function (key) {
    var value = JSON.stringify(payload[key]);
    if (rowIndexByKey[key]) {
      sheet.getRange(rowIndexByKey[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
