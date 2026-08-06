/**
 * GOOGLE APPS SCRIPT BACKEND PROXY FOR AIDA HEALTH MEDICAL DOCUMENT RECOGNITION
 * 
 * Instructions:
 * 1. Open Google Apps Script (https://script.google.com).
 * 2. Create or open your project linked to Google Sheets.
 * 3. Go to Project Settings (Gear icon) -> Script Properties.
 * 4. Add Script Property:
 *    - Property Name: GEMINI_API_KEY
 *    - Value: <Your Google Gemini API Key>
 * 5. Replace Code.gs with this file content.
 * 6. Click 'Deploy' -> 'New Deployment' -> Select 'Web App'.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the Web App URL and set it in process.env.GOOGLE_SHEETS_WEB_APP_URL in Node.js server environment.
 */

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var action = req.action;
    var payload = req.payload || req;

    if (action === 'recognizeMedicalDocument' || action === 'recognize') {
      var recResult = recognizeMedicalDocument(payload);
      return ContentService.createTextOutput(JSON.stringify(recResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'saveRecognizedDocument') {
      var saveResult = saveRecognizedDocumentToSheet(payload);
      return ContentService.createTextOutput(JSON.stringify(saveResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Aida Health Apps Script Server is running.'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Server-side Gemini API proxy for medical document OCR (JPG, PNG, PDF).
 * Strictly requires GEMINI_API_KEY in Script Properties.
 */
function recognizeMedicalDocument(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      success: false,
      error: 'GEMINI_API_KEY не установлен в Настройках проекта (Script Properties) Google Apps Script.'
    };
  }

  if (!payload || !payload.fileBase64) {
    return {
      success: false,
      error: 'Отсутствует файл (fileBase64) для распознавания.'
    };
  }

  var mimeType = payload.mimeType || 'image/jpeg';
  var fileName = payload.fileName || 'Анализ';

  var systemInstruction = 
    "Ты — профессиональный серверный модуль OCR и структурированного извлечения данных из медицинских бланков, выписок и файлов результатов анализов (JPG, PNG, PDF).\n" +
    "Ты НЕ ставишь диагнозы и НЕ даёшь рекомендаций.\n\n" +
    "ТВОЯ ЕДИНСТВЕННАЯ ЗАДАЧА — ВЫДАТЬ ЧИСТЫЙ JSON БЕЗ MARKDOWN ОБЁРТОК И БЕЗ ВВОДНОГО ТЕКСТА.\n\n" +
    "ОЖИДАЕМЫЙ СТРОГИЙ ФОРМАТ JSON:\n" +
    "{\n" +
    '  "documentType": "lab_results",\n' +
    '  "documentDate": "YYYY-MM-DD",\n' +
    '  "laboratory": "Название лаборатории или пустая строка",\n' +
    '  "patientName": "ФИО пациента если есть в документе или пустая строка",\n' +
    '  "markers": [\n' +
    "    {\n" +
    '      "name": "Название показателя (например Гемоглобин)",\n' +
    '      "value": 132,\n' +
    '      "rawValue": "132",\n' +
    '      "unit": "г/л",\n' +
    '      "min": 120,\n' +
    '      "max": 150,\n' +
    '      "normalRange": "120–150",\n' +
    '      "status": "normal",\n' +
    '      "confidence": 0.96\n' +
    "    }\n" +
    "  ],\n" +
    '  "warnings": []\n' +
    "}\n\n" +
    "СТРОГИЕ ПРАВИЛА:\n" +
    "1. ЗАПРЕЩЕНО ПРИДУМЫВАТЬ ИЛИ ГЕНЕРИРОВАТЬ ФИКТИВНЫЕ/СЛУЧАЙНЫЕ ПОКАЗАТЕЛИ! Извлекай ТОЛЬКО то, что физически написано в документе.\n" +
    "2. Если конкретное значение или референсный диапазон отсутствует или не читается:\n" +
    "   - Установи value: null, min: null, max: null;\n" +
    '   - Добавь понятное текстовое предупреждение в массив "warnings" (например: "Не удалось четко разобрать норму для показателя X");\n' +
    "   - Не подставляй случайные данные из интернета.\n" +
    '3. Поле status должно принимать строго одно из значений: "normal", "high", "low", "unknown".\n' +
    '4. Если документ не относится к медицине, не содержит анализов или полностью поврежден/нечитаем — верни верный JSON с пустым массивом "markers" и понятной причиной в "warnings".';

  var parts = [
    {
      inline_data: {
        mime_type: mimeType === 'application/pdf' ? 'application/pdf' : mimeType,
        data: payload.fileBase64
      }
    },
    {
      text: 'Точно распознай медицинский документ "' + fileName + '". Верни только чистый JSON согласно спецификации.'
    }
  ];

  var requestBody = {
    contents: [{ parts: parts }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.1,
      response_mime_type: "application/json"
    }
  };

  var apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey;

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseText = response.getContentText();
    var jsonRes = JSON.parse(responseText);

    if (jsonRes.error) {
      return {
        success: false,
        error: jsonRes.error.message || 'Ошибка вызова Gemini API'
      };
    }

    var rawOutput = jsonRes.candidates[0].content.parts[0].text;
    var cleanJson = rawOutput.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
    var parsedData = JSON.parse(cleanJson);

    return {
      success: true,
      data: parsedData
    };
  } catch (err) {
    return {
      success: false,
      error: 'Сбой выполнения в Google Apps Script: ' + err.toString()
    };
  }
}

/**
 * Saves recognized document markers to a Google Sheet.
 */
function saveRecognizedDocumentToSheet(payload) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Medical_Documents');
    if (!sheet) {
      sheet = ss.insertSheet('Medical_Documents');
      sheet.appendRow([
        'Timestamp',
        'Document ID',
        'Document Type',
        'Laboratory',
        'Research Date',
        'Marker Name',
        'Value',
        'Unit',
        'Reference Range',
        'Status'
      ]);
      sheet.getRange('1:1').setFontWeight('bold').setBackground('#101A28').setFontColor('#34F5A4');
    }

    var docId = payload.document_id || ('doc-' + Date.now());
    var docType = payload.document_type || 'Анализ';
    var lab = payload.laboratory_name || '';
    var date = payload.research_date || new Date().toISOString().split('T')[0];
    var results = payload.results || payload.markers || [];

    for (var i = 0; i < results.length; i++) {
      var item = results[i];
      sheet.appendRow([
        new Date(),
        docId,
        docType,
        lab,
        date,
        item.originalName || item.name || '',
        item.value !== null ? item.value : (item.rawValue || ''),
        item.unit || '',
        item.referenceText || item.normalRange || '',
        item.status || 'unknown'
      ]);
    }

    return { success: true, savedRows: results.length };
  } catch (err) {
    return { success: false, error: err.toString() };
  }
}
