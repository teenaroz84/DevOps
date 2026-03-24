/**
 * SQL Server connection pool.
 *
 * Uses the 'mssql' package. Connection details come from .env:
 *   MSSQL_SERVER, MSSQL_PORT, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD
 */
import sql from 'mssql';

const config: sql.config = {
  server:   process.env.MSSQL_SERVER || 'localhost',
  port:     parseInt(process.env.MSSQL_PORT || '1433', 10),
  database: process.env.MSSQL_DATABASE || '',
  user:     process.env.MSSQL_USER || '',
  password: process.env.MSSQL_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

let pool: sql.ConnectionPool | null = null;

export async function getMssqlPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(config);
    console.log('✓ Connected to SQL Server');
  }
  return pool;
}

export async function closeMssqlPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
