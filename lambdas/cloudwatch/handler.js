/**
 * CloudWatch Lambda — handles /api/cloudwatch/errors and /api/cloudwatch/logs
 *
 * Replace the TODO sections with real CloudWatch SDK queries.
 * The AWS SDK v3 is available by default in Lambda runtime.
 *
 * Environment variables:
 *   LOG_GROUP_NAME — CloudWatch log group to query
 */
const { success, notFound, serverError, corsPreFlight } = require('../shared/response');

// ── Uncomment when connecting to real CloudWatch ─────────────
// const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
// const cwClient = new CloudWatchLogsClient({});
//
// async function queryLogs(logGroupName, filterPattern, limit = 50) {
//   const cmd = new FilterLogEventsCommand({
//     logGroupName,
//     filterPattern,
//     limit,
//   });
//   const result = await cwClient.send(cmd);
//   return result.events || [];
// }

// Mock data — matches server/src/mockData.ts
const mockErrors = [
  { id: 'err-7821', severity: 'critical', service: 'inventory-db-03', message: 'Connection refused on port 5432', count: 47, firstSeen: '2026-03-16T21:02:00Z', lastSeen: '2026-03-17T08:14:00Z', affectedPipelines: ['Inventory Refresh'], stackTrace: `ERROR: Connection refused\n  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)\n  Host: inventory-db-03.internal\n  Port: 5432\n  Timeout: 30000ms`, resolution: 'Check PostgreSQL service on inventory-db-03, verify security groups, and confirm the host is reachable from the ETL cluster.' },
  { id: 'err-7819', severity: 'high', service: 'talend-job-runner', message: 'Source feed timeout: Finance upstream retry storm', count: 12, firstSeen: '2026-03-17T06:30:00Z', lastSeen: '2026-03-17T06:48:00Z', affectedPipelines: ['Finance D+1 ETL'], stackTrace: `ERROR: Read timeout after 30000ms\n  at FinanceSourceConnector.fetch(FinanceSourceConnector.java:142)\n  Caused by: java.net.SocketTimeoutException: Read timed out`, resolution: 'Increase source read timeout to 90s, check upstream Finance system load, and enable circuit breaker on retry policy.' },
  { id: 'err-7815', severity: 'high', service: 'snowflake-loader', message: 'Schema validation error: unexpected null in amount_usd', count: 3, firstSeen: '2026-03-14T06:30:00Z', lastSeen: '2026-03-14T06:42:00Z', affectedPipelines: ['Finance D+1 ETL'], stackTrace: `ValidationError: Column 'amount_usd' received null but NOT NULL constraint is defined\n  at SchemaValidator.validate(SchemaValidator.ts:88)\n  Row index: 14421, Source: finance_transactions_20260314`, resolution: 'Add null-handling transform step before Snowflake load. Coordinate with upstream Finance team on data quality SLA.' },
  { id: 'err-7810', severity: 'medium', service: 'hr-etl-worker', message: 'Memory limit exceeded: required 6.2GB, allocated 4GB', count: 2, firstSeen: '2026-03-16T05:01:00Z', lastSeen: '2026-03-16T05:05:00Z', affectedPipelines: ['HR Data Warehouse Load'], stackTrace: `FATAL: Container killed due to memory limit\n  Allocated: 4096MB\n  Peak usage: 6349MB\n  Job: hr-warehouse-load-20260316`, resolution: 'Scale up the HR ETL worker to 8GB RAM. Review data volume growth trend — consider chunked loading for large HR payroll datasets.' },
  { id: 'err-7801', severity: 'low', service: 'cloudwatch-agent', message: 'Log delivery delayed: agent buffer overflow', count: 8, firstSeen: '2026-03-17T04:00:00Z', lastSeen: '2026-03-17T04:22:00Z', affectedPipelines: [], stackTrace: `WARN: Buffer overflow detected — 1240 log lines dropped\n  Agent: cloudwatch-agent v1.247349.0\n  Buffer limit: 256KB`, resolution: 'Increase CloudWatch agent buffer to 512KB and enable async log delivery.' },
];

const mockLogs = [
  { id: 'log-001', ts: '2026-03-17T08:15:34Z', level: 'ERROR', service: 'inventory-db-03', message: 'Connection refused on port 5432', pipeline: 'Inventory Refresh' },
  { id: 'log-002', ts: '2026-03-17T08:13:21Z', level: 'WARN', service: 'snowflake-loader', message: 'Retry attempt 3/5 for batch ID sf-batch-9921', pipeline: 'Finance D+1 ETL' },
  { id: 'log-003', ts: '2026-03-17T08:12:00Z', level: 'INFO', service: 'customer-360-sync', message: 'Batch completed: 89,421 records upserted in 17.2s', pipeline: 'Customer 360 Sync' },
  { id: 'log-004', ts: '2026-03-17T08:10:45Z', level: 'ERROR', service: 'inventory-db-03', message: 'FATAL: max_connections (200) exceeded, rejecting new connections', pipeline: 'Inventory Refresh' },
  { id: 'log-005', ts: '2026-03-17T08:09:18Z', level: 'INFO', service: 'sales-feed-agg', message: 'Pipeline run-1121 started: Sales Feed Aggregation', pipeline: 'Sales Feed Aggregation' },
  { id: 'log-006', ts: '2026-03-17T08:07:02Z', level: 'WARN', service: 'hr-etl-worker', message: 'Memory usage at 87% — approaching container limit', pipeline: 'HR Data Warehouse Load' },
  { id: 'log-007', ts: '2026-03-17T08:05:55Z', level: 'INFO', service: 'snowflake-loader', message: 'Micro-batch commit: 12,000 rows → FINANCE.TRANSACTIONS_STAGING', pipeline: 'Finance D+1 ETL' },
  { id: 'log-008', ts: '2026-03-17T08:04:30Z', level: 'ERROR', service: 'talend-job-runner', message: 'Read timeout after 30000ms from Finance upstream source', pipeline: 'Finance D+1 ETL' },
  { id: 'log-009', ts: '2026-03-17T08:02:10Z', level: 'INFO', service: 'cloudwatch-agent', message: 'Health check passed: all 12 monitored endpoints responding', pipeline: null },
  { id: 'log-010', ts: '2026-03-17T08:01:00Z', level: 'INFO', service: 'customer-360-sync', message: 'Incremental sync: 1,241 changed records detected since last run', pipeline: 'Customer 360 Sync' },
  { id: 'log-011', ts: '2026-03-17T07:59:44Z', level: 'WARN', service: 'inventory-db-03', message: 'Slow query detected: 12.4s for inventory_snapshot_v2 (threshold: 5s)', pipeline: 'Inventory Refresh' },
  { id: 'log-012', ts: '2026-03-17T07:58:22Z', level: 'INFO', service: 'sales-feed-agg', message: 'Schema drift check passed — no changes detected', pipeline: 'Sales Feed Aggregation' },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const path = event.path || event.rawPath || '';
  const qs = event.queryStringParameters || {};
  const pathParams = event.pathParameters || {};

  try {
    // GET /api/cloudwatch/errors/:id
    if (path.includes('/errors') && pathParams.id) {
      const error = mockErrors.find((e) => e.id === pathParams.id);
      if (!error) return notFound('Error not found');
      return success(error);
    }

    // GET /api/cloudwatch/errors?severity=...
    if (path.endsWith('/errors')) {
      // TODO: Replace with real CloudWatch query
      const data = qs.severity
        ? mockErrors.filter((e) => e.severity === qs.severity)
        : mockErrors;
      return success(data);
    }

    // GET /api/cloudwatch/logs?level=...&pipeline=...
    if (path.endsWith('/logs')) {
      // TODO: Replace with real CloudWatch Logs Insights query
      let data = [...mockLogs];
      if (qs.level) data = data.filter((l) => l.level === qs.level);
      if (qs.pipeline) data = data.filter((l) => l.pipeline === qs.pipeline);
      return success(data);
    }

    return notFound('Unknown cloudwatch endpoint');
  } catch (err) {
    console.error('CloudWatch Lambda error:', err);
    return serverError(err.message);
  }
};
