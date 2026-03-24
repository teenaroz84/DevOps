/**
 * Snowflake connection helper.
 *
 * Uses the 'snowflake-sdk' package. Connection details come from .env:
 *   SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_PASSWORD,
 *   SNOWFLAKE_DATABASE, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_SCHEMA, SNOWFLAKE_ROLE
 */
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'WARN' });

function createConnection(): snowflake.Connection {
  return snowflake.createConnection({
    account:   process.env.SNOWFLAKE_ACCOUNT   || '',
    username:  process.env.SNOWFLAKE_USERNAME  || '',
    password:  process.env.SNOWFLAKE_PASSWORD  || '',
    database:  process.env.SNOWFLAKE_DATABASE  || '_DMF',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || '',
    schema:    process.env.SNOWFLAKE_SCHEMA    || 'CORE',
    role:      process.env.SNOWFLAKE_ROLE      || undefined,
  });
}

export async function connectSnowflake(): Promise<snowflake.Connection> {
  const conn = createConnection();
  return new Promise((resolve, reject) => {
    conn.connect((err, c) => {
      if (err) reject(err);
      else {
        console.log('✓ Connected to Snowflake');
        resolve(c);
      }
    });
  });
}

export async function querySnowflake(sqlText: string): Promise<any[]> {
  const conn = await connectSnowflake();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        conn.destroy(() => {});
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
}
