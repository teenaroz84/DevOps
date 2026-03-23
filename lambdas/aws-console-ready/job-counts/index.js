/**
 * Lambda: devops-sqlserver (SQL Server — multi-query)
 * ───────────────────────────────────────────────────
 * This single Lambda handles MULTIPLE SQL Server queries.
 * API Gateway routes different paths to this one function.
 *
 * Routes handled:
 *   GET /api/esp/job-counts           → job counts by application
 *   GET /api/servicenow/incidents     → P1/P2/P3 incident counts
 *   (add more as needed)
 *
 * ── AWS Console Setup ─────────────────────────────────────
 * 1. Package:
 *      mkdir sqlserver-lambda && cd sqlserver-lambda
 *      npm init -y && npm install mssql
 *      cp <this file> index.js
 *      zip -r function.zip .
 *
 * 2. Upload function.zip → Lambda name: devops-sqlserver
 *
 * 3. API Gateway — point all SQL Server routes to this Lambda:
 *      /api/esp/job-counts          GET → devops-sqlserver
 *      /api/servicenow/incidents    GET → devops-sqlserver
 *
 * ── Environment Variables ─────────────────────────────────
 *   DB_SERVER, DB_PORT (1433), DB_NAME, DB_USER, DB_PASSWORD
 */

const sql = require('mssql');

// Connection config from environment variables
function getDbConfig() {
  return {
    server:   process.env.DB_SERVER,
    port:     parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: true,              // Required for Azure SQL / most AWS setups
      trustServerCertificate: true // Set false in production with proper certs
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

// ─────────────────────────────────────────────────────────
// ROUTE HANDLERS — one function per query
// To add a new query, add a function + register it in ROUTES.
// ─────────────────────────────────────────────────────────

async function getJobCounts(pool) {
  const result = await pool.request().query(`
    SELECT appl_name,
           COUNT(DISTINCT jobname) AS total_jobs
    FROM   dbo.esp_job_cmnd
    GROUP BY appl_name
    ORDER BY total_jobs DESC
  `);
  return result.recordset;
}

async function getServiceNowIncidents(pool) {
  const result = await pool.request().query(`
    SELECT sg.short_priority AS priority_field,
           COUNT(*)          AS incident_count
    FROM   [Adpops].[ebd].[service_now_inc] sn
    JOIN   [Adpops].[ebd].[sla_glossary]    sg
      ON   sn.sninc_priority = sg.snow_priority
    WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
      AND  sg.short_priority IN ('P1','P2','P3')
    GROUP BY sg.short_priority
    ORDER BY sg.short_priority
  `);
  return result.recordset;
}

// TODO: Add more query functions here, for example:
//
// async function getTicketsByTeam(pool) {
//   const result = await pool.request().query(`
//     SELECT team_name, COUNT(*) AS ticket_count
//     FROM   [Adpops].[ebd].[service_now_inc]
//     GROUP BY team_name
//     ORDER BY ticket_count DESC
//   `);
//   return result.recordset;
// }

// ─────────────────────────────────────────────────────────
// ROUTE MAP — maps path endings to handler functions
// ─────────────────────────────────────────────────────────
const ROUTES = {
  'job-counts':  getJobCounts,
  'incidents':   getServiceNowIncidents,
  // 'tickets-by-team': getTicketsByTeam,   ← add more like this
};

// ─────────────────────────────────────────────────────────
// MAIN HANDLER — routes request to the right query function
// ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  // Extract last path segment: /api/esp/job-counts → "job-counts"
  const path = event.path || event.rawPath || '';
  const segments = path.split('/').filter(Boolean);
  const routeKey = segments[segments.length - 1];

  const routeHandler = ROUTES[routeKey];
  if (!routeHandler) {
    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ error: `Unknown route: ${routeKey}` }),
    };
  }

  let pool;
  try {
    pool = await sql.connect(getDbConfig());
    const data = await routeHandler(pool);
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
    if (pool) await pool.close();
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
