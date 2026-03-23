/**
 * Lambda: devops-job-counts
 * ─────────────────────────
 * Query: SELECT appl_name, COUNT(DISTINCT jobname) AS total_jobs
 *        FROM dbo.esp_job_cmnd GROUP BY appl_name
 *
 * Database: SQL Server (accessed via the 'mssql' npm package)
 *
 * ── AWS Console Setup ─────────────────────────────────────
 * 1. This code needs the 'mssql' npm package which is NOT in the
 *    default Lambda runtime. You must upload as a ZIP (see below).
 *
 * 2. Create a folder on your machine:
 *      mkdir job-counts-lambda && cd job-counts-lambda
 *      npm init -y
 *      npm install mssql
 *      # Copy this file as index.mjs into the folder
 *      zip -r function.zip .
 *
 * 3. Upload function.zip in the Lambda Console.
 *
 * ── Environment Variables (set in Lambda Configuration tab) ──
 *   DB_SERVER   = your-sql-server-host.amazonaws.com
 *   DB_PORT     = 1433
 *   DB_NAME     = your_database_name
 *   DB_USER     = your_username
 *   DB_PASSWORD  = your_password    (or use Secrets Manager — see below)
 *
 * ── If your SQL Server is in a VPC ───────────────────────────
 *   Configure the Lambda's VPC settings (subnets + security group)
 *   to match the SQL Server's VPC so Lambda can reach it.
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

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  let pool;
  try {
    pool = await sql.connect(getDbConfig());

    const result = await pool.request().query(`
      SELECT appl_name,
             COUNT(DISTINCT jobname) AS total_jobs
      FROM   dbo.esp_job_cmnd
      GROUP BY appl_name
      ORDER BY total_jobs DESC
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
