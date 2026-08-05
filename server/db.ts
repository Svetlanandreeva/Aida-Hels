/**
 * Yandex Database (YDB) Authentication & Storage Service
 * Fully aligned with production fixes (Commits: a58fd0d, 55a2cd6, 2ad0131, d52a8b7)
 */

export interface UserRecord {
  id: string;
  email: string;
  fullName?: string;
  passwordHash: string;
  emailVerified: boolean;
  verificationCode?: string | null;
  verificationExpiresAt?: number | null;
  createdAt: string;
}

/**
 * Checks if YDB environment variables are provided.
 */
export function isYdbConfigured(): boolean {
  return Boolean(process.env.YDB_ENDPOINT && process.env.YDB_DATABASE);
}

/**
 * FIX #1: Returns YDB Driver construction options.
 * YDB SDK requires endpoint and database as SEPARATE fields.
 * Passing as 'grpcs://host/?database=/path' fails because ydb-sdk parses pathname '/' first.
 */
export function getYdbDriverConfig() {
  const endpoint = process.env.YDB_ENDPOINT || '';
  const database = process.env.YDB_DATABASE || '';

  return {
    endpoint,
    database,
  };
}

/**
 * FIX #2: Converts YDB result row to UserRecord.
 * ydb-sdk returns row fields in camelCase (e.g., row.emailVerified, row.passwordHash),
 * NOT snake_case as in SQL schema definitions.
 */
export function rowToUser(row: any): UserRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    fullName: row.fullName,
    emailVerified: Boolean(row.emailVerified),
    verificationCode: row.verificationCode ?? null,
    verificationExpiresAt: row.verificationExpiresAt != null ? Number(row.verificationExpiresAt) : null,
    createdAt: row.createdAt,
  };
}

/**
 * Transaction Execution Policy Guidelines:
 * 
 * FIX #3: Use driver.queryClient.doTx(...) for all DML operations (getUserByEmail, createUser, markEmailVerified, setVerificationCode).
 * doTx opens a serializableReadWrite transaction so read queries immediately see uncommitted writes.
 * 
 * FIX #4: Use driver.queryClient.do(...) (WITHOUT doTx) for DDL operations (ensureSchema / CREATE TABLE).
 * YDB throws "Scheme operations cannot be executed inside transaction" if CREATE TABLE is called inside a transaction.
 */
export const YDB_TRANSACTION_POLICY = {
  schemaOperationTx: false, // Must use .do() for DDL CREATE TABLE
  dataOperationTx: true,   // Must use .doTx() for DML SELECT/INSERT/UPDATE
};
