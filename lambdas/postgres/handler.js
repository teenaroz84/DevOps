/**
 * Postgres Lambda — handles /api/postgres/pipelines and /api/postgres/pipelines/:id
 *
 * Replace the TODO sections with real PostgreSQL queries.
 * Install: npm install pg
 *
 * Environment variables:
 *   PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 */
const { success, notFound, serverError, corsPreFlight } = require('../shared/response');

// ── Uncomment when connecting to real PostgreSQL ─────────────
// const { Client } = require('pg');
//
// async function query(sql, params = []) {
//   const client = new Client({
//     host:     process.env.PG_HOST,
//     port:     parseInt(process.env.PG_PORT || '5432', 10),
//     database: process.env.PG_DATABASE,
//     user:     process.env.PG_USER,
//     password: process.env.PG_PASSWORD,
//     ssl:      { rejectUnauthorized: false },
//   });
//   await client.connect();
//   const result = await client.query(sql, params);
//   await client.end();
//   return result.rows;
// }

// Mock data — matches server/src/mockData.ts
const mockPipelines = [
  {
    id: 'pl-001', name: 'Finance D+1 ETL', status: 'at_risk', successRate: 72,
    lastRun: '2026-03-17T06:30:00Z', avgDuration: '42 min', owner: 'Data Engineering', schedule: 'Daily 6AM',
    runs: [
      { runId: 'run-0091', status: 'failed', start: '2026-03-17T06:30:00Z', duration: '38 min', records: 0, error: 'Upstream Talend retry storm — source feed timeout after 30s' },
      { runId: 'run-0090', status: 'success', start: '2026-03-16T06:31:00Z', duration: '41 min', records: 1240000 },
      { runId: 'run-0089', status: 'success', start: '2026-03-15T06:29:00Z', duration: '39 min', records: 1198000 },
      { runId: 'run-0088', status: 'failed', start: '2026-03-14T06:30:00Z', duration: '12 min', records: 0, error: 'Schema validation error: unexpected null in column amount_usd' },
      { runId: 'run-0087', status: 'success', start: '2026-03-13T06:28:00Z', duration: '44 min', records: 1321000 },
    ],
  },
  {
    id: 'pl-002', name: 'Customer 360 Sync', status: 'healthy', successRate: 99,
    lastRun: '2026-03-17T07:00:00Z', avgDuration: '18 min', owner: 'CRM Team', schedule: 'Every 1hr',
    runs: [
      { runId: 'run-2201', status: 'success', start: '2026-03-17T07:00:00Z', duration: '17 min', records: 89000 },
      { runId: 'run-2200', status: 'success', start: '2026-03-17T06:00:00Z', duration: '19 min', records: 91000 },
      { runId: 'run-2199', status: 'success', start: '2026-03-17T05:00:00Z', duration: '18 min', records: 88500 },
    ],
  },
  {
    id: 'pl-003', name: 'Inventory Refresh', status: 'critical', successRate: 45,
    lastRun: '2026-03-17T03:00:00Z', avgDuration: '67 min', owner: 'Supply Chain', schedule: 'Every 6hrs',
    runs: [
      { runId: 'run-0441', status: 'failed', start: '2026-03-17T03:00:00Z', duration: '2 min', records: 0, error: 'Connection refused: PostgreSQL host inventory-db-03 unreachable' },
      { runId: 'run-0440', status: 'failed', start: '2026-03-16T21:00:00Z', duration: '2 min', records: 0, error: 'Connection refused: PostgreSQL host inventory-db-03 unreachable' },
      { runId: 'run-0439', status: 'success', start: '2026-03-16T15:00:00Z', duration: '71 min', records: 540000 },
    ],
  },
  {
    id: 'pl-004', name: 'Sales Feed Aggregation', status: 'healthy', successRate: 97,
    lastRun: '2026-03-17T08:00:00Z', avgDuration: '12 min', owner: 'Sales Analytics', schedule: 'Every 2hrs',
    runs: [
      { runId: 'run-1121', status: 'success', start: '2026-03-17T08:00:00Z', duration: '11 min', records: 34000 },
      { runId: 'run-1120', status: 'success', start: '2026-03-17T06:00:00Z', duration: '13 min', records: 38000 },
    ],
  },
  {
    id: 'pl-005', name: 'HR Data Warehouse Load', status: 'at_risk', successRate: 81,
    lastRun: '2026-03-17T05:00:00Z', avgDuration: '28 min', owner: 'HR Analytics', schedule: 'Daily 5AM',
    runs: [
      { runId: 'run-0771', status: 'success', start: '2026-03-17T05:00:00Z', duration: '35 min', records: 18000 },
      { runId: 'run-0770', status: 'failed', start: '2026-03-16T05:01:00Z', duration: '4 min', records: 0, error: 'Memory limit exceeded: required 6.2GB, allocated 4GB' },
    ],
  },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const path = event.path || event.rawPath || '';
  const pathParams = event.pathParameters || {};

  try {
    // GET /api/postgres/pipelines/:id
    if (pathParams.id) {
      // TODO: Replace with real query:
      // const rows = await query('SELECT * FROM pipelines WHERE id = $1', [pathParams.id]);
      // if (rows.length === 0) return notFound('Pipeline not found');
      // return success(rows[0]);

      const pipeline = mockPipelines.find((p) => p.id === pathParams.id);
      if (!pipeline) return notFound('Pipeline not found');
      return success(pipeline);
    }

    // GET /api/postgres/pipelines
    if (path.endsWith('/pipelines')) {
      // TODO: Replace with real query:
      // const rows = await query('SELECT * FROM pipelines ORDER BY last_run DESC');
      // return success(rows);

      return success(mockPipelines);
    }

    return notFound('Unknown postgres endpoint');
  } catch (err) {
    console.error('Postgres Lambda error:', err);
    return serverError(err.message);
  }
};
