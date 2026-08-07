import * as ydbModule from 'ydb-sdk';
import dotenv from 'dotenv';

dotenv.config();

// Handle CJS / ESM interop for ydb-sdk module exports
const ydb: any = (ydbModule as any).default || ydbModule;
const Driver = ydb.Driver;
const getCredentialsFromEnv = ydb.getCredentialsFromEnv;
const TypedData = ydb.TypedData;

type YdbDriver = typeof Driver.prototype;

export interface UserRecord {
  id: string;
  email: string;
  fullName?: string;
  passwordHash: string;
  isVerified: boolean;
  verificationCode?: string | null;
  verificationExpiresAt?: number | null;
  createdAt: string;
  profile?: any;
}

export function isYdbConfigured(): boolean {
  return Boolean(process.env.YDB_ENDPOINT && process.env.YDB_DATABASE);
}

export function isPostgresConfigured(): boolean {
  return isYdbConfigured();
}

let driverInstance: YdbDriver | null = null;

export async function getYdbDriver(): Promise<YdbDriver | null> {
  if (!isYdbConfigured()) {
    return null;
  }
  if (!driverInstance) {
    try {
      const endpoint = process.env.YDB_ENDPOINT!;
      const database = process.env.YDB_DATABASE!;

      console.log(`[YDB] Initializing Yandex Database connection to ${endpoint} (${database})...`);
      driverInstance = new Driver({
        endpoint,
        database,
        authService: getCredentialsFromEnv(),
      });

      const timeoutMs = 3000;
      const ready = await Promise.race([
        driverInstance.ready(timeoutMs),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs + 500)),
      ]);
      if (!ready) {
        console.warn(`[YDB] Driver did not become ready within ${timeoutMs}ms. Database queries will retry or fallback.`);
      } else {
        console.log('[YDB] Driver connected and ready.');
      }
    } catch (err) {
      console.error('[YDB] Error creating driver:', err);
      driverInstance = null;
    }
  }
  return driverInstance;
}

// Safely execute a YQL statement
async function runYql(yql: string): Promise<any[]> {
  const driver = await getYdbDriver();
  if (!driver) return [];

  try {
    return await driver.tableClient.withSessionRetry(async (session) => {
      const { resultSets } = await session.executeQuery(yql);
      if (resultSets && resultSets.length > 0) {
        return TypedData.createNativeObjects(resultSets[0]) as any[];
      }
      return [];
    });
  } catch (err) {
    console.error('[YDB Query Error]:', err, '\nQuery:', yql);
    return [];
  }
}

// Ensure database schema exists
export async function ensureSchema(): Promise<boolean> {
  if (!isYdbConfigured()) {
    console.log('[YDB DB] Environment variables YDB_ENDPOINT / YDB_DATABASE not present. Running in-memory cache mode.');
    return false;
  }

  const tableDefs = [
    `CREATE TABLE users (
      id Utf8,
      email Utf8,
      full_name Utf8,
      password_hash Utf8,
      is_verified Bool,
      verification_code_hash Utf8,
      verification_expires_at Int64,
      profile_json JsonDocument,
      created_at Utf8,
      PRIMARY KEY (id)
    );`,

    `CREATE TABLE documents (
      user_id Utf8,
      id Utf8,
      doc_type Utf8,
      file_name Utf8,
      title Utf8,
      date Utf8,
      results JsonDocument,
      deviations JsonDocument,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE appointments (
      user_id Utf8,
      id Utf8,
      doctor_name Utf8,
      specialty Utf8,
      date Utf8,
      time Utf8,
      clinic Utf8,
      notes Utf8,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE daily_logs (
      user_id Utf8,
      id Utf8,
      date Utf8,
      energy Int32,
      sleep Double,
      stress Int32,
      mood Utf8,
      has_pain Bool,
      data_json JsonDocument,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE diary_entries (
      user_id Utf8,
      id Utf8,
      date Utf8,
      state_score Int32,
      moods JsonDocument,
      event_description Utf8,
      thoughts Utf8,
      additional_note Utf8,
      full_json JsonDocument,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE pressure_logs (
      user_id Utf8,
      id Utf8,
      date Utf8,
      time Utf8,
      systolic Int32,
      diastolic Int32,
      pulse Int32,
      notes Utf8,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE reminders (
      user_id Utf8,
      id Utf8,
      title Utf8,
      category Utf8,
      dosage Utf8,
      time Utf8,
      is_enabled Bool,
      last_completed_date Utf8,
      created_at Utf8,
      PRIMARY KEY (user_id, id)
    );`,

    `CREATE TABLE ai_analyses (
      user_id Utf8,
      analysis_json JsonDocument,
      updated_at Utf8,
      PRIMARY KEY (user_id)
    );`,
  ];

  const driver = await getYdbDriver();
  if (!driver) return false;

  for (const statement of tableDefs) {
    try {
      await driver.tableClient.withSessionRetry(async (session) => {
        await session.executeQuery(statement);
      });
    } catch (err: any) {
      // Ignore if table already exists error
      if (!err?.message?.includes('already exists') && !err?.message?.includes('Path exist')) {
        console.warn('[YDB Schema Init Notice]:', err?.message || err);
      }
    }
  }

  console.log('[YDB DB] Schema verified for helt-aida-db.');
  return true;
}

// Escapes string literals for safe YQL queries
function esc(val: string | undefined | null): string {
  if (val === undefined || val === null) return "''";
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escJson(val: any): string {
  const jsonStr = JSON.stringify(val ?? {});
  return `CAST(${esc(jsonStr)} AS JsonDocument)`;
}

// User CRUD
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  if (!isYdbConfigured()) return null;
  const normalized = email.trim().toLowerCase();
  const rows = await runYql(`SELECT * FROM users WHERE email = ${esc(normalized)};`);
  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  let parsedProfile = {};
  try {
    parsedProfile = typeof r.profileJson === 'string' ? JSON.parse(r.profileJson) : (r.profileJson || {});
  } catch {}

  return {
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    passwordHash: r.passwordHash,
    isVerified: Boolean(r.isVerified),
    verificationCode: r.verificationCodeHash,
    verificationExpiresAt: r.verificationExpiresAt ? Number(r.verificationExpiresAt) : null,
    createdAt: r.createdAt,
    profile: parsedProfile,
  };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  if (!isYdbConfigured()) return null;
  const rows = await runYql(`SELECT * FROM users WHERE id = ${esc(id)};`);
  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  let parsedProfile = {};
  try {
    parsedProfile = typeof r.profileJson === 'string' ? JSON.parse(r.profileJson) : (r.profileJson || {});
  } catch {}

  return {
    id: r.id,
    email: r.email,
    fullName: r.fullName,
    passwordHash: r.passwordHash,
    isVerified: Boolean(r.isVerified),
    verificationCode: r.verificationCodeHash,
    verificationExpiresAt: r.verificationExpiresAt ? Number(r.verificationExpiresAt) : null,
    createdAt: r.createdAt,
    profile: parsedProfile,
  };
}

export async function createUser(user: {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  isVerified?: boolean;
  verificationCodeHash?: string;
  verificationExpiresAt?: number;
}): Promise<UserRecord> {
  if (!isYdbConfigured()) {
    throw new Error('YDB not configured');
  }

  const createdAt = new Date().toISOString();
  const yql = `
    UPSERT INTO users (id, email, full_name, password_hash, is_verified, verification_code_hash, verification_expires_at, profile_json, created_at)
    VALUES (
      ${esc(user.id)},
      ${esc(user.email.toLowerCase())},
      ${esc(user.fullName)},
      ${esc(user.passwordHash)},
      ${user.isVerified ? 'true' : 'false'},
      ${esc(user.verificationCodeHash || '')},
      ${user.verificationExpiresAt || 0},
      ${escJson({})},
      ${esc(createdAt)}
    );
  `;
  await runYql(yql);
  return (await getUserByEmail(user.email))!;
}

export async function updateUserProfile(userId: string, profile: any): Promise<void> {
  if (!isYdbConfigured()) return;
  const yql = `
    UPDATE users SET profile_json = ${escJson(profile || {})} WHERE id = ${esc(userId)};
  `;
  await runYql(yql);
}

// User Health Data Aggregate Read / Write
export async function getUserData(userId: string): Promise<any> {
  if (!isYdbConfigured()) return null;

  const userRecord = await getUserById(userId);
  const profile = userRecord?.profile || {};

  const docsRows = await runYql(`SELECT * FROM documents WHERE user_id = ${esc(userId)};`);
  const documents = docsRows.map((r) => {
    let results = [];
    let deviations = [];
    try { results = typeof r.results === 'string' ? JSON.parse(r.results) : (r.results || []); } catch {}
    try { deviations = typeof r.deviations === 'string' ? JSON.parse(r.deviations) : (r.deviations || []); } catch {}
    return {
      id: r.id,
      docType: r.docType,
      fileName: r.fileName,
      title: r.title || r.fileName,
      date: r.date,
      results,
      deviations,
    };
  });

  const apptsRows = await runYql(`SELECT * FROM appointments WHERE user_id = ${esc(userId)};`);
  const appointments = apptsRows.map((r) => ({
    id: r.id,
    doctorName: r.doctorName,
    specialty: r.specialty,
    date: r.date,
    time: r.time,
    clinic: r.clinic,
    notes: r.notes,
  }));

  const dailyRows = await runYql(`SELECT * FROM daily_logs WHERE user_id = ${esc(userId)};`);
  const dailyLogs = dailyRows.map((r) => {
    let dataJson = {};
    try { dataJson = typeof r.dataJson === 'string' ? JSON.parse(r.dataJson) : (r.dataJson || {}); } catch {}
    return {
      id: r.id,
      date: r.date,
      energy: r.energy,
      sleep: r.sleep,
      stress: r.stress,
      mood: r.mood,
      has_pain: Boolean(r.hasPain),
      ...dataJson,
    };
  });

  const diaryRows = await runYql(`SELECT * FROM diary_entries WHERE user_id = ${esc(userId)};`);
  const diaryEntries = diaryRows.map((r) => {
    let moods = [];
    let fullJson = {};
    try { moods = typeof r.moods === 'string' ? JSON.parse(r.moods) : (r.moods || []); } catch {}
    try { fullJson = typeof r.fullJson === 'string' ? JSON.parse(r.fullJson) : (r.fullJson || {}); } catch {}
    return {
      id: r.id,
      date: r.date,
      state_score: r.stateScore,
      moods,
      event_description: r.eventDescription,
      thoughts: r.thoughts,
      additional_note: r.additionalNote,
      ...fullJson,
    };
  });

  const pressureRows = await runYql(`SELECT * FROM pressure_logs WHERE user_id = ${esc(userId)};`);
  const pressureLogs = pressureRows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    notes: r.notes,
  }));

  const remRows = await runYql(`SELECT * FROM reminders WHERE user_id = ${esc(userId)};`);
  const reminders = remRows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    dosage: r.dosage,
    time: r.time,
    isEnabled: Boolean(r.isEnabled),
    lastCompletedDate: r.lastCompletedDate,
  }));

  const aiRows = await runYql(`SELECT * FROM ai_analyses WHERE user_id = ${esc(userId)};`);
  let aiAnalysis = null;
  if (aiRows.length > 0) {
    try {
      aiAnalysis = typeof aiRows[0].analysisJson === 'string'
        ? JSON.parse(aiRows[0].analysisJson)
        : (aiRows[0].analysisJson || null);
    } catch {}
  }

  return {
    profile,
    documents,
    appointments,
    dailyLogs,
    diaryEntries,
    pressureLogs,
    reminders,
    aiAnalysis,
  };
}

export async function saveUserData(userId: string, data: any): Promise<void> {
  if (!isYdbConfigured()) return;

  if (data.profile) {
    await updateUserProfile(userId, data.profile);
  }

  const now = new Date().toISOString();

  if (Array.isArray(data.documents)) {
    await runYql(`DELETE FROM documents WHERE user_id = ${esc(userId)};`);
    for (const d of data.documents) {
      const docId = d.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO documents (user_id, id, doc_type, file_name, title, date, results, deviations, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(docId)},
          ${esc(d.docType || 'general')},
          ${esc(d.fileName || d.title || 'document.pdf')},
          ${esc(d.title || d.fileName || 'Документ')},
          ${esc(d.date || now.slice(0, 10))},
          ${escJson(d.results || [])},
          ${escJson(d.deviations || [])},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (Array.isArray(data.appointments)) {
    await runYql(`DELETE FROM appointments WHERE user_id = ${esc(userId)};`);
    for (const a of data.appointments) {
      const apptId = a.id || `appt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO appointments (user_id, id, doctor_name, specialty, date, time, clinic, notes, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(apptId)},
          ${esc(a.doctorName || 'Врач')},
          ${esc(a.specialty || 'Терапевт')},
          ${esc(a.date || now.slice(0, 10))},
          ${esc(a.time || '10:00')},
          ${esc(a.clinic || '')},
          ${esc(a.notes || '')},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (Array.isArray(data.dailyLogs)) {
    await runYql(`DELETE FROM daily_logs WHERE user_id = ${esc(userId)};`);
    for (const l of data.dailyLogs) {
      const logId = l.id || `daily-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO daily_logs (user_id, id, date, energy, sleep, stress, mood, has_pain, data_json, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(logId)},
          ${esc(l.date || now.slice(0, 10))},
          ${l.energy ?? 7},
          ${l.sleep ?? 8},
          ${l.stress ?? 3},
          ${esc(l.mood || 'нормальное')},
          ${Boolean(l.has_pain) ? 'true' : 'false'},
          ${escJson(l)},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (Array.isArray(data.diaryEntries)) {
    await runYql(`DELETE FROM diary_entries WHERE user_id = ${esc(userId)};`);
    for (const e of data.diaryEntries) {
      const entryId = e.id || `diary-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO diary_entries (user_id, id, date, state_score, moods, event_description, thoughts, additional_note, full_json, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(entryId)},
          ${esc(e.date || e.created_at?.slice(0, 10) || now.slice(0, 10))},
          ${e.state_score ?? 7},
          ${escJson(e.moods || [])},
          ${esc(e.event_description || '')},
          ${esc(e.thoughts || '')},
          ${esc(e.additional_note || '')},
          ${escJson(e)},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (Array.isArray(data.pressureLogs)) {
    await runYql(`DELETE FROM pressure_logs WHERE user_id = ${esc(userId)};`);
    for (const pLog of data.pressureLogs) {
      const pId = pLog.id || `press-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO pressure_logs (user_id, id, date, time, systolic, diastolic, pulse, notes, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(pId)},
          ${esc(pLog.date || now.slice(0, 10))},
          ${esc(pLog.time || '12:00')},
          ${pLog.systolic || 120},
          ${pLog.diastolic || 80},
          ${pLog.pulse || 72},
          ${esc(pLog.notes || '')},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (Array.isArray(data.reminders)) {
    await runYql(`DELETE FROM reminders WHERE user_id = ${esc(userId)};`);
    for (const r of data.reminders) {
      const remId = r.id || `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const yql = `
        UPSERT INTO reminders (user_id, id, title, category, dosage, time, is_enabled, last_completed_date, created_at)
        VALUES (
          ${esc(userId)},
          ${esc(remId)},
          ${esc(r.title || 'Напоминание')},
          ${esc(r.category || 'general')},
          ${esc(r.dosage || '')},
          ${esc(r.time || '09:00')},
          ${r.isEnabled ?? true ? 'true' : 'false'},
          ${esc(r.lastCompletedDate || '')},
          ${esc(now)}
        );
      `;
      await runYql(yql);
    }
  }

  if (data.aiAnalysis) {
    const yql = `
      UPSERT INTO ai_analyses (user_id, analysis_json, updated_at)
      VALUES (
        ${esc(userId)},
        ${escJson(data.aiAnalysis)},
        ${esc(now)}
      );
    `;
    await runYql(yql);
  }
}
