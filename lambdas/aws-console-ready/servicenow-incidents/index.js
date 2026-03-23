/**
 * Lambda: devops-servicenow (SQL Server — multi-query)
 * ────────────────────────────────────────────────────
 * This single Lambda handles MULTIPLE ServiceNow queries.
 * API Gateway routes different paths to this one function.
 *
 * Routes handled:
 *   GET /api/servicenow/incidents       → P1/P2/P3 incident counts
 *   GET /api/servicenow/tickets         → all tickets with details
 *   GET /api/servicenow/sla-breaches    → SLA breach summary
 *   (add more as needed)
 *
 * ── Package & Upload ──────────────────────────────────────
 *   mkdir -p /tmp/servicenow-lambda && cd /tmp/servicenow-lambda
 *   npm init -y && npm install mssql
 *   cp <this file> index.js
 *   zip -r function.zip .
 *   # Upload function.zip in the Lambda Console
 *
 * ── Environment Variables ─────────────────────────────────
 *   DB_SERVER   = your-sql-server-host
 *   DB_PORT     = 1433
 *   DB_NAME     = Adpops
 *   DB_USER     = your_username
 *   DB_PASSWORD = your_password
 *
 * ── API Gateway ───────────────────────────────────────────
 *   Point all /api/servicenow/* routes to this Lambda.
 */

const sql = require('mssql');

function getDbConfig() {
  return {
    server:   process.env.DB_SERVER,
    port:     parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME || 'Adpops',
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };
}

// ─────────────────────────────────────────────────────────
// ROUTE HANDLERS — one function per query
// To add a new query, add a function + register it in ROUTES.
// ─────────────────────────────────────────────────────────

async function getIncidents(pool) {
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

async function getTickets(pool) {
  // TODO: Replace with your actual tickets query
  const result = await pool.request().query(`
    SELECT TOP 50
           sn.sninc_number        AS ticket_id,
           sn.sninc_short_desc    AS title,
           sg.short_priority      AS priority,
           sn.sninc_state         AS status,
           sn.sninc_assigned_to   AS assignee,
           sn.sninc_assignment_grp AS team,
           sn.sninc_opened_at     AS created_at,
           sn.sninc_updated_on    AS updated_at
    FROM   [Adpops].[ebd].[service_now_inc] sn
    JOIN   [Adpops].[ebd].[sla_glossary]    sg
      ON   sn.sninc_priority = sg.snow_priority
    WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
    ORDER BY sn.sninc_opened_at DESC
  `);
  return result.recordset;
}

async function getSlaBreaches(pool) {
  // TODO: Replace with your actual SLA breach query
  const result = await pool.request().query(`
    SELECT sg.short_priority      AS priority,
           COUNT(*)               AS total_incidents,
           SUM(CASE WHEN sn.sninc_made_sla = 'false' THEN 1 ELSE 0 END) AS sla_breached,
           SUM(CASE WHEN sn.sninc_made_sla = 'true'  THEN 1 ELSE 0 END) AS sla_met
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
// async function getIncidentsByMonth(pool) {
//   const result = await pool.request().query(`
//     SELECT FORMAT(sn.sninc_opened_at, 'yyyy-MM') AS month,
//            COUNT(*) AS incident_count
//     FROM   [Adpops].[ebd].[service_now_inc] sn
//     WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
//     GROUP BY FORMAT(sn.sninc_opened_at, 'yyyy-MM')
//     ORDER BY month DESC
//   `);
//   return result.recordset;
// }

// ─────────────────────────────────────────────────────────
// ROUTE MAP — maps path endings to handler functions
// ─────────────────────────────────────────────────────────
const ROUTES = {
  'incidents':    getIncidents,
  'tickets':      getTickets,
  'sla-breaches': getSlaBreaches,
  // 'incidents-by-month': getIncidentsByMonth,  ← add more like this
};

// ─────────────────────────────────────────────────────────
// MAIN HANDLER — routes request to the right query function
// ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  // Extract last path segment: /api/servicenow/incidents → "incidents"
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
