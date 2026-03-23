/**
 * Snowflake Lambda — handles /api/snowflake/kpis and /api/snowflake/cost
 *
 * Replace the TODO sections with real Snowflake SDK queries.
 * Install: npm install snowflake-sdk
 *
 * Environment variables (set in Lambda console or SAM template):
 *   SNOWFLAKE_ACCOUNT, SNOWFLAKE_USERNAME, SNOWFLAKE_PASSWORD,
 *   SNOWFLAKE_DATABASE, SNOWFLAKE_WAREHOUSE, SNOWFLAKE_SCHEMA
 */
const { success, notFound, serverError, corsPreFlight } = require('../shared/response');

// ── Uncomment when connecting to real Snowflake ──────────────
// const snowflake = require('snowflake-sdk');
//
// function getConnection() {
//   return snowflake.createConnection({
//     account:   process.env.SNOWFLAKE_ACCOUNT,
//     username:  process.env.SNOWFLAKE_USERNAME,
//     password:  process.env.SNOWFLAKE_PASSWORD,
//     database:  process.env.SNOWFLAKE_DATABASE,
//     warehouse: process.env.SNOWFLAKE_WAREHOUSE,
//     schema:    process.env.SNOWFLAKE_SCHEMA,
//   });
// }
//
// async function query(sql) {
//   const conn = getConnection();
//   return new Promise((resolve, reject) => {
//     conn.connect((err) => {
//       if (err) return reject(err);
//       conn.execute({
//         sqlText: sql,
//         complete: (err, _stmt, rows) => {
//           conn.destroy();
//           if (err) return reject(err);
//           resolve(rows);
//         },
//       });
//     });
//   });
// }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const path = event.path || event.rawPath || '';

  try {
    if (path.endsWith('/kpis')) {
      // TODO: Replace with real query, e.g.:
      // const rows = await query(`
      //   SELECT
      //     success_rate, sla_breaches, mttr_hours,
      //     auto_resolved_pct, cost_vs_budget_pct
      //   FROM ops_dashboard.kpi_summary
      //   WHERE report_date = CURRENT_DATE()
      // `);
      // return success(transformKpiRows(rows));

      return success({
        successRate:  { value: 98.2, unit: '%', trend: '+1.2%', sparkline: [94, 95, 97, 96, 98, 97, 98.2] },
        slaBreaches:  { value: 5, unit: '', trend: '-2 vs last week', sparkline: [9, 8, 7, 6, 7, 6, 5] },
        mttr:         { value: 1.4, unit: 'hrs', trend: '-0.3hrs', sparkline: [2.1, 1.9, 1.8, 1.6, 1.5, 1.4, 1.4] },
        autoResolved: { value: 75, unit: '%', trend: '+5%', sparkline: [60, 63, 67, 70, 72, 74, 75] },
        costVsBudget: { value: 110, unit: '%', trend: '+10%', sparkline: [95, 98, 100, 103, 107, 109, 110] },
      });
    }

    if (path.endsWith('/cost')) {
      // TODO: Replace with real query, e.g.:
      // const rows = await query(`
      //   SELECT service_name, actual_cost, budgeted_cost, month
      //   FROM ops_dashboard.cost_breakdown
      //   ORDER BY month DESC
      // `);
      // return success(transformCostRows(rows));

      return success({
        total: 284000,
        budget: 258000,
        overage: 26000,
        byService: [
          { service: 'Snowflake Compute', cost: 92000, budget: 80000, change: '+15%' },
          { service: 'PostgreSQL RDS',    cost: 48000, budget: 50000, change: '-4%' },
          { service: 'CloudWatch Logs',   cost: 31000, budget: 28000, change: '+11%' },
          { service: 'Data Transfer',     cost: 29000, budget: 30000, change: '-3%' },
          { service: 'S3 Storage',        cost: 22000, budget: 20000, change: '+10%' },
          { service: 'Lambda Compute',    cost: 18000, budget: 25000, change: '-28%' },
          { service: 'Other',             cost: 44000, budget: 25000, change: '+76%' },
        ],
        history: [
          { month: 'Sep', actual: 241000, budget: 258000 },
          { month: 'Oct', actual: 255000, budget: 258000 },
          { month: 'Nov', actual: 261000, budget: 258000 },
          { month: 'Dec', actual: 248000, budget: 258000 },
          { month: 'Jan', actual: 271000, budget: 258000 },
          { month: 'Feb', actual: 278000, budget: 258000 },
          { month: 'Mar', actual: 284000, budget: 258000 },
        ],
      });
    }

    return notFound('Unknown snowflake endpoint');
  } catch (err) {
    console.error('Snowflake Lambda error:', err);
    return serverError(err.message);
  }
};
