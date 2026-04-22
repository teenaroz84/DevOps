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
// Extended fields (also returned by the live /cost-summary endpoint)
;(MOCK_SF_COST_SUMMARY as any).cost_today    = 5420
;(MOCK_SF_COST_SUMMARY as any).cost_mtd      = 45876
;(MOCK_SF_COST_SUMMARY as any).avg_daily_burn_30d = 1529
;(MOCK_SF_COST_SUMMARY as any).remaining_balance  = 22154
;(MOCK_SF_COST_SUMMARY as any).days_remaining     = 14
;(MOCK_SF_COST_SUMMARY as any).optimization_opportunity_currency_7d = 3300

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

export const MOCK_SF_WAREHOUSE_COST_EFFICIENCY = [
  { warehouse_name: 'WH_QUERY01', total_credits: 7.8, query_count: 210, avg_runtime_ms: 210000, credits_per_query: 0.0371, efficiency: 'warn' as const },
  { warehouse_name: 'API_SYNC_JOB', total_credits: 4.6, query_count: 75, avg_runtime_ms: 75000, credits_per_query: 0.0613, efficiency: 'bad' as const },
  { warehouse_name: 'EXPORT_PROC', total_credits: 3.2, query_count: 48, avg_runtime_ms: 48000, credits_per_query: 0.0667, efficiency: 'good' as const },
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
;(MOCK_SF_PLATFORM_SUMMARY as any).queries_today          = 1214
;(MOCK_SF_PLATFORM_SUMMARY as any).query_success_pct      = 98.3
;(MOCK_SF_PLATFORM_SUMMARY as any).avg_query_time_ms      = 375
;(MOCK_SF_PLATFORM_SUMMARY as any).warehouse_credits_used = 3785
;(MOCK_SF_PLATFORM_SUMMARY as any).failed_logins          = 5

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
  { pipeline: 'FINANCE_MONTH_END_CLOSE',      last_run: '6:02 AM', error_type: 'TIMEOUT',    sla_ok: false, fix: 'Predicate pushdown'    },
  { pipeline: 'CLAIMS_CROSSWALK_REFRESH',     last_run: '6:14 AM', error_type: 'SPILL',      sla_ok: false, fix: 'Temporary table tuning' },
  { pipeline: 'CUSTOMER_360_SEGMENT_BUILD',   last_run: '6:31 AM', error_type: 'LOCK_WAIT',  sla_ok: true,  fix: 'Concurrency review'     },
  { pipeline: 'RISK_SCORE_BATCH_V5',          last_run: '6:47 AM', error_type: 'ERROR',      sla_ok: false, fix: 'Query plan review'      },
  { pipeline: 'OPERATIONS_SNAPSHOT_ROLLUP',   last_run: '7:05 AM', error_type: 'SLOW',       sla_ok: false, fix: 'Warehouse resize'       },
  { pipeline: 'MEMBER_ELIGIBILITY_RECON',     last_run: '7:22 AM', error_type: 'SPILL',      sla_ok: true,  fix: 'Join simplification'    },
  { pipeline: 'PROVIDER_NETWORK_ALIGNMENT',   last_run: '7:44 AM', error_type: 'TIMEOUT',    sla_ok: false, fix: 'Clustering review'      },
  { pipeline: 'DIGITAL_EVENTS_SESSIONIZE',    last_run: '8:09 AM', error_type: 'LOCK_WAIT',  sla_ok: true,  fix: 'Task staggering'        },
  { pipeline: 'BILLING_ADJUSTMENT_AUDIT',     last_run: '8:33 AM', error_type: 'ERROR',      sla_ok: false, fix: 'Retry and alerting'     },
  { pipeline: 'PHARMACY_CLAIMS_P95_MONITOR',  last_run: '8:58 AM', error_type: 'SLOW',       sla_ok: true,  fix: 'Materialized view'      },
  { pipeline: 'PRODUCT_USAGE_ENTITLEMENT',    last_run: '9:17 AM', error_type: 'ROW_ACCESS', sla_ok: true,  fix: 'Policy evaluation'      },
  { pipeline: 'ENTERPRISE_USAGE_FACT_LOAD',   last_run: '9:46 AM', error_type: 'TIMEOUT',    sla_ok: false, fix: 'Partition strategy'     },
]

export const MOCK_SF_ALERT = 'DLQ count is high – review poison pill batching'

// ─── New trend datasets ─────────────────────────────────────

const DATES_14 = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i))
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')}`
})

export const MOCK_SF_QUERY_VOLUME_TREND = DATES_14.map((date, i) => ({
  date,
  queries:     Math.round(900 + Math.sin(i * 0.7) * 200 + (i % 2 === 0 ? 100 : 0)),
  avg_time_ms: Math.round(320 + Math.cos(i * 0.5) * 80),
}))

export const MOCK_SF_TASK_RELIABILITY = DATES_14.map((date, i) => {
  const total = Math.round(80 + Math.sin(i * 0.6) * 15)
  const failed = Math.round(Math.abs(Math.sin(i * 1.2)) * 8)
  return { date, total, succeeded: total - failed, failed }
})

export const MOCK_SF_LOGIN_FAILURES = DATES_14.map((date, i) => ({
  date,
  failed_logins: Math.round(2 + Math.abs(Math.sin(i * 0.9)) * 6),
}))

export const MOCK_SF_STORAGE_GROWTH = DATES_14.map((date, i) => ({
  date,
  storage_tb: parseFloat((480 + i * 4.5 + Math.sin(i) * 8).toFixed(1)),
}))
