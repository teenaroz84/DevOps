/**
 * ServiceNow Lambda — handles /api/servicenow/tickets and /api/servicenow/tickets/:id
 *
 * Replace the TODO sections with real ServiceNow REST API calls.
 *
 * Environment variables:
 *   SERVICENOW_INSTANCE — e.g. https://mycompany.service-now.com
 *   SERVICENOW_USER, SERVICENOW_PASSWORD
 */
const { success, notFound, serverError, corsPreFlight } = require('../shared/response');

// ── Uncomment when connecting to real ServiceNow ─────────────
// const https = require('https');
//
// async function snRequest(tablePath, query = '') {
//   const base = process.env.SERVICENOW_INSTANCE;
//   const url = `${base}/api/now/table/${tablePath}?${query}`;
//   const auth = Buffer.from(
//     `${process.env.SERVICENOW_USER}:${process.env.SERVICENOW_PASSWORD}`
//   ).toString('base64');
//   const res = await fetch(url, {
//     headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
//   });
//   const json = await res.json();
//   return json.result;
// }

// Mock data — matches server/src/mockData.ts
const mockTickets = [
  { id: 'INC0021891', title: 'Finance D+1 pipeline failing — data not available for morning reports', priority: 'P1', status: 'in_progress', assignee: 'Priya Nair', team: 'Data Engineering', createdAt: '2026-03-17T06:45:00Z', updatedAt: '2026-03-17T08:10:00Z', sla: { target: '4hrs', remaining: '2hr 35min', breached: false }, affectedService: 'Finance D+1 ETL', description: 'Finance team reports that the D+1 feed has not landed as of 08:00 AM.', comments: [{ author: 'Priya Nair', time: '2026-03-17T07:10:00Z', text: 'Identified root cause: Talend retry storm due to upstream Finance system slowdown.' }, { author: 'Rohan Mehta', time: '2026-03-17T07:45:00Z', text: 'Upstream Finance team notified. ETA for resolution: 09:30 AM.' }, { author: 'System', time: '2026-03-17T08:10:00Z', text: 'Auto-retry triggered. Monitoring for success.' }] },
  { id: 'INC0021885', title: 'Inventory Refresh pipeline down — PostgreSQL host unreachable', priority: 'P1', status: 'open', assignee: 'Unassigned', team: 'Platform Ops', createdAt: '2026-03-16T21:10:00Z', updatedAt: '2026-03-17T08:00:00Z', sla: { target: '4hrs', remaining: '0hr', breached: true }, affectedService: 'Inventory Refresh', description: 'inventory-db-03 host is not responding on port 5432.', comments: [{ author: 'System', time: '2026-03-16T21:15:00Z', text: 'Auto-escalated to P1 after 2 consecutive failures.' }, { author: 'On-call Bot', time: '2026-03-16T21:16:00Z', text: 'PagerDuty alert sent to platform-ops-oncall.' }] },
  { id: 'INC0021872', title: 'HR ETL memory crash — payroll data missing from Snowflake', priority: 'P2', status: 'resolved', assignee: 'Sanjay Iyer', team: 'Data Engineering', createdAt: '2026-03-16T05:15:00Z', updatedAt: '2026-03-16T09:30:00Z', sla: { target: '8hrs', remaining: 'Resolved in 4hr 15min', breached: false }, affectedService: 'HR Data Warehouse Load', description: 'HR ETL container killed due to memory limit.', comments: [{ author: 'Sanjay Iyer', time: '2026-03-16T06:00:00Z', text: 'Increased worker memory to 8GB. Re-running pipeline manually.' }, { author: 'Sanjay Iyer', time: '2026-03-16T09:30:00Z', text: 'Pipeline re-run successful. Closing ticket.' }] },
  { id: 'INC0021860', title: 'CloudWatch agent dropping logs — buffer overflow', priority: 'P3', status: 'resolved', assignee: 'Dev Kapoor', team: 'Platform Ops', createdAt: '2026-03-17T04:05:00Z', updatedAt: '2026-03-17T05:00:00Z', sla: { target: '24hrs', remaining: 'Resolved in 55min', breached: false }, affectedService: 'CloudWatch', description: '1240 log lines dropped due to buffer overflow.', comments: [{ author: 'Dev Kapoor', time: '2026-03-17T04:30:00Z', text: 'Increased agent buffer to 512KB and enabled async delivery.' }] },
  { id: 'INC0021848', title: '[Request] Increase Snowflake warehouse size for Q1 close', priority: 'P3', status: 'open', assignee: 'Priya Nair', team: 'Data Engineering', createdAt: '2026-03-16T14:00:00Z', updatedAt: '2026-03-16T14:00:00Z', sla: { target: '72hrs', remaining: '53hrs', breached: false }, affectedService: 'Snowflake', description: 'Finance team requests temporary warehouse upgrade from LARGE to X-LARGE.', comments: [] },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  const path = event.path || event.rawPath || '';
  const qs = event.queryStringParameters || {};
  const pathParams = event.pathParameters || {};

  try {
    // GET /api/servicenow/tickets/:id
    if (pathParams.id) {
      const ticket = mockTickets.find((t) => t.id === pathParams.id);
      if (!ticket) return notFound('Ticket not found');
      return success(ticket);
    }

    // GET /api/servicenow/tickets?status=...&priority=...
    if (path.endsWith('/tickets')) {
      // TODO: Replace with real ServiceNow query
      let data = [...mockTickets];
      if (qs.status) data = data.filter((t) => t.status === qs.status);
      if (qs.priority) data = data.filter((t) => t.priority === qs.priority);
      return success(data);
    }

    return notFound('Unknown servicenow endpoint');
  } catch (err) {
    console.error('ServiceNow Lambda error:', err);
    return serverError(err.message);
  }
};
