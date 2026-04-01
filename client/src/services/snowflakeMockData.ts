/**
 * Snowflake mock data — used by SnowflakeDashboardTab in mock mode only.
 * Mirrors the two dashboard screens: Cost & Efficiency Overview
 * and Snowflake Platform Intelligence.
 */

// ─── Cost & Efficiency ──────────────────────────────────────

export const MOCK_SF_COST_SUMMARY = {
  monthly_cost:   14200,
  warehouse_spend: 9500,
  efficient_pct:    85,
  wasted_spend:    2100,
  budget:         18000,
}

export const MOCK_SF_COST_BY_PIPELINE = [
  { name: 'ingestion_main',   cost: 3200, color: '#e53935' },
  { name: 'transform_core',   cost: 2800, color: '#f57c00' },
  { name: 'reporting_daily',  cost: 2100, color: '#fdd835' },
  { name: 'ml_feature_store', cost: 1900, color: '#43a047' },
  { name: 'audit_pipeline',   cost: 1600, color: '#1e88e5' },
  { name: 'archive_cold',     cost: 1400, color: '#8e24aa' },
  { name: 'enrich_customer',  cost:  900, color: '#00acc1' },
  { name: 'sync_external',    cost:  300, color: '#6d4c41' },
]

/** Scatter data: x = duration bucket label, y = cost ($k), size = run count */
export const MOCK_SF_COST_SCATTER = [
  { bucket: '<30m',    cost: 23.5, runs: 42, name: 'ingestion_main'   },
  { bucket: '<30m',    cost: 22.8, runs: 18, name: 'audit_pipeline'   },
  { bucket: '30-45m',  cost: 22.1, runs: 30, name: 'transform_core'   },
  { bucket: '30-45m',  cost: 12.9, runs: 25, name: 'enrich_customer'  },
  { bucket: '45-60m',  cost: 12.5, runs: 15, name: 'reporting_daily'  },
  { bucket: '45-60m',  cost: 12.3, runs: 20, name: 'ml_feature_store' },
  { bucket: '60-75m',  cost: 12.0, runs: 10, name: 'sync_external'    },
  { bucket: '60-75m',  cost: 13.5, runs: 12, name: 'archive_cold'     },
  { bucket: '>120m',   cost: 13.8, runs:  5, name: 'transform_core'   },
]

/** Bar chart: cost by duration bucket */
export const MOCK_SF_COST_BY_DURATION = [
  { bucket: '<30m',   cost: 3200 },
  { bucket: '30-45m', cost: 2800 },
  { bucket: '45-60m', cost: 2500 },
  { bucket: '60-75m', cost: 2100 },
  { bucket: '>120h',  cost: 1600 },
]

export const MOCK_SF_TOP_COSTLY_JOBS = [
  { pipeline: 'ingestion_main',   run_cost: 4600, run_spend: 5600, success_pct: 88 },
  { pipeline: 'transform_core',   run_cost: 11500, run_spend: 4800, success_pct: 62 },
  { pipeline: 'ml_feature_store', run_cost: 17200, run_spend: 2800, success_pct: 40 },
]

// ─── Platform Intelligence ──────────────────────────────────

export const MOCK_SF_PLATFORM_SUMMARY = {
  long_queries:         42,
  task_failures:        15,
  warehouse_util_pct:   72,
  query_errors:         28,
}

/** Heatmap: rows = warehouses, cols = hours 0-23 */
const WAREHOUSES = ['WH_PROD_XL', 'WH_PROD_LG', 'WH_STAGE', 'WH_DEV', 'WH_REPORT']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function utilPct(wh: string, hour: number): number {
  const base: Record<string, number> = {
    WH_PROD_XL: 80, WH_PROD_LG: 65, WH_STAGE: 50, WH_DEV: 30, WH_REPORT: 55,
  }
  const peak = hour >= 7 && hour <= 18 ? 1.2 : 0.6
  return Math.min(100, Math.round((base[wh] ?? 50) * peak + (Math.sin(hour + wh.length) * 8)))
}

export const MOCK_SF_HEATMAP = WAREHOUSES.map(wh => ({
  row: wh,
  cells: HOURS.map(h => ({ col: `${String(h).padStart(2, '0')}:00`, value: utilPct(wh, h) })),
}))

/** Bar chart: hourly query volume 0–23 */
export const MOCK_SF_HOURLY_QUERIES = HOURS.map(h => ({
  hour: `${String(h).padStart(2, '0')}:00`,
  queries: Math.round(5 + Math.abs(Math.sin((h - 9) * 0.4)) * 20 + (h >= 8 && h <= 17 ? 10 : 0)),
}))

export const MOCK_SF_TOP_SLOW_QUERIES = [
  { pipeline: 'RPT_DAILY_AGGREG',   last_run: '5:18 AM', error_type: 'TIMEOUT',     sla_ok: false, fix: 'Partition pruning'   },
  { pipeline: 'ML_FEAT_EXTRACT',    last_run: '9:28 AM', error_type: 'SPILL',       sla_ok: true,  fix: 'Warehouse upsize'    },
  { pipeline: 'ENRICH_CUSTOMER_V2', last_run: '5:28 AM', error_type: 'LOCK_WAIT',   sla_ok: true,  fix: 'Column pruning'      },
  { pipeline: 'SYNC_EXT_PARTNER',   last_run: '5:28 AM', error_type: 'ROW_ACCESS',  sla_ok: true,  fix: 'Row access policy'   },
]

export const MOCK_SF_ALERT = 'DLQ count is high – review poison pill batching'
