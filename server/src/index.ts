import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateAWSResponse } from './awsAgent';
import { mockKPIs, mockCostBreakdown, mockPipelines, mockErrors, mockLogs, mockTickets, mockDMFSummary, mockDMFStages, mockDMFRunStatus, mockDMFFailedByStage, mockDMFRunsOverTime, mockDMFErrorReasons, mockDMFRecentFailures, mockDMFStatusTrend, mockDMFRowsTrend, mockDMFJobsTrend, mockDMFStepFailureTrend, mockDMFAnalytics, mockDMFLineageMeta, mockDMFLineageJobs } from './mockData';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ─── Existing chat route ───────────────────────────────────
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'DevOps Server is running' });
});

app.post('/api/chat', (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const response = generateAWSResponse(message);
  res.json(response);
});

// ─── SNOWFLAKE — KPIs & Cost ───────────────────────────────
app.get('/api/snowflake/kpis', (_req: Request, res: Response) => {
  res.json(mockKPIs);
});

app.get('/api/snowflake/cost', (_req: Request, res: Response) => {
  res.json(mockCostBreakdown);
});

// ─── POSTGRESQL — Pipelines ────────────────────────────────
app.get('/api/postgres/pipelines', (_req: Request, res: Response) => {
  res.json(mockPipelines);
});

app.get('/api/postgres/pipelines/:id', (req: Request, res: Response) => {
  const pipeline = mockPipelines.find(p => p.id === req.params.id);
  if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
  res.json(pipeline);
});

// ─── CLOUDWATCH — Errors & Logs ────────────────────────────
app.get('/api/cloudwatch/errors', (_req: Request, res: Response) => {
  const { severity } = _req.query;
  const data = severity ? mockErrors.filter(e => e.severity === severity) : mockErrors;
  res.json(data);
});

app.get('/api/cloudwatch/errors/:id', (req: Request, res: Response) => {
  const error = mockErrors.find(e => e.id === req.params.id);
  if (!error) return res.status(404).json({ error: 'Error not found' });
  res.json(error);
});

app.get('/api/cloudwatch/logs', (_req: Request, res: Response) => {
  const { level, pipeline } = _req.query;
  let data = [...mockLogs];
  if (level) data = data.filter(l => l.level === level);
  if (pipeline) data = data.filter(l => l.pipeline === pipeline);
  res.json(data);
});

// ─── SERVICENOW — Tickets ──────────────────────────────────
app.get('/api/servicenow/tickets', (_req: Request, res: Response) => {
  const { status, priority } = _req.query;
  let data = [...mockTickets];
  if (status) data = data.filter(t => t.status === status);
  if (priority) data = data.filter(t => t.priority === priority);
  res.json(data);
});

app.get('/api/servicenow/tickets/:id', (req: Request, res: Response) => {
  const ticket = mockTickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
});

// ─── DMF PIPELINE ──────────────────────────────────────────
app.get('/api/dmf/summary', (_req: Request, res: Response) => {
  res.json(mockDMFSummary);
});

app.get('/api/dmf/stages', (_req: Request, res: Response) => {
  res.json(mockDMFStages);
});

app.get('/api/dmf/run-status', (_req: Request, res: Response) => {
  res.json(mockDMFRunStatus);
});

app.get('/api/dmf/failed-by-stage', (_req: Request, res: Response) => {
  res.json(mockDMFFailedByStage);
});

app.get('/api/dmf/runs-over-time', (_req: Request, res: Response) => {
  res.json(mockDMFRunsOverTime);
});

app.get('/api/dmf/error-reasons', (_req: Request, res: Response) => {
  res.json(mockDMFErrorReasons);
});

app.get('/api/dmf/recent-failures', (_req: Request, res: Response) => {
  const { stage, etlProcess } = _req.query;
  let data = [...mockDMFRecentFailures];
  if (stage) data = data.filter(f => f.failedStage === stage);
  if (etlProcess) data = data.filter(f => f.etlProcess === etlProcess);
  res.json(data);
});

// ─── DMF TRENDS ──────────────────────────────────────────────
app.get('/api/dmf/status-trend', (_req: Request, res: Response) => {
  res.json(mockDMFStatusTrend);
});

app.get('/api/dmf/rows-trend', (_req: Request, res: Response) => {
  res.json(mockDMFRowsTrend);
});

app.get('/api/dmf/jobs-trend', (_req: Request, res: Response) => {
  res.json(mockDMFJobsTrend);
});

app.get('/api/dmf/step-failure-trend', (_req: Request, res: Response) => {
  res.json(mockDMFStepFailureTrend);
});

// ─── DMF ANALYTICS ───────────────────────────────────────────
app.get('/api/dmf/analytics', (_req: Request, res: Response) => {
  res.json(mockDMFAnalytics);
});

// ─── DMF LINEAGE ─────────────────────────────────────────────
app.get('/api/dmf/lineage/meta', (_req: Request, res: Response) => {
  res.json(mockDMFLineageMeta);
});

app.get('/api/dmf/lineage/jobs', (_req: Request, res: Response) => {
  const { sourceCode, datasetName, processTypeCode, status } = _req.query;
  let data = [...mockDMFLineageJobs];
  if (sourceCode && sourceCode !== 'All') data = data.filter(j => j.sourceCode === sourceCode);
  if (datasetName && datasetName !== 'All') data = data.filter(j => j.datasetName === datasetName);
  if (processTypeCode && processTypeCode !== 'All') data = data.filter(j => j.processTypeCode === processTypeCode);
  if (status && status !== 'All') data = data.filter(j => j.status === status);
  res.json(data);
});

// Start server
app.listen(port, () => {
  console.log(`✓ DevOps Server running on http://localhost:${port}`);
});
