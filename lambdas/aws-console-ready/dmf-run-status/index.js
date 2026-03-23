/**
 * Lambda: devops-dmf (Snowflake — multi-query)
 * ─────────────────────────────────────────────
 * This single Lambda handles MULTIPLE Snowflake queries.
 * API Gateway routes different paths to this one function.
 *
 * Routes handled:
 *   GET /api/dmf/run-status     → run status counts (last 3 months)
 *   GET /api/dmf/summary        → total runs, failures, success rate
 *   GET /api/dmf/stages         → success/failure by stage
 *   (add more as needed)
 *
 * ── AWS Console Setup ─────────────────────────────────────
 * 1. Package:
 *      mkdir dmf-lambda && cd dmf-lambda
 *      npm init -y && npm install snowflake-sdk
 *      cp <this file> index.js
 *      zip -r function.zip .
 *
 * 2. Upload function.zip → Lambda name: devops-dmf
 *
 * 3. API Gateway — point ALL /api/dmf/* routes to this ONE Lambda:
 *      /api/dmf/{proxy+}  GET → devops-dmf
 *    Or create each path individually and point them all here.
 *
 * ── Environment Variables ─────────────────────────────────
 *   SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_PASSWORD,
 *   SNOWFLAKE_DATABASE (_DMF), SNOWFLAKE_WAREHOUSE,
 *   SNOWFLAKE_SCHEMA (CORE), SNOWFLAKE_ROLE (optional)
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

// ─────────────────────────────────────────────────────────
// ROUTE HANDLERS — one function per query
// To add a new query, just add a new async function here
// and register it in the ROUTES map below.
// ─────────────────────────────────────────────────────────

async function getRunStatus(conn) {
  const rows = await executeQuery(conn, `
    SELECT run_status,
           COUNT(*) AS status_count
    FROM   _DMF.CORE.DMF_RUN_MASTER
    WHERE  proc_dt >= DATEADD(month, -3, CURRENT_DATE)
    GROUP BY run_status
    ORDER BY status_count DESC
  `);

  const colorMap = {
    'SUCCESS':      '#2e7d32',
    'FAILED':       '#d32f2f',
    'IN PROGRESS':  '#f57c00',
    'STARTED':      '#1565c0',
    'PARTIAL LOAD': '#ff9800',
  };

  return rows.map((row) => ({
    name:  row.RUN_STATUS || row.run_status,
    value: parseInt(row.STATUS_COUNT || row.status_count, 10),
    color: colorMap[(row.RUN_STATUS || row.run_status || '').toUpperCase()] || '#757575',
  }));
}

async function getSummary(conn) {
  // TODO: Replace with your actual summary query
  const rows = await executeQuery(conn, `
    SELECT
      COUNT(*)                                                    AS total_runs,
      SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END)    AS failed_runs,
      SUM(CASE WHEN run_status IN ('STARTED','IN PROGRESS') THEN 1 ELSE 0 END) AS in_progress,
      ROUND(SUM(CASE WHEN run_status = 'SUCCESS' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 1) AS success_rate
    FROM _DMF.CORE.DMF_RUN_MASTER
    WHERE proc_dt >= DATEADD(day, -7, CURRENT_DATE)
  `);

  const r = rows[0] || {};
  return {
    totalRuns:      { value: parseInt(r.TOTAL_RUNS || 0, 10),   trend: '',  label: 'Last 7 Days' },
    failedRuns:     { value: parseInt(r.FAILED_RUNS || 0, 10),  trend: '',  label: '' },
    runsInProgress: { value: parseInt(r.IN_PROGRESS || 0, 10),  trend: '',  label: '' },
    successRate:    { value: parseFloat(r.SUCCESS_RATE || 0),    trend: '',  label: '' },
  };
}

async function getStages(conn) {
  // TODO: Replace with your actual stages query
  const rows = await executeQuery(conn, `
    SELECT stage_name,
           SUM(CASE WHEN run_status = 'SUCCESS'    THEN 1 ELSE 0 END) AS success,
           SUM(CASE WHEN run_status IN ('STARTED','IN PROGRESS') THEN 1 ELSE 0 END) AS in_progress,
           SUM(CASE WHEN run_status = 'FAILED'     THEN 1 ELSE 0 END) AS failed
    FROM   _DMF.CORE.DMF_RUN_MASTER
    WHERE  proc_dt >= DATEADD(month, -3, CURRENT_DATE)
    GROUP BY stage_name
    ORDER BY stage_name
  `);

  return rows.map((row) => ({
    stage:      row.STAGE_NAME || row.stage_name,
    success:    parseInt(row.SUCCESS || 0, 10),
    inProgress: parseInt(row.IN_PROGRESS || 0, 10),
    failed:     parseInt(row.FAILED || 0, 10),
    rate:       Math.round((parseInt(row.SUCCESS || 0, 10) /
                  Math.max(parseInt(row.SUCCESS || 0, 10) + parseInt(row.FAILED || 0, 10), 1)) * 100),
  }));
}

// ─────────────────────────────────────────────────────────
// ROUTE MAP — maps API path endings to handler functions
// Add new entries here when you add new queries above.
// ─────────────────────────────────────────────────────────
const ROUTES = {
  'run-status': getRunStatus,
  'summary':    getSummary,
  'stages':     getStages,
  // 'runs-over-time': getRunsOverTime,   ← add more like this
  // 'error-reasons':  getErrorReasons,
};

// ─────────────────────────────────────────────────────────
// MAIN HANDLER — routes request to the right query function
// ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  // Extract the last path segment: /api/dmf/run-status → "run-status"
  const path = event.path || event.rawPath || '';
  const segments = path.split('/').filter(Boolean);
  const routeKey = segments[segments.length - 1]; // e.g. "run-status", "summary"

  const routeHandler = ROUTES[routeKey];
  if (!routeHandler) {
    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Unknown route: ${routeKey}` }),
    };
  }

  const conn = createConnection();
  try {
    await connectAsync(conn);
    const data = await routeHandler(conn);
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error(`Query error [${routeKey}]:`, err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Query failed', details: err.message }),
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
