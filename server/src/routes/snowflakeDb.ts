/**
 * Snowflake dashboard routes — queries executed via PostgreSQL.
 */
import { Router, Request, Response } from 'express';
import { getPgPool } from '../db';

const router = Router();
const queryCache = new Map<string, { expiresAt: number; rows: any }>();

async function safeQuery(sql: string, fallback: any = null): Promise<any> {
  try {
    const pool = getPgPool();
    const result = await pool.query(sql);
    return result.rows;
  } catch (e: any) {
    console.error('Snowflake dashboard Postgres query error:', e.message);
    return fallback;
  }
}

async function safeCachedQuery(cacheKey: string, sql: string, fallback: any = null, ttlMs = 60_000): Promise<any> {
  const now = Date.now();
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.rows;
  }

  const rows = await safeQuery(sql, fallback);
  if (rows != null) {
    queryCache.set(cacheKey, { expiresAt: now + ttlMs, rows });
  }
  return rows;
}

function getLookbackDays(req: Request, fallbackDays: number): number {
  const raw = Number(req.query.days)
  if (!Number.isFinite(raw)) return fallbackDays
  return Math.max(1, Math.min(365, Math.round(raw)))
}

function getAsOfDate(req: Request): string | null {
  const raw = typeof req.query.asOf === 'string' ? req.query.asOf.trim() : ''
  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return raw
}

function sqlRefDate(req: Request): string {
  const asOf = getAsOfDate(req)
  return asOf ? `DATE '${asOf}'` : 'CURRENT_DATE'
}

function sqlSinceDate(req: Request, fallbackDays: number): string {
  const days = getLookbackDays(req, fallbackDays)
  return `(${sqlRefDate(req)} - INTERVAL '${days} day')`
}

function sqlSinceTimestamp(req: Request, fallbackDays: number): string {
  return `${sqlSinceDate(req, fallbackDays)}::timestamp`
}

function sqlRefTimestamp(req: Request): string {
  return `${sqlRefDate(req)}::timestamp`
}

// ─── GET /api/snowflake/cost-summary ──────────────────────
router.get('/cost-summary', async (req: Request, res: Response) => {
  const windowEndDate = sqlRefDate(req);
  const rollingWindowStartDate = sqlSinceDate(req, 30);
  const opportunityWindowStartDate = sqlSinceDate(req, 7);
  const opportunityWindowStartTimestamp = sqlSinceTimestamp(req, 7);
  const rows = await safeQuery(`
    WITH cost_today_cte AS (
      SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_today
      FROM edoops.sf_usage_in_currency_daily
      WHERE usage_date = ${windowEndDate}
    ),
    cost_mtd_cte AS (
      SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_mtd
      FROM edoops.sf_usage_in_currency_daily
      WHERE usage_date >= DATE_TRUNC('month', ${windowEndDate})::date
        AND usage_date <= ${windowEndDate}
    ),
    burn_cte AS (
      SELECT ROUND(COALESCE(AVG(daily_cost::numeric), 0)::numeric, 2) AS avg_daily_burn_30d
      FROM (
        SELECT usage_date, SUM(NULLIF(usage_in_currency::text, '')::numeric) AS daily_cost
        FROM edoops.sf_usage_in_currency_daily
        WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
          AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
        GROUP BY usage_date
      ) d
    ),
    balance_cte AS (
      SELECT ROUND((
          COALESCE(NULLIF(capacity_balance::text, '')::numeric, 0)
        + COALESCE(NULLIF(free_usage_balance::text, '')::numeric, 0)
        + COALESCE(NULLIF(rollover_balance::text, '')::numeric, 0)
        + COALESCE(NULLIF(marketplace_capacity_drawdown_balance::text, '')::numeric, 0)
      )::numeric, 2) AS remaining_balance
      FROM edoops.sf_remaining_balance_daily
      WHERE date = (
        SELECT MAX(date) FROM edoops.sf_remaining_balance_daily
        WHERE date <= ${windowEndDate}
      )
    ),
    opp_cte AS (
      WITH wasted AS (
        SELECT SUM(
          GREATEST(
            COALESCE(NULLIF(credits_used::text, '')::numeric, 0)
            - COALESCE(NULLIF(credits_attributed_compute_queries::text, '')::numeric, 0),
            0
          )
        ) AS wasted_credits
        FROM edoops.sf_warehouse_metering_history
        WHERE NULLIF(start_time::text, '')::timestamp >= ${opportunityWindowStartTimestamp}
          AND NULLIF(start_time::text, '')::timestamp < (${windowEndDate}::timestamp + INTERVAL '1 day')
      ),
      rate_cte AS (
        SELECT COALESCE(AVG(NULLIF(effective_rate::text, '')::numeric), 0) AS avg_rate
        FROM edoops.sf_rate_sheet_daily
        WHERE NULLIF(date::text, '')::date >= ${opportunityWindowStartDate}
          AND NULLIF(date::text, '')::date <= ${windowEndDate}
      )
      SELECT ROUND((wasted.wasted_credits * rate_cte.avg_rate)::numeric, 2) AS optimization_opportunity_currency_7d
      FROM wasted
      CROSS JOIN rate_cte
    )
    SELECT
      m.cost_mtd AS monthly_cost,
      t.cost_today AS warehouse_spend,
      ROUND(
        CASE
          WHEN (m.cost_mtd + b.remaining_balance) > 0
          THEN (b.remaining_balance / (m.cost_mtd + b.remaining_balance)) * 100
          ELSE 0
        END::numeric,
        1
      ) AS efficient_pct,
      o.optimization_opportunity_currency_7d AS wasted_spend,
      ROUND((m.cost_mtd + b.remaining_balance)::numeric, 2) AS budget,
      t.cost_today,
      m.cost_mtd,
      r.avg_daily_burn_30d,
      b.remaining_balance,
      ROUND(
        CASE WHEN r.avg_daily_burn_30d > 0 THEN (b.remaining_balance / r.avg_daily_burn_30d) ELSE NULL END::numeric,
        1
      ) AS days_remaining,
      o.optimization_opportunity_currency_7d
    FROM cost_today_cte t
    CROSS JOIN cost_mtd_cte m
    CROSS JOIN burn_cte r
    CROSS JOIN balance_cte b
    CROSS JOIN opp_cte o
  `, []);
  const r = rows?.[0] ?? {};
  res.json({
    monthly_cost:   parseFloat(r.MONTHLY_COST  ?? r.monthly_cost  ?? 0),
    warehouse_spend: parseFloat(r.WAREHOUSE_SPEND ?? r.warehouse_spend ?? 0),
    efficient_pct:  parseFloat(r.EFFICIENT_PCT ?? r.efficient_pct ?? 0),
    wasted_spend:   parseFloat(r.WASTED_SPEND  ?? r.wasted_spend  ?? 0),
    budget:         parseFloat(r.BUDGET        ?? r.budget        ?? 5000),
    cost_today:     parseFloat(r.COST_TODAY    ?? r.cost_today    ?? 0),
    cost_mtd:       parseFloat(r.COST_MTD      ?? r.cost_mtd      ?? 0),
    avg_daily_burn_30d: parseFloat(r.AVG_DAILY_BURN_30D ?? r.avg_daily_burn_30d ?? 0),
    remaining_balance: parseFloat(r.REMAINING_BALANCE ?? r.remaining_balance ?? 0),
    days_remaining: parseFloat(r.DAYS_REMAINING ?? r.days_remaining ?? 0),
    optimization_opportunity_currency_7d: parseFloat(
      r.OPTIMIZATION_OPPORTUNITY_CURRENCY_7D ?? r.optimization_opportunity_currency_7d ?? 0
    ),
  });
});

// ─── GET /api/snowflake/cost-by-pipeline ──────────────────
router.get('/cost-by-pipeline', async (req: Request, res: Response) => {
  const windowEndDate = sqlRefDate(req);
  const rollingWindowStartDate = sqlSinceDate(req, 30);
  const COLORS = ['#1565c0','#f57c00','#2e7d32','#c62828','#6a1b9a','#00838f','#ef6c00','#558b2f'];
  const rows = await safeQuery(`
    SELECT
      service_type AS name,
      ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
    FROM edoops.sf_usage_in_currency_daily
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY service_type
    ORDER BY cost DESC
    LIMIT 10
  `, []);
  res.json((rows ?? []).map((r: any, i: number) => ({
    name:  r.NAME ?? r.name,
    cost:  parseFloat(r.COST ?? r.cost ?? 0),
    color: COLORS[i % COLORS.length],
  })));
});

// ─── GET /api/snowflake/cost-scatter ──────────────────────
router.get('/cost-scatter', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const rollingWindowStartTimestamp = sqlSinceTimestamp(req, 30);
  const rows = await safeQuery(`
    WITH q AS (
      SELECT
        warehouse_name,
        COUNT(*) AS query_count,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    ),
    w AS (
      SELECT
        warehouse_name,
        SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    )
    SELECT
      CASE
        WHEN COALESCE(q.avg_runtime_ms, 0) < 1800000 THEN '<30m'
        WHEN COALESCE(q.avg_runtime_ms, 0) < 3600000 THEN '30-60m'
        WHEN COALESCE(q.avg_runtime_ms, 0) < 5400000 THEN '60-90m'
        WHEN COALESCE(q.avg_runtime_ms, 0) < 7200000 THEN '90-120m'
        ELSE '>120m'
      END AS bucket,
      ROUND(COALESCE(w.total_credits, 0)::numeric, 2) AS cost,
      COALESCE(q.query_count, 0) AS runs,
      w.warehouse_name AS name
    FROM w
    LEFT JOIN q ON w.warehouse_name = q.warehouse_name
    ORDER BY cost DESC NULLS LAST
    LIMIT 20
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    bucket: r.BUCKET ?? r.bucket,
    cost:   parseFloat(r.COST ?? r.cost ?? 0),
    runs:   parseInt(r.RUNS ?? r.runs ?? 0, 10),
    name:   r.NAME ?? r.name ?? '',
  })));
});

// ─── GET /api/snowflake/warehouse-cost-efficiency ────────
router.get('/warehouse-cost-efficiency', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const rollingWindowStartTimestamp = sqlSinceTimestamp(req, 30);
  const rows = await safeQuery(`
    WITH q AS (
      SELECT
        warehouse_name,
        COUNT(*) AS query_count,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    ),
    w AS (
      SELECT
        warehouse_name,
        SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    )
    SELECT
      w.warehouse_name,
      ROUND(COALESCE(w.total_credits, 0)::numeric, 2) AS total_credits,
      COALESCE(q.query_count, 0) AS query_count,
      ROUND(COALESCE(q.avg_runtime_ms, 0)::numeric, 2) AS avg_runtime_ms,
      CASE
        WHEN COALESCE(q.query_count, 0) > 0
        THEN ROUND((w.total_credits / q.query_count)::numeric, 4)
        ELSE NULL
      END AS credits_per_query
    FROM w
    LEFT JOIN q ON w.warehouse_name = q.warehouse_name
    ORDER BY credits_per_query DESC NULLS LAST, total_credits DESC
    LIMIT 15
  `, []);

  res.json((rows ?? []).map((r: any) => {
    const creditsPerQuery = parseFloat(r.CREDITS_PER_QUERY ?? r.credits_per_query ?? 0);
    let efficiency: 'good' | 'warn' | 'bad' = 'good';
    if (creditsPerQuery >= 0.35) efficiency = 'bad';
    else if (creditsPerQuery >= 0.2) efficiency = 'warn';

    return {
      warehouse_name: r.WAREHOUSE_NAME ?? r.warehouse_name ?? '',
      total_credits: parseFloat(r.TOTAL_CREDITS ?? r.total_credits ?? 0),
      query_count: parseInt(r.QUERY_COUNT ?? r.query_count ?? 0, 10),
      avg_runtime_ms: parseFloat(r.AVG_RUNTIME_MS ?? r.avg_runtime_ms ?? 0),
      credits_per_query: Number.isFinite(creditsPerQuery) ? creditsPerQuery : 0,
      efficiency,
    };
  }));
});

// ─── GET /api/snowflake/cost-by-duration ──────────────────
router.get('/cost-by-duration', async (req: Request, res: Response) => {
  const windowEndDate = sqlRefDate(req);
  const rollingWindowStartDate = sqlSinceDate(req, 30);
  const rows = await safeQuery(`
    SELECT
      TO_CHAR(NULLIF(usage_date::text, '')::date, 'YYYY-MM-DD') AS bucket,
      ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
    FROM edoops.sf_usage_in_currency_daily
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY NULLIF(usage_date::text, '')::date
    ORDER BY NULLIF(usage_date::text, '')::date
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    bucket: r.BUCKET ?? r.bucket,
    cost:   parseFloat(r.COST ?? r.cost ?? 0),
  })));
});

// ─── GET /api/snowflake/top-costly-jobs ───────────────────
router.get('/top-costly-jobs', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const rollingWindowStartTimestamp = sqlSinceTimestamp(req, 30);
  const rows = await safeQuery(`
    WITH query_patterns AS (
      SELECT
        COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
        warehouse_name,
        COUNT(*) AS execution_count,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms,
        ROUND((SUM(COALESCE(NULLIF(bytes_scanned::text, '')::numeric, 0)) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS scanned_tb
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))), warehouse_name
    ),
    warehouse_cost AS (
      SELECT
        warehouse_name,
        SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY warehouse_name
    )
    SELECT
      qp.query_pattern AS pipeline,
      qp.avg_runtime_ms AS run_cost,
      ROUND(COALESCE(wc.total_credits, 0)::numeric, 2) AS run_spend,
      LEAST(qp.execution_count, 100) AS success_pct
    FROM query_patterns qp
    LEFT JOIN warehouse_cost wc ON qp.warehouse_name = wc.warehouse_name
    ORDER BY qp.scanned_tb DESC, qp.avg_runtime_ms DESC
    LIMIT 10
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    pipeline:    r.PIPELINE    ?? r.pipeline ?? '',
    run_cost:    parseFloat(r.RUN_COST    ?? r.run_cost    ?? 0),
    run_spend:   parseFloat(r.RUN_SPEND   ?? r.run_spend   ?? 0),
    success_pct: parseInt(r.SUCCESS_PCT  ?? r.success_pct ?? 0, 10),
  })));
});

// ─── GET /api/snowflake/platform-summary ──────────────────
router.get('/platform-summary', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const summaryWindowStartTimestamp = sqlSinceTimestamp(req, 1);
  const [qRows, tRows, wRows, loginRows] = await Promise.all([
    safeQuery(`
      SELECT
        COUNT(*) FILTER (WHERE NULLIF(total_elapsed_time::text, '')::numeric > 60000) AS long_queries,
        COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS query_errors,
        COUNT(*)                                        AS queries_today,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE execution_status ILIKE 'SUCCESS%') / NULLIF(COUNT(*), 0)
        , 1) AS query_success_pct,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric), 0) AS avg_query_time_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    `, [{}]),
    safeQuery(`
      SELECT COUNT(*) FILTER (WHERE state ILIKE 'FAILED%') AS task_failures
      FROM edoops.sf_task_history
      WHERE NULLIF(scheduled_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
        AND NULLIF(scheduled_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    `, [{}]),
    safeQuery(`
      SELECT
        ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(NULLIF(credits_used::text, '')::numeric, 0) > 0) / NULLIF(COUNT(*), 0), 1) AS warehouse_util_pct,
        ROUND(COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0)::numeric, 2) AS warehouse_credits_used
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    `, [{}]),
    safeQuery(`
      SELECT COUNT(*) AS failed_logins
      FROM edoops.sf_login_history
      WHERE NULLIF(event_timestamp::text, '')::timestamp >= ${summaryWindowStartTimestamp}
        AND NULLIF(event_timestamp::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND is_success = 'NO'
    `, [{}]),
  ]);
  const q = qRows?.[0] ?? {};
  const t = tRows?.[0] ?? {};
  const w = wRows?.[0] ?? {};
  const l = loginRows?.[0] ?? {};
  res.json({
    long_queries:       parseInt(q.LONG_QUERIES       ?? q.long_queries       ?? 0, 10),
    task_failures:      parseInt(t.TASK_FAILURES       ?? t.task_failures       ?? 0, 10),
    warehouse_util_pct: parseFloat(w.WAREHOUSE_UTIL_PCT ?? w.warehouse_util_pct ?? 0),
    query_errors:       parseInt(q.QUERY_ERRORS        ?? q.query_errors        ?? 0, 10),
    queries_today:      parseInt(q.QUERIES_TODAY        ?? q.queries_today       ?? 0, 10),
    query_success_pct:  parseFloat(q.QUERY_SUCCESS_PCT  ?? q.query_success_pct  ?? 0),
    avg_query_time_ms:  parseInt(q.AVG_QUERY_TIME_MS   ?? q.avg_query_time_ms   ?? 0, 10),
    warehouse_credits_used: parseFloat(w.WAREHOUSE_CREDITS_USED ?? w.warehouse_credits_used ?? 0),
    failed_logins:      parseInt(l.FAILED_LOGINS        ?? l.failed_logins       ?? 0, 10),
  });
});

// ─── GET /api/snowflake/warehouse-heatmap ─────────────────
router.get('/warehouse-heatmap', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const heatmapWindowStartTimestamp = sqlSinceTimestamp(req, 7);
  const rows = await safeQuery(`
    WITH raw AS (
      SELECT
        warehouse_name,
        EXTRACT(HOUR FROM NULLIF(start_time::text, '')::timestamp) AS hour,
        COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0) AS credits_used
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${heatmapWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY warehouse_name, hour
    ),
    maxv AS (
      SELECT GREATEST(MAX(credits_used), 0.000001) AS max_credits
      FROM raw
    )
    SELECT
      raw.warehouse_name,
      raw.hour,
      ROUND((raw.credits_used / maxv.max_credits) * 100, 2) AS util_pct,
      ROUND(raw.credits_used, 2) AS credits_used
    FROM raw
    CROSS JOIN maxv
    ORDER BY raw.warehouse_name, raw.hour
  `, []);

  // Build { row, cells[] } structure expected by HeatmapGrid
  const warehouses: Record<string, Record<number, number>> = {};
  for (const r of (rows ?? [])) {
    const wh = r.WAREHOUSE_NAME ?? r.warehouse_name;
    const hr = parseInt(r.HOUR ?? r.hour ?? 0, 10);
    const val = parseFloat(r.UTIL_PCT ?? r.util_pct ?? 0);
    if (!warehouses[wh]) warehouses[wh] = {};
    warehouses[wh][hr] = val;
  }
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  const result = Object.entries(warehouses).map(([wh, hourMap]) => ({
    row: wh,
    cells: hours.map((col, i) => ({ col, value: hourMap[i] ?? 0 })),
  }));
  res.json(result);
});

// ─── GET /api/snowflake/hourly-queries ────────────────────
router.get('/hourly-queries', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const hourlyWindowStartTimestamp = sqlSinceTimestamp(req, 1);
  const rows = await safeQuery(`
    SELECT
      DATE_PART('hour', NULLIF(start_time::text, '')::timestamp) AS hour,
      COUNT(*)                       AS queries
    FROM edoops.sf_query_history
    WHERE NULLIF(start_time::text, '')::timestamp >= ${hourlyWindowStartTimestamp}
      AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    GROUP BY hour
    ORDER BY hour
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    hour:    `${String(parseInt(r.HOUR ?? r.hour ?? 0, 10)).padStart(2, '0')}:00`,
    queries: parseInt(r.QUERIES ?? r.queries ?? 0, 10),
  })));
});

// ─── GET /api/snowflake/top-slow-queries ──────────────────
router.get('/top-slow-queries', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const rollingWindowStartTimestamp = sqlSinceTimestamp(req, 30);
  const cacheKey = `top-slow-queries:${getAsOfDate(req) ?? 'current'}:30`;
  const rows = await safeCachedQuery(cacheKey, `
    WITH base AS MATERIALIZED (
      SELECT
        COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
        NULLIF(start_time::text, '')::timestamp AS start_ts,
        NULLIF(total_elapsed_time::text, '')::numeric AS elapsed_ms,
        COALESCE(execution_status::text, '') AS execution_status,
        NULLIF(error_message::text, '') AS error_message
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND NULLIF(total_elapsed_time::text, '')::numeric IS NOT NULL
    ),
    candidates AS MATERIALIZED (
      SELECT
        query_pattern,
        MAX(start_ts) AS last_run,
        ROUND(AVG(elapsed_ms), 2) AS avg_elapsed_ms,
        MAX(elapsed_ms) AS max_elapsed_ms,
        COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS error_count,
        MAX(error_message) AS latest_error_message
      FROM base
      GROUP BY query_pattern
      ORDER BY error_count DESC, max_elapsed_ms DESC NULLS LAST, avg_elapsed_ms DESC NULLS LAST
      LIMIT 25
    ),
    ranked AS (
      SELECT
        b.query_pattern,
        ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY b.elapsed_ms))::numeric, 2) AS p95_elapsed_ms
      FROM base b
      JOIN candidates c ON c.query_pattern = b.query_pattern
      GROUP BY b.query_pattern
    )
    SELECT
      c.query_pattern AS pipeline,
      TO_CHAR(c.last_run, 'HH24:MI') AS last_run,
      CASE WHEN c.error_count > 0 THEN 'ERROR' ELSE 'SLOW' END AS error_type,
      CASE WHEN c.error_count > 0 OR ranked.p95_elapsed_ms >= 15000 THEN FALSE ELSE TRUE END AS sla_ok,
      CASE
        WHEN ranked.p95_elapsed_ms >= 60000 THEN 'Consider clustering, pruning, or materialized view'
        WHEN ranked.p95_elapsed_ms >= 15000 THEN 'Review joins and warehouse sizing'
        ELSE 'Monitor pattern'
      END AS fix
    FROM candidates c
    JOIN ranked ON ranked.query_pattern = c.query_pattern
    ORDER BY ranked.p95_elapsed_ms DESC NULLS LAST, c.error_count DESC, c.max_elapsed_ms DESC NULLS LAST
    LIMIT 10
  `, [], 45_000);
  res.json((rows ?? []).map((r: any) => ({
    pipeline:   r.PIPELINE   ?? r.pipeline   ?? '',
    last_run:   r.LAST_RUN   ?? r.last_run   ?? '',
    error_type: r.ERROR_TYPE ?? r.error_type ?? null,
    sla_ok:     !!(r.SLA_OK  ?? r.sla_ok),
    fix:        r.FIX        ?? r.fix        ?? '',
  })));
});

// ─── GET /api/snowflake/query-volume-trend ────────────────
router.get('/query-volume-trend', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const trendWindowStartTimestamp = sqlSinceTimestamp(req, 14);
  const cacheKey = `query-volume-trend:${getAsOfDate(req) ?? 'current'}:14`;
  const rows = await safeCachedQuery(cacheKey, `
    WITH base AS MATERIALIZED (
      SELECT
        DATE_TRUNC('day', NULLIF(start_time::text, '')::timestamp) AS day_bucket,
        NULLIF(total_elapsed_time::text, '')::numeric AS elapsed_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${trendWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    )
    SELECT
      TO_CHAR(day_bucket, 'MM/DD') AS date,
      COUNT(*) AS queries,
      ROUND(AVG(elapsed_ms), 0) AS avg_time_ms
    FROM base
    GROUP BY day_bucket
    ORDER BY day_bucket
  `, [], 30_000);
  res.json((rows ?? []).map((r: any) => ({
    date:        r.DATE        ?? r.date        ?? '',
    queries:     parseInt(r.QUERIES    ?? r.queries    ?? 0, 10),
    avg_time_ms: parseInt(r.AVG_TIME_MS ?? r.avg_time_ms ?? 0, 10),
  })));
});

// ─── GET /api/snowflake/task-reliability ──────────────────
router.get('/task-reliability', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const reliabilityWindowStartTimestamp = sqlSinceTimestamp(req, 14);
  const rows = await safeQuery(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp), 'MM/DD') AS date,
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE state ILIKE 'SUCCEEDED%')      AS succeeded,
      COUNT(*) FILTER (WHERE state ILIKE 'FAILED%')         AS failed
    FROM edoops.sf_task_history
    WHERE NULLIF(scheduled_time::text, '')::timestamp >= ${reliabilityWindowStartTimestamp}
      AND NULLIF(scheduled_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    GROUP BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp)
    ORDER BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp)
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    date:      r.DATE      ?? r.date      ?? '',
    total:     parseInt(r.TOTAL     ?? r.total     ?? 0, 10),
    succeeded: parseInt(r.SUCCEEDED ?? r.succeeded ?? 0, 10),
    failed:    parseInt(r.FAILED    ?? r.failed    ?? 0, 10),
  })));
});

// ─── GET /api/snowflake/login-failures ────────────────────
router.get('/login-failures', async (req: Request, res: Response) => {
  const windowEndTimestamp = sqlRefTimestamp(req);
  const loginWindowStartTimestamp = sqlSinceTimestamp(req, 14);
  const rows = await safeQuery(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp), 'MM/DD') AS date,
      COUNT(*) AS failed_logins
    FROM edoops.sf_login_history
    WHERE NULLIF(event_timestamp::text, '')::timestamp >= ${loginWindowStartTimestamp}
      AND NULLIF(event_timestamp::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      AND is_success = 'NO'
    GROUP BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp)
    ORDER BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp)
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    date:          r.DATE          ?? r.date          ?? '',
    failed_logins: parseInt(r.FAILED_LOGINS ?? r.failed_logins ?? 0, 10),
  })));
});

// ─── GET /api/snowflake/storage-growth ────────────────────
router.get('/storage-growth', async (req: Request, res: Response) => {
  const windowEndDate = sqlRefDate(req);
  const rollingWindowStartDate = sqlSinceDate(req, 30);
  const rows = await safeQuery(`
    SELECT
      TO_CHAR(NULLIF(usage_date::text, '')::date, 'MM/DD') AS date,
      ROUND((COALESCE(SUM(NULLIF(average_stage_bytes::text, '')::numeric), 0) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS storage_tb
    FROM edoops.sf_stage_storage_usage_history
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY NULLIF(usage_date::text, '')::date
    ORDER BY NULLIF(usage_date::text, '')::date
  `, []);
  res.json((rows ?? []).map((r: any) => ({
    date:       r.DATE       ?? r.date       ?? '',
    storage_tb: parseFloat(r.STORAGE_TB ?? r.storage_tb ?? 0),
  })));
});

export default router;
