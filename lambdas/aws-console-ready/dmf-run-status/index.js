/**
 * Lambda: devops-dmf-run-status
 * ─────────────────────────────
 * Query: SELECT run_status, COUNT(*) AS status_count
 *        FROM _DMF.CORE.DMF_RUN_MASTER
 *        WHERE proc_dt >= DATEADD(month, -3, CURRENT_DATE)
 *        GROUP BY run_status
 *
 * Database: Snowflake
 *
 * ── AWS Console Setup ─────────────────────────────────────
 * 1. This code needs the 'snowflake-sdk' npm package.
 *    You must upload as a ZIP:
 *
 *      mkdir dmf-run-status-lambda && cd dmf-run-status-lambda
 *      npm init -y
 *      npm install snowflake-sdk
 *      # Copy this file as index.js into the folder
 *      zip -r function.zip .
 *
 * 2. Upload function.zip in the Lambda Console.
 *
 * ── Environment Variables (set in Lambda Configuration tab) ──
 *   SNOWFLAKE_ACCOUNT    = your_account.us-east-1  (account locator)
 *   SNOWFLAKE_USERNAME   = your_username
 *   SNOWFLAKE_PASSWORD   = your_password
 *   SNOWFLAKE_DATABASE   = _DMF
 *   SNOWFLAKE_WAREHOUSE  = your_warehouse
 *   SNOWFLAKE_SCHEMA     = CORE
 *   SNOWFLAKE_ROLE       = your_role  (optional)
 *
 * ── If Snowflake is private-link ──────────────────────────────
 *   Configure Lambda VPC settings to reach the Snowflake endpoint.
 */

const snowflake = require('snowflake-sdk');

// Prevent SDK from hanging on process.exit
snowflake.configure({ logLevel: 'WARN' });

function createConnection() {
  return snowflake.createConnection({
    account:   process.env.SNOWFLAKE_ACCOUNT,
    username:  process.env.SNOWFLAKE_USERNAME,
    password:  process.env.SNOWFLAKE_PASSWORD,
    database:  process.env.SNOWFLAKE_DATABASE   || '_DMF',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    schema:    process.env.SNOWFLAKE_SCHEMA      || 'CORE',
    role:      process.env.SNOWFLAKE_ROLE        || undefined,
  });
}

function connectAsync(connection) {
  return new Promise((resolve, reject) => {
    connection.connect((err, conn) => {
      if (err) reject(err);
      else resolve(conn);
    });
  });
}

function executeQuery(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    });
  });
}

function destroyConnection(connection) {
  return new Promise((resolve) => {
    connection.destroy((err) => {
      if (err) console.warn('Connection destroy warning:', err.message);
      resolve();
    });
  });
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  const conn = createConnection();

  try {
    await connectAsync(conn);

    const rows = await executeQuery(conn, `
      SELECT run_status,
             COUNT(*) AS status_count
      FROM   _DMF.CORE.DMF_RUN_MASTER
      WHERE  proc_dt >= DATEADD(month, -3, CURRENT_DATE)
      GROUP BY run_status
      ORDER BY status_count DESC
    `);

    // Transform to match front-end's expected format:
    // [{ name: 'Success', value: 1177, color: '#2e7d32' }, ...]
    const colorMap = {
      'SUCCESS':     '#2e7d32',
      'FAILED':      '#d32f2f',
      'IN PROGRESS': '#f57c00',
      'STARTED':     '#1565c0',
      'PARTIAL LOAD':'#ff9800',
    };

    const data = rows.map((row) => ({
      name:  row.RUN_STATUS || row.run_status,
      value: parseInt(row.STATUS_COUNT || row.status_count, 10),
      color: colorMap[(row.RUN_STATUS || row.run_status || '').toUpperCase()] || '#757575',
    }));

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Snowflake query error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Snowflake query failed', details: err.message }),
    };
  } finally {
    await destroyConnection(conn);
  }
};

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
