import { Driver, IamAuthService, TypedValues, AnonymousAuthService } from 'ydb-sdk';
import type { IAuthService } from 'ydb-sdk';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  emailVerified: boolean;
  verificationCode: string | null;
  verificationExpiresAt: number | null;
  createdAt: string;
}

let driverPromise: Promise<Driver> | null = null;

function buildAuthService(): IAuthService {
  const rawKey = process.env.YDB_SA_JSON_CREDENTIALS;
  if (!rawKey) {
    // Local/dev fallback - won't authenticate against a real cluster, but lets the
    // server boot without crashing when the DB isn't configured yet.
    return new AnonymousAuthService();
  }
  const payload = JSON.parse(rawKey);
  return new IamAuthService({
    iamEndpoint: process.env.IAM_ENDPOINT || 'iam.api.cloud.yandex.net:443',
    serviceAccountId: payload.service_account_id,
    accessKeyId: payload.id,
    privateKey: payload.private_key,
  });
}

async function getDriver(): Promise<Driver> {
  if (!driverPromise) {
    driverPromise = (async () => {
      const endpoint = process.env.YDB_ENDPOINT;
      const database = process.env.YDB_DATABASE;
      if (!endpoint || !database) {
        throw new Error('YDB_ENDPOINT / YDB_DATABASE are not configured');
      }
      const driver = new Driver({
        endpoint,
        database,
        authService: buildAuthService(),
      });
      const ready = await driver.ready(10_000);
      if (!ready) {
        throw new Error('YDB driver failed to become ready in time');
      }
      await ensureSchema(driver);
      return driver;
    })();
  }
  return driverPromise;
}

async function ensureSchema(driver: Driver) {
  await driver.queryClient.do({
    fn: async (session) => {
      await session.execute({
        text: `
          CREATE TABLE IF NOT EXISTS users (
            id Utf8,
            email Utf8,
            password_hash Utf8,
            full_name Utf8,
            email_verified Bool,
            verification_code Utf8,
            verification_expires_at Int64,
            created_at Utf8,
            PRIMARY KEY (id),
            INDEX idx_email GLOBAL ON (email)
          );
        `,
      });
    },
  });
}

function rowToUser(row: any): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    emailVerified: Boolean(row.email_verified),
    verificationCode: row.verification_code ?? null,
    verificationExpiresAt: row.verification_expires_at != null ? Number(row.verification_expires_at) : null,
    createdAt: row.created_at,
  };
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const driver = await getDriver();
  return driver.queryClient.doTx({
    fn: async (session) => {
      const result = await session.execute({
        text: `
          DECLARE $email AS Utf8;
          SELECT * FROM users WHERE email = $email;
        `,
        parameters: { $email: TypedValues.utf8(email) },
      });
      for await (const resultSet of result.resultSets) {
        for await (const row of resultSet.rows) {
          return rowToUser(row);
        }
      }
      return null;
    },
  });
}

export async function createUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  verificationCode: string;
  verificationExpiresAt: number;
}): Promise<void> {
  const driver = await getDriver();
  await driver.queryClient.doTx({
    fn: async (session) => {
      await session.execute({
        text: `
          DECLARE $id AS Utf8;
          DECLARE $email AS Utf8;
          DECLARE $password_hash AS Utf8;
          DECLARE $full_name AS Utf8;
          DECLARE $verification_code AS Utf8;
          DECLARE $verification_expires_at AS Int64;
          DECLARE $created_at AS Utf8;
          UPSERT INTO users (id, email, password_hash, full_name, email_verified, verification_code, verification_expires_at, created_at)
          VALUES ($id, $email, $password_hash, $full_name, false, $verification_code, $verification_expires_at, $created_at);
        `,
        parameters: {
          $id: TypedValues.utf8(user.id),
          $email: TypedValues.utf8(user.email),
          $password_hash: TypedValues.utf8(user.passwordHash),
          $full_name: TypedValues.utf8(user.fullName),
          $verification_code: TypedValues.utf8(user.verificationCode),
          $verification_expires_at: TypedValues.int64(user.verificationExpiresAt),
          $created_at: TypedValues.utf8(new Date().toISOString()),
        },
      });
    },
  });
}

export async function markEmailVerified(email: string): Promise<void> {
  const driver = await getDriver();
  await driver.queryClient.doTx({
    fn: async (session) => {
      await session.execute({
        text: `
          DECLARE $email AS Utf8;
          UPDATE users SET email_verified = true, verification_code = NULL, verification_expires_at = NULL
          WHERE email = $email;
        `,
        parameters: { $email: TypedValues.utf8(email) },
      });
    },
  });
}

export async function setVerificationCode(email: string, code: string, expiresAt: number): Promise<void> {
  const driver = await getDriver();
  await driver.queryClient.doTx({
    fn: async (session) => {
      await session.execute({
        text: `
          DECLARE $email AS Utf8;
          DECLARE $code AS Utf8;
          DECLARE $expires_at AS Int64;
          UPDATE users SET verification_code = $code, verification_expires_at = $expires_at
          WHERE email = $email;
        `,
        parameters: {
          $email: TypedValues.utf8(email),
          $code: TypedValues.utf8(code),
          $expires_at: TypedValues.int64(expiresAt),
        },
      });
    },
  });
}
