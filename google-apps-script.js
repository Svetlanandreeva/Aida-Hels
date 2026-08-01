/**
 * GOOGLE APPS SCRIPT BACKEND FOR «ЗДОРОВЬЕ» APP
 * 
 * Инструкция по развертыванию:
 * 1. Создайте новую Google Таблицу (Google Sheets).
 * 2. Откройте: Расширения -> Apps Script.
 * 3. Вставьте данный код в файл Code.gs.
 * 4. Нажмите "Развернуть" -> "Новое развертывание".
 * 5. Выберите тип: "Веб-приложение".
 * 6. "Запуск от имени": "Меня" (Me).
 * 7. "У кого есть доступ": "Все" (Anyone).
 * 8. Нажмите "Развернуть" и скопируйте URL веб-приложения в настройки приложения «Здоровье».
 */

// Таблицы и листы
var SHEET_NAMES = {
  USERS: 'USERS',
  PROFILE: 'PROFILE',
  MEDICATIONS: 'MEDICATIONS',
  DIARY: 'DIARY',
  RESEARCH_DOCUMENTS: 'RESEARCH_DOCUMENTS',
  LAB_RESULTS: 'LAB_RESULTS',
  APPOINTMENTS: 'APPOINTMENTS',
  NOTIFICATIONS: 'NOTIFICATIONS',
  AI_INSIGHTS: 'AI_INSIGHTS',
  AUDIT_LOG: 'AUDIT_LOG'
};

// Заголовки листов
var HEADERS = {
  USERS: ['user_id', 'email', 'name', 'birth_date', 'sex', 'height', 'weight', 'blood_type', 'created_at', 'updated_at', 'consent_version', 'consent_at', 'is_active'],
  PROFILE: ['profile_id', 'user_id', 'chronic_conditions', 'allergies', 'diagnoses', 'health_notes', 'cycle_data', 'lifestyle_data', 'updated_at'],
  MEDICATIONS: ['medication_id', 'user_id', 'name', 'dosage', 'unit', 'schedule', 'start_date', 'end_date', 'intake_time', 'instructions', 'is_active', 'created_at', 'updated_at'],
  DIARY: ['entry_id', 'user_id', 'entry_datetime', 'state_score', 'energy_score', 'anxiety_score', 'stress_score', 'moods', 'event_categories', 'event_description', 'thoughts', 'reactions', 'helpful_actions', 'sleep_duration', 'sleep_quality', 'physical_activity', 'cycle_day', 'additional_note', 'ai_summary', 'detected_triggers', 'detected_resource_factors', 'risk_level', 'created_at', 'updated_at'],
  RESEARCH_DOCUMENTS: ['document_id', 'user_id', 'drive_file_id', 'drive_file_url', 'original_file_name', 'mime_type', 'upload_datetime', 'document_type', 'laboratory_name', 'research_date', 'recognition_status', 'recognition_confidence', 'raw_text', 'ai_summary', 'processing_error', 'created_at', 'updated_at'],
  LAB_RESULTS: ['result_id', 'document_id', 'user_id', 'research_date', 'category', 'marker_original_name', 'marker_normalized_name', 'value', 'unit', 'reference_min', 'reference_max', 'reference_text', 'status', 'source_page', 'confidence', 'manual_confirmation', 'created_at'],
  APPOINTMENTS: ['appointment_id', 'user_id', 'doctor_name', 'specialization', 'appointment_datetime', 'clinic', 'notes', 'status', 'created_at', 'updated_at'],
  NOTIFICATIONS: ['notification_id', 'user_id', 'type', 'title', 'message', 'scheduled_at', 'status', 'related_entity_id', 'created_at'],
  AI_INSIGHTS: ['insight_id', 'user_id', 'insight_type', 'period_start', 'period_end', 'title', 'description', 'supporting_factors', 'confidence', 'created_at'],
  AUDIT_LOG: ['log_id', 'user_id', 'action', 'entity_type', 'entity_id', 'timestamp', 'result', 'error_message']
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  // Ожидание блокировки до 10 секунд для предотвращения гонки запросов
  if (!lock.tryLock(10000)) {
    return createJsonResponse(false, null, { code: 'LOCK_TIMEOUT', message: 'Сервер занят, повторите попытку.' });
  }

  try {
    ensureSheetsExist();

    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }

    var action = requestData.action;
    var userId = requestData.userId;
    var payload = requestData.payload || {};

    if (!action) {
      return createJsonResponse(false, null, { code: 'INVALID_ACTION', message: 'Не указано действие action' });
    }

    var result;
    switch (action) {
      case 'createUser':
        result = handleCreateUser(payload);
        break;
      case 'getUserProfile':
        result = handleGetUserProfile(userId);
        break;
      case 'updateUserProfile':
        result = handleUpdateUserProfile(userId, payload);
        break;
      case 'createDiaryEntry':
        result = handleCreateDiaryEntry(userId, payload);
        break;
      case 'getDiaryEntries':
        result = handleGetDiaryEntries(userId);
        break;
      case 'updateDiaryEntry':
        result = handleUpdateDiaryEntry(userId, payload);
        break;
      case 'deleteDiaryEntry':
        result = handleDeleteDiaryEntry(userId, payload.entryId);
        break;
      case 'addMedication':
        result = handleAddMedication(userId, payload);
        break;
      case 'getMedications':
        result = handleGetMedications(userId);
        break;
      case 'updateMedication':
        result = handleUpdateMedication(userId, payload);
        break;
      case 'deleteMedication':
        result = handleDeleteMedication(userId, payload.medicationId);
        break;
      case 'uploadResearchMetadata':
        result = handleUploadResearchMetadata(userId, payload);
        break;
      case 'saveRecognizedDocument':
        result = handleSaveRecognizedDocument(userId, payload);
        break;
      case 'getResearchDocuments':
        result = handleGetResearchDocuments(userId);
        break;
      case 'getLabResults':
        result = handleGetLabResults(userId);
        break;
      case 'updateLabResult':
        result = handleUpdateLabResult(userId, payload);
        break;
      case 'deleteResearchDocument':
        result = handleDeleteResearchDocument(userId, payload.documentId);
        break;
      case 'saveAIInsight':
        result = handleSaveAIInsight(userId, payload);
        break;
      case 'getDashboardData':
        result = handleGetDashboardData(userId);
        break;
      default:
        return createJsonResponse(false, null, { code: 'UNKNOWN_ACTION', message: 'Неизвестное действие: ' + action });
    }

    logAudit(userId, action, 'GENERAL', '', 'SUCCESS', '');
    return createJsonResponse(true, result, null);

  } catch (err) {
    logAudit(userId || 'ANONYMOUS', action || 'UNKNOWN', 'ERROR', '', 'FAILURE', err.toString());
    return createJsonResponse(false, null, { code: 'INTERNAL_ERROR', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Health App Google Apps Script API Active")
    .setMimeType(ContentService.MimeType.TEXT);
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ТАБЛИЦЫ
// ==========================================

function getSs() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheetsExist() {
  var ss = getSs();
  for (var key in SHEET_NAMES) {
    var sheetName = SHEET_NAMES[key];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(HEADERS[key]);
      sheet.getRange(1, 1, 1, HEADERS[key].length).setFontWeight("bold");
    }
  }
}

function createJsonResponse(success, data, error) {
  var response = {
    success: success,
    data: data,
    error: error
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateUuid() {
  return Utilities.getUuid();
}

function logAudit(userId, action, entityType, entityId, result, errorMessage) {
  try {
    var sheet = getSs().getSheetByName(SHEET_NAMES.AUDIT_LOG);
    if (!sheet) return;
    sheet.appendRow([
      generateUuid(),
      userId || '',
      action || '',
      entityType || '',
      entityId || '',
      new Date().toISOString(),
      result || '',
      errorMessage || ''
    ]);
  } catch (e) {
    // Ignore audit log error
  }
}

function findRowsByField(sheetName, fieldIndex, targetValue) {
  var sheet = getSs().getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0];
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[fieldIndex] === targetValue) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = row[j];
      }
      obj._rowIndex = i + 1; // 1-based row index
      results.push(obj);
    }
  }
  return results;
}

// ==========================================
// ОБРАБОТЧИКИ ДЕЙСТВИЙ (ACTION HANDLERS)
// ==========================================

function handleCreateUser(payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.USERS);
  var userId = payload.user_id || generateUuid();
  var now = new Date().toISOString();

  var existing = findRowsByField(SHEET_NAMES.USERS, 0, userId);
  if (existing.length > 0) {
    return existing[0];
  }

  sheet.appendRow([
    userId,
    payload.email || '',
    payload.name || '',
    payload.birth_date || '',
    payload.sex || 'female',
    payload.height || '',
    payload.weight || '',
    payload.blood_type || '',
    now,
    now,
    payload.consent_version || '1.0',
    now,
    true
  ]);

  return { user_id: userId, email: payload.email, name: payload.name };
}

function handleGetUserProfile(userId) {
  var userRows = findRowsByField(SHEET_NAMES.USERS, 0, userId);
  var profileRows = findRowsByField(SHEET_NAMES.PROFILE, 1, userId);

  var user = userRows.length > 0 ? userRows[0] : null;
  var profile = profileRows.length > 0 ? profileRows[0] : null;

  return {
    user: user,
    profile: profile
  };
}

function handleUpdateUserProfile(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.PROFILE);
  var now = new Date().toISOString();
  var rows = findRowsByField(SHEET_NAMES.PROFILE, 1, userId);

  if (rows.length > 0) {
    var rowIndex = rows[0]._rowIndex;
    sheet.getRange(rowIndex, 3).setValue(JSON.stringify(payload.chronic_conditions || []));
    sheet.getRange(rowIndex, 4).setValue(JSON.stringify(payload.allergies || []));
    sheet.getRange(rowIndex, 5).setValue(JSON.stringify(payload.diagnoses || []));
    sheet.getRange(rowIndex, 6).setValue(payload.health_notes || '');
    sheet.getRange(rowIndex, 7).setValue(JSON.stringify(payload.cycle_data || {}));
    sheet.getRange(rowIndex, 8).setValue(JSON.stringify(payload.lifestyle_data || {}));
    sheet.getRange(rowIndex, 9).setValue(now);
  } else {
    sheet.appendRow([
      generateUuid(),
      userId,
      JSON.stringify(payload.chronic_conditions || []),
      JSON.stringify(payload.allergies || []),
      JSON.stringify(payload.diagnoses || []),
      payload.health_notes || '',
      JSON.stringify(payload.cycle_data || {}),
      JSON.stringify(payload.lifestyle_data || {}),
      now
    ]);
  }
  return { updated: true, userId: userId };
}

function handleCreateDiaryEntry(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.DIARY);
  var entryId = payload.entry_id || generateUuid();
  var now = new Date().toISOString();

  sheet.appendRow([
    entryId,
    userId,
    payload.entry_datetime || now,
    payload.state_score || 7,
    payload.energy_score || 7,
    payload.anxiety_score || 3,
    payload.stress_score || 3,
    JSON.stringify(payload.moods || []),
    JSON.stringify(payload.event_categories || []),
    payload.event_description || '',
    payload.thoughts || '',
    JSON.stringify(payload.reactions || []),
    JSON.stringify(payload.helpful_actions || []),
    payload.sleep_duration || 7,
    payload.sleep_quality || 7,
    payload.physical_activity || '',
    payload.cycle_day || '',
    payload.additional_note || '',
    payload.ai_summary || '',
    JSON.stringify(payload.detected_triggers || []),
    JSON.stringify(payload.detected_resource_factors || []),
    payload.risk_level || 'none',
    now,
    now
  ]);

  return { entry_id: entryId, success: true };
}

function handleGetDiaryEntries(userId) {
  return findRowsByField(SHEET_NAMES.DIARY, 1, userId);
}

function handleUpdateDiaryEntry(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.DIARY);
  var rows = findRowsByField(SHEET_NAMES.DIARY, 0, payload.entry_id);
  if (rows.length === 0 || rows[0].user_id !== userId) {
    throw new Error('Запись не найдена или нет прав доступа');
  }
  var rowIndex = rows[0]._rowIndex;
  var now = new Date().toISOString();

  sheet.getRange(rowIndex, 4).setValue(payload.state_score);
  sheet.getRange(rowIndex, 5).setValue(payload.energy_score);
  sheet.getRange(rowIndex, 10).setValue(payload.event_description || '');
  sheet.getRange(rowIndex, 11).setValue(payload.thoughts || '');
  sheet.getRange(rowIndex, 24).setValue(now);

  return { updated: true, entry_id: payload.entry_id };
}

function handleDeleteDiaryEntry(userId, entryId) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.DIARY);
  var rows = findRowsByField(SHEET_NAMES.DIARY, 0, entryId);
  if (rows.length > 0 && rows[0].user_id === userId) {
    sheet.deleteRow(rows[0]._rowIndex);
    return { deleted: true, entry_id: entryId };
  }
  return { deleted: false };
}

function handleAddMedication(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.MEDICATIONS);
  var medId = payload.medication_id || generateUuid();
  var now = new Date().toISOString();

  sheet.appendRow([
    medId,
    userId,
    payload.name || '',
    payload.dosage || '',
    payload.unit || 'мг',
    payload.schedule || 'daily',
    payload.start_date || now,
    payload.end_date || '',
    payload.intake_time || '08:00',
    payload.instructions || '',
    true,
    now,
    now
  ]);

  return { medication_id: medId };
}

function handleGetMedications(userId) {
  return findRowsByField(SHEET_NAMES.MEDICATIONS, 1, userId);
}

function handleUpdateMedication(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.MEDICATIONS);
  var rows = findRowsByField(SHEET_NAMES.MEDICATIONS, 0, payload.medication_id);
  if (rows.length > 0 && rows[0].user_id === userId) {
    var rowIndex = rows[0]._rowIndex;
    sheet.getRange(rowIndex, 3).setValue(payload.name);
    sheet.getRange(rowIndex, 4).setValue(payload.dosage);
    sheet.getRange(rowIndex, 9).setValue(payload.intake_time);
    sheet.getRange(rowIndex, 11).setValue(payload.is_active);
    sheet.getRange(rowIndex, 13).setValue(new Date().toISOString());
    return { updated: true };
  }
  return { updated: false };
}

function handleDeleteMedication(userId, medicationId) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.MEDICATIONS);
  var rows = findRowsByField(SHEET_NAMES.MEDICATIONS, 0, medicationId);
  if (rows.length > 0 && rows[0].user_id === userId) {
    sheet.deleteRow(rows[0]._rowIndex);
    return { deleted: true };
  }
  return { deleted: false };
}

function handleUploadResearchMetadata(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.RESEARCH_DOCUMENTS);
  var docId = payload.document_id || generateUuid();
  var now = new Date().toISOString();

  sheet.appendRow([
    docId,
    userId,
    payload.drive_file_id || '',
    payload.drive_file_url || '',
    payload.original_file_name || '',
    payload.mime_type || '',
    now,
    payload.document_type || 'Общий анализ',
    payload.laboratory_name || '',
    payload.research_date || now.split('T')[0],
    payload.recognition_status || 'processing',
    payload.recognition_confidence || 0,
    payload.raw_text || '',
    payload.ai_summary || '',
    payload.processing_error || '',
    now,
    now
  ]);

  return { document_id: docId, status: 'processing' };
}

function handleSaveRecognizedDocument(userId, payload) {
  var docSheet = getSs().getSheetByName(SHEET_NAMES.RESEARCH_DOCUMENTS);
  var labSheet = getSs().getSheetByName(SHEET_NAMES.LAB_RESULTS);
  var docId = payload.document_id;
  var now = new Date().toISOString();

  // Update document status
  var rows = findRowsByField(SHEET_NAMES.RESEARCH_DOCUMENTS, 0, docId);
  if (rows.length > 0 && rows[0].user_id === userId) {
    var rowIndex = rows[0]._rowIndex;
    docSheet.getRange(rowIndex, 8).setValue(payload.document_type || 'Общий анализ крови');
    docSheet.getRange(rowIndex, 9).setValue(payload.laboratory_name || '');
    docSheet.getRange(rowIndex, 10).setValue(payload.research_date || '');
    docSheet.getRange(rowIndex, 11).setValue('completed');
    docSheet.getRange(rowIndex, 12).setValue(payload.overall_confidence || 0.95);
    docSheet.getRange(rowIndex, 14).setValue(payload.ai_summary || '');
    docSheet.getRange(rowIndex, 17).setValue(now);
  }

  // Save each confirmed lab result indicator
  var results = payload.results || [];
  results.forEach(function(item) {
    labSheet.appendRow([
      generateUuid(),
      docId,
      userId,
      payload.research_date || now.split('T')[0],
      item.category || 'Гематология',
      item.originalName || item.marker_original_name || '',
      item.normalizedName || item.marker_normalized_name || '',
      item.value !== undefined ? item.value : '',
      item.unit || '',
      item.referenceMin !== undefined ? item.referenceMin : '',
      item.referenceMax !== undefined ? item.referenceMax : '',
      item.referenceText || '',
      item.status || 'normal',
      item.sourcePage || 1,
      item.confidence || 0.95,
      true, // manual confirmation
      now
    ]);
  });

  return { saved: true, results_count: results.length };
}

function handleGetResearchDocuments(userId) {
  return findRowsByField(SHEET_NAMES.RESEARCH_DOCUMENTS, 1, userId);
}

function handleGetLabResults(userId) {
  return findRowsByField(SHEET_NAMES.LAB_RESULTS, 2, userId);
}

function handleUpdateLabResult(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.LAB_RESULTS);
  var rows = findRowsByField(SHEET_NAMES.LAB_RESULTS, 0, payload.result_id);
  if (rows.length > 0 && rows[0].user_id === userId) {
    var rowIndex = rows[0]._rowIndex;
    sheet.getRange(rowIndex, 8).setValue(payload.value);
    sheet.getRange(rowIndex, 9).setValue(payload.unit);
    sheet.getRange(rowIndex, 13).setValue(payload.status);
    sheet.getRange(rowIndex, 16).setValue(true); // manual confirmation
    return { updated: true };
  }
  return { updated: false };
}

function handleDeleteResearchDocument(userId, documentId) {
  var docSheet = getSs().getSheetByName(SHEET_NAMES.RESEARCH_DOCUMENTS);
  var labSheet = getSs().getSheetByName(SHEET_NAMES.LAB_RESULTS);

  // Delete lab results
  var labRows = findRowsByField(SHEET_NAMES.LAB_RESULTS, 1, documentId);
  for (var i = labRows.length - 1; i >= 0; i--) {
    if (labRows[i].user_id === userId) {
      labSheet.deleteRow(labRows[i]._rowIndex);
    }
  }

  // Delete document
  var docRows = findRowsByField(SHEET_NAMES.RESEARCH_DOCUMENTS, 0, documentId);
  if (docRows.length > 0 && docRows[0].user_id === userId) {
    // Optionally trash Google Drive file
    if (docRows[0].drive_file_id) {
      try {
        DriveApp.getFileById(docRows[0].drive_file_id).setTrashed(true);
      } catch (e) {
        // file might already be removed
      }
    }
    docSheet.deleteRow(docRows[0]._rowIndex);
    return { deleted: true };
  }
  return { deleted: false };
}

function handleSaveAIInsight(userId, payload) {
  var sheet = getSs().getSheetByName(SHEET_NAMES.AI_INSIGHTS);
  var insightId = generateUuid();
  var now = new Date().toISOString();

  sheet.appendRow([
    insightId,
    userId,
    payload.insight_type || 'health_summary',
    payload.period_start || '',
    payload.period_end || '',
    payload.title || '',
    payload.description || '',
    JSON.stringify(payload.supporting_factors || []),
    payload.confidence || 0.9,
    now
  ]);

  return { insight_id: insightId };
}

function handleGetDashboardData(userId) {
  var userProfile = handleGetUserProfile(userId);
  var diaryEntries = handleGetDiaryEntries(userId);
  var medications = handleGetMedications(userId);
  var documents = handleGetResearchDocuments(userId);
  var labResults = handleGetLabResults(userId);

  return {
    profile: userProfile,
    diaryCount: diaryEntries.length,
    medicationsCount: medications.length,
    documentsCount: documents.length,
    labResultsCount: labResults.length,
    recentDocuments: documents.slice(0, 5),
    recentDiary: diaryEntries.slice(0, 5)
  };
}
