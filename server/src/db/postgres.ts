/**
 * PostgreSQL connection pool.
 *
 * Uses the 'pg' package. Connection details come from .env:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 */
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!pool) {
    pool = new Pool({ 
      host:     process.env.PG_HOST     || 'localhost',
      port:     parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || '',
      user:     process.env.PG_USER     || '',
      password: process.env.PG_PASSWORD || '',
      max:      10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    pool.on('connect', () => console.log('✓ Connected to PostgreSQL'));
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
