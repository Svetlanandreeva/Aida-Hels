import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

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

export function isPostgresConfigured(): boolean {
  return Boolean(
    (process.env.YANDEX_POSTGRES_HOST || process.env.PGHOST || process.env.DATABASE_URL) &&
    (process.env.YANDEX_POSTGRES_DB || process.env.PGDATABASE || process.env.DATABASE_URL)
  );
}

let pool: pg.Pool | null = null;

export function getPostgresPool(): pg.Pool | null {
  if (!isPostgresConfigured()) {
    return null;
  }
  if (!pool) {
    const host = process.env.YANDEX_POSTGRES_HOST || process.env.PGHOST || 'localhost';
    const port = Number(process.env.YANDEX_POSTGRES_PORT || process.env.PGPORT || 6432);
    const database = process.env.YANDEX_POSTGRES_DB || process.env.PGDATABASE || 'postgres';
    const user = process.env.YANDEX_POSTGRES_USER || process.env.PGUSER || 'postgres';
    const password = process.env.YANDEX_POSTGRES_PASSWORD || process.env.PGPASSWORD || '';

    pool = new Pool({
      host,
      port,
      database,
      user,
      password,
      ssl: process.env.YANDEX_POSTGRES_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle Postgres client:', err);
    });
  }
  return pool;
}

export async function ensureSchema(): Promise<boolean> {
  const p = getPostgresPool();
  if (!p) {
    console.log('[Postgres DB] Database connection not configured, running in-memory fallback mode.');
    return false;
  }

  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(128) PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          full_name VARCHAR(255),
          password_hash VARCHAR(255) NOT NULL,
          is_verified BOOLEAN DEFAULT TRUE,
          verification_code_hash VARCHAR(255),
          verification_expires_at BIGINT,
          profile_json JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          doc_type VARCHAR(128),
          file_name VARCHAR(255),
          title VARCHAR(255),
          date VARCHAR(64),
          results JSONB DEFAULT '[]'::jsonb,
          deviations JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS appointments (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          doctor_name VARCHAR(255),
          specialty VARCHAR(255),
          date VARCHAR(64),
          time VARCHAR(64),
          clinic VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS daily_logs (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date VARCHAR(64) NOT NULL,
          energy INTEGER,
          sleep NUMERIC,
          stress INTEGER,
          mood VARCHAR(128),
          has_pain BOOLEAN DEFAULT FALSE,
          data_json JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS diary_entries (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date VARCHAR(64) NOT NULL,
          state_score INTEGER,
          moods JSONB DEFAULT '[]'::jsonb,
          event_description TEXT,
          thoughts TEXT,
          additional_note TEXT,
          full_json JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS pressure_logs (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date VARCHAR(64) NOT NULL,
          time VARCHAR(64),
          systolic INTEGER NOT NULL,
          diastolic INTEGER NOT NULL,
          pulse INTEGER,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reminders (
          id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          category VARCHAR(128),
          dosage VARCHAR(128),
          time VARCHAR(64),
          is_enabled BOOLEAN DEFAULT TRUE,
          last_completed_date VARCHAR(64),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS ai_analyses (
          user_id VARCHAR(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          analysis_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('[Postgres DB] Schema verified and initialized successfully.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[Postgres DB] Error initializing database schema:', err);
    return false;
  }
}

// User CRUD
export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const p = getPostgresPool();
  if (!p) return null;
  const res = await p.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    passwordHash: r.password_hash,
    isVerified: Boolean(r.is_verified),
    verificationCode: r.verification_code_hash,
    verificationExpiresAt: r.verification_expires_at ? Number(r.verification_expires_at) : null,
    createdAt: r.created_at,
    profile: r.profile_json || {},
  };
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const p = getPostgresPool();
  if (!p) return null;
  const res = await p.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    passwordHash: r.password_hash,
    isVerified: Boolean(r.is_verified),
    verificationCode: r.verification_code_hash,
    verificationExpiresAt: r.verification_expires_at ? Number(r.verification_expires_at) : null,
    createdAt: r.created_at,
    profile: r.profile_json || {},
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
  const p = getPostgresPool();
  if (!p) {
    throw new Error('Database not configured');
  }
  await p.query(
    `INSERT INTO users (id, email, full_name, password_hash, is_verified, verification_code_hash, verification_expires_at, profile_json)
     VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, '{}'::jsonb)
     ON CONFLICT (email) DO UPDATE SET
       full_name = EXCLUDED.full_name,
       password_hash = EXCLUDED.password_hash`,
    [
      user.id,
      user.email,
      user.fullName,
      user.passwordHash,
      user.isVerified ?? false,
      user.verificationCodeHash || null,
      user.verificationExpiresAt || null,
    ]
  );
  return (await getUserByEmail(user.email))!;
}

export async function updateUserProfile(userId: string, profile: any): Promise<void> {
  const p = getPostgresPool();
  if (!p) return;
  await p.query(
    `UPDATE users SET profile_json = $1::jsonb WHERE id = $2`,
    [JSON.stringify(profile || {}), userId]
  );
}

// User Health Data Aggregate Read / Write
export async function getUserData(userId: string): Promise<any> {
  const p = getPostgresPool();
  if (!p) return null;

  const userRes = await p.query('SELECT profile_json FROM users WHERE id = $1', [userId]);
  const profile = userRes.rows[0]?.profile_json || {};

  const docsRes = await p.query('SELECT * FROM documents WHERE user_id = $1 ORDER BY date DESC, created_at DESC', [userId]);
  const documents = docsRes.rows.map(r => ({
    id: r.id,
    docType: r.doc_type,
    fileName: r.file_name,
    title: r.title || r.file_name,
    date: r.date,
    results: r.results || [],
    deviations: r.deviations || [],
  }));

  const apptsRes = await p.query('SELECT * FROM appointments WHERE user_id = $1 ORDER BY date ASC', [userId]);
  const appointments = apptsRes.rows.map(r => ({
    id: r.id,
    doctorName: r.doctor_name,
    specialty: r.specialty,
    date: r.date,
    time: r.time,
    clinic: r.clinic,
    notes: r.notes,
  }));

  const dailyRes = await p.query('SELECT * FROM daily_logs WHERE user_id = $1 ORDER BY date DESC, created_at DESC', [userId]);
  const dailyLogs = dailyRes.rows.map(r => ({
    id: r.id,
    date: r.date,
    energy: r.energy,
    sleep: r.sleep,
    stress: r.stress,
    mood: r.mood,
    has_pain: r.has_pain,
    ...(r.data_json || {}),
  }));

  const diaryRes = await p.query('SELECT * FROM diary_entries WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  const diaryEntries = diaryRes.rows.map(r => ({
    id: r.id,
    date: r.date,
    state_score: r.state_score,
    moods: r.moods || [],
    event_description: r.event_description,
    thoughts: r.thoughts,
    additional_note: r.additional_note,
    ...(r.full_json || {}),
  }));

  const pressureRes = await p.query('SELECT * FROM pressure_logs WHERE user_id = $1 ORDER BY date DESC, time DESC', [userId]);
  const pressureLogs = pressureRes.rows.map(r => ({
    id: r.id,
    date: r.date,
    time: r.time,
    systolic: r.systolic,
    diastolic: r.diastolic,
    pulse: r.pulse,
    notes: r.notes,
  }));

  const remRes = await p.query('SELECT * FROM reminders WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
  const reminders = remRes.rows.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    dosage: r.dosage,
    time: r.time,
    isEnabled: Boolean(r.is_enabled),
    lastCompletedDate: r.last_completed_date,
  }));

  const aiRes = await p.query('SELECT analysis_json FROM ai_analyses WHERE user_id = $1', [userId]);
  const aiAnalysis = aiRes.rows[0]?.analysis_json || null;

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
  const p = getPostgresPool();
  if (!p) return;

  const client = await p.connect();
  try {
    await client.query('BEGIN');

    if (data.profile) {
      await client.query('UPDATE users SET profile_json = $1::jsonb WHERE id = $2', [
        JSON.stringify(data.profile),
        userId,
      ]);
    }

    if (Array.isArray(data.documents)) {
      await client.query('DELETE FROM documents WHERE user_id = $1', [userId]);
      for (const d of data.documents) {
        await client.query(
          `INSERT INTO documents (id, user_id, doc_type, file_name, title, date, results, deviations)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
          [
            d.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            d.docType || 'general',
            d.fileName || d.title || 'document.pdf',
            d.title || d.fileName || 'Документ',
            d.date || new Date().toISOString().slice(0, 10),
            JSON.stringify(d.results || []),
            JSON.stringify(d.deviations || []),
          ]
        );
      }
    }

    if (Array.isArray(data.appointments)) {
      await client.query('DELETE FROM appointments WHERE user_id = $1', [userId]);
      for (const a of data.appointments) {
        await client.query(
          `INSERT INTO appointments (id, user_id, doctor_name, specialty, date, time, clinic, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            a.id || `appt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            a.doctorName || 'Врач',
            a.specialty || 'Терапевт',
            a.date || new Date().toISOString().slice(0, 10),
            a.time || '10:00',
            a.clinic || '',
            a.notes || '',
          ]
        );
      }
    }

    if (Array.isArray(data.dailyLogs)) {
      await client.query('DELETE FROM daily_logs WHERE user_id = $1', [userId]);
      for (const l of data.dailyLogs) {
        await client.query(
          `INSERT INTO daily_logs (id, user_id, date, energy, sleep, stress, mood, has_pain, data_json)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
          [
            l.id || `daily-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            l.date || new Date().toISOString().slice(0, 10),
            l.energy ?? 7,
            l.sleep ?? 8,
            l.stress ?? 3,
            l.mood || 'нормальное',
            Boolean(l.has_pain),
            JSON.stringify(l),
          ]
        );
      }
    }

    if (Array.isArray(data.diaryEntries)) {
      await client.query('DELETE FROM diary_entries WHERE user_id = $1', [userId]);
      for (const e of data.diaryEntries) {
        await client.query(
          `INSERT INTO diary_entries (id, user_id, date, state_score, moods, event_description, thoughts, additional_note, full_json)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::jsonb)`,
          [
            e.id || `diary-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            e.date || e.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            e.state_score ?? 7,
            JSON.stringify(e.moods || []),
            e.event_description || '',
            e.thoughts || '',
            e.additional_note || '',
            JSON.stringify(e),
          ]
        );
      }
    }

    if (Array.isArray(data.pressureLogs)) {
      await client.query('DELETE FROM pressure_logs WHERE user_id = $1', [userId]);
      for (const pLog of data.pressureLogs) {
        await client.query(
          `INSERT INTO pressure_logs (id, user_id, date, time, systolic, diastolic, pulse, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            pLog.id || `press-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            pLog.date || new Date().toISOString().slice(0, 10),
            pLog.time || '12:00',
            pLog.systolic || 120,
            pLog.diastolic || 80,
            pLog.pulse || 72,
            pLog.notes || '',
          ]
        );
      }
    }

    if (Array.isArray(data.reminders)) {
      await client.query('DELETE FROM reminders WHERE user_id = $1', [userId]);
      for (const r of data.reminders) {
        await client.query(
          `INSERT INTO reminders (id, user_id, title, category, dosage, time, is_enabled, last_completed_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            r.id || `rem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            userId,
            r.title || 'Напоминание',
            r.category || 'general',
            r.dosage || '',
            r.time || '09:00',
            r.isEnabled ?? true,
            r.lastCompletedDate || null,
          ]
        );
      }
    }

    if (data.aiAnalysis) {
      await client.query(
        `INSERT INTO ai_analyses (user_id, analysis_json, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           analysis_json = EXCLUDED.analysis_json,
           updated_at = NOW()`,
        [userId, JSON.stringify(data.aiAnalysis)]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error saving user data to Postgres:', err);
    throw err;
  } finally {
    client.release();
  }
}
