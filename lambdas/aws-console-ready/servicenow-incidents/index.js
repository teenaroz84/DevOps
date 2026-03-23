/**
 * Lambda: devops-servicenow-incidents
 * ────────────────────────────────────
 * Query: SELECT sg.short_priority AS priority_field, COUNT(*) AS incident_count
 *        FROM [Adpops].[ebd].[service_now_inc] sn
 *        JOIN [Adpops].[ebd].[sla_glossary] sg ON sn.sninc_priority = sg.snow_priority
 *        WHERE sn.sninc_applkp_pltf_nm LIKE 'BI%'
 *          AND sg.short_priority IN ('P1','P2','P3')
 *        GROUP BY sg.short_priority
 *        ORDER BY sg.short_priority
 *
 * Database: SQL Server (Adpops)
 *
 * ── Package & Upload ──────────────────────────────────────
 *   mkdir -p /tmp/sn-incidents-lambda && cd /tmp/sn-incidents-lambda
 *   npm init -y
 *   npm install mssql
 *   cp <this file> index.js
 *   zip -r function.zip .
 *   # Upload function.zip in the Lambda Console
 *
 * ── Environment Variables (Lambda → Configuration → Environment variables) ──
 *   DB_SERVER   = your-sql-server-host
 *   DB_PORT     = 1433
 *   DB_NAME     = Adpops
 *   DB_USER     = your_username
 *   DB_PASSWORD = your_password
 *
 * ── API Gateway Route ─────────────────────────────────────
 *   GET /api/servicenow/incidents → this Lambda
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }

  let pool;
  try {
    pool = await sql.connect(getDbConfig());

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

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(result.recordset),
    };
  } catch (err) {
    console.error('DB query error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Database query failed', details: err.message }),
    };
  } finally {
    if (pool) {
      await pool.close();
    }
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
