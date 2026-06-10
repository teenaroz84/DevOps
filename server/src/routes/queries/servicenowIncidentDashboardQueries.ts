const CURRENT_INTERVAL_TOKEN = '__CURRENT_INTERVAL__'
const PREVIOUS_INTERVAL_TOKEN = '__PREVIOUS_INTERVAL__'
const PLATFORM_FILTER_TOKEN = '__PLATFORM_FILTER__'

const TOTAL_INCIDENTS_QUERY_TEMPLATE = `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  COUNT(*) AS total_incidents,
  COUNT(*) FILTER (WHERE sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS current_90d,
  COUNT(*) FILTER (WHERE sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS prev_90d
FROM latest
WHERE rn = 1
  AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
${PLATFORM_FILTER_TOKEN};
`

const INCIDENT_LIFECYCLE_QUERY_TEMPLATE = `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  COUNT(*) FILTER (WHERE sninc_state = 'New'
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS new_current,
  COUNT(*) FILTER (WHERE sninc_state in ('In Progress', 'On Hold')
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_current,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS closed_current,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS reopened_current,
  COUNT(*) FILTER (WHERE sninc_state = 'New'
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS new_prev,
  COUNT(*) FILTER (WHERE sninc_state in ('In Progress', 'On Hold')
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_prev,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS closed_prev,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS reopened_prev,
  COUNT(*) FILTER (WHERE sninc_inc_rag = 1
                   AND sninc_open_rag = 1
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS ai_triaged_current,
  COUNT(*) FILTER (WHERE sninc_open_rag = 1
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS ai_total_current,
  COUNT(*) FILTER (WHERE sninc_inc_rag = 1
                   AND sninc_open_rag = 1
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS ai_triaged_prev,
  COUNT(*) FILTER (WHERE sninc_open_rag = 1
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS ai_total_prev
FROM latest
WHERE rn = 1
  AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
${PLATFORM_FILTER_TOKEN};
`

function buildPlatformFilter(hasPlatform: boolean, parameterIndex: number) {
  return hasPlatform ? `  AND sninc_applkp_pltf_nm = $${parameterIndex}` : ''
}

function applyQueryTokens(template: string, days: number, hasPlatform: boolean) {
  const currentInterval = `${days} days`
  const previousInterval = `${days * 2} days`

  return template
    .split(CURRENT_INTERVAL_TOKEN).join(currentInterval)
    .split(PREVIOUS_INTERVAL_TOKEN).join(previousInterval)
    .replace(PLATFORM_FILTER_TOKEN, buildPlatformFilter(hasPlatform, 1))
}

export function buildTotalIncidentsDashboardQuery(days: number | null, hasPlatform: boolean) {
  if (days === null) {
    return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  COUNT(*) AS total_incidents,
  COUNT(*) AS current_90d,
  0 AS prev_90d
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)};
`
  }

  return applyQueryTokens(TOTAL_INCIDENTS_QUERY_TEMPLATE, days, hasPlatform)
}

export function buildIncidentLifecycleDashboardQuery(days: number | null, hasPlatform: boolean) {
  if (days === null) {
    return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  COUNT(*) FILTER (WHERE sninc_state = 'New') AS new_current,
  COUNT(*) FILTER (WHERE sninc_state in ('In Progress', 'On Hold')) AS open_current,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')) AS closed_current,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL) AS reopened_current,
  0 AS new_prev,
  0 AS open_prev,
  0 AS closed_prev,
  0 AS reopened_prev,
  COUNT(*) FILTER (WHERE sninc_inc_rag = 1 AND sninc_open_rag = 1) AS ai_triaged_current,
  COUNT(*) FILTER (WHERE sninc_open_rag = 1) AS ai_total_current,
  0 AS ai_triaged_prev,
  0 AS ai_total_prev
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)};
`
  }

  return applyQueryTokens(INCIDENT_LIFECYCLE_QUERY_TEMPLATE, days, hasPlatform)
}

export function buildIncidentTrendDailyLineQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n  AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  sninc_opened_at::DATE AS incident_date,
  COUNT(*)              AS incident_count
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
GROUP BY sninc_opened_at::DATE
ORDER BY incident_date ASC;
`
}

export function buildTopKpiTrendsQuery(days: number | null, hasPlatform: boolean) {
  const effectiveDays = days ?? 90
  const lookbackDays = Math.max(effectiveDays - 1, 0)

  return `
WITH date_spine AS (
  SELECT generate_series(
    (NOW() - INTERVAL '${lookbackDays} days')::DATE,
    NOW()::DATE,
    '1 day'::INTERVAL
  )::DATE AS trend_date
),
latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
latest_filtered AS (
  SELECT *
  FROM latest
  WHERE rn = 1
${hasPlatform ? '    AND sninc_applkp_pltf_nm = $1' : ''}
),
ticket_window AS (
  SELECT
    sninc_inc_num,
    sninc_opened_at::DATE AS open_from,
    LEAST(sninc_resolved_at::DATE, sninc_closed_at::DATE) AS open_until
  FROM latest_filtered
  WHERE sninc_opened_at IS NOT NULL
),
daily_flow AS (
  SELECT
    sninc_opened_at::DATE AS trend_date,
    COUNT(*) AS total_opened,
    COUNT(*) FILTER (WHERE sninc_state = 'New') AS new_count,
    COUNT(*) FILTER (WHERE sninc_inc_rag = 1) AS ai_triaged,
    COUNT(*) FILTER (WHERE sninc_open_rag = 1) AS open_rag
  FROM latest_filtered
  WHERE sninc_opened_at >= NOW() - INTERVAL '${lookbackDays} days'
    AND sninc_opened_at IS NOT NULL
  GROUP BY sninc_opened_at::DATE
),
daily_closed AS (
  SELECT
    LEAST(sninc_resolved_at::DATE, sninc_closed_at::DATE) AS trend_date,
    COUNT(*) AS closed_count
  FROM latest_filtered
  WHERE sninc_state IN ('Resolved', 'Closed', 'Canceled')
    AND LEAST(sninc_resolved_at::DATE, sninc_closed_at::DATE) >= NOW() - INTERVAL '${lookbackDays} days'
    AND LEAST(sninc_resolved_at::DATE, sninc_closed_at::DATE) IS NOT NULL
  GROUP BY LEAST(sninc_resolved_at::DATE, sninc_closed_at::DATE)
),
daily_reopened AS (
  SELECT
    sninc_reopened_dttm::DATE AS trend_date,
    COUNT(*) AS reopened_count
  FROM latest_filtered
  WHERE sninc_reopened_dttm IS NOT NULL
    AND sninc_reopened_dttm >= NOW() - INTERVAL '${lookbackDays} days'
  GROUP BY sninc_reopened_dttm::DATE
),
daily_open_snapshot AS (
  SELECT
    d.trend_date,
    COUNT(t.sninc_inc_num) AS open_snapshot
  FROM date_spine d
  LEFT JOIN ticket_window t
    ON t.open_from <= d.trend_date
   AND (t.open_until IS NULL OR t.open_until > d.trend_date)
  GROUP BY d.trend_date
)
SELECT
  d.trend_date,
  COALESCE(f.total_opened, 0) AS kpi1_total_opened,
  ROUND(AVG(COALESCE(f.total_opened, 0)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi1_rolling_7d,
  COALESCE(f.new_count, 0) AS kpi2_new_count,
  ROUND(AVG(COALESCE(f.new_count, 0)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi2_rolling_7d,
  COALESCE(os.open_snapshot, 0) AS kpi3_open_snapshot,
  ROUND(AVG(COALESCE(os.open_snapshot, 0)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi3_rolling_7d,
  COALESCE(c.closed_count, 0) AS kpi4_closed_count,
  ROUND(AVG(COALESCE(c.closed_count, 0)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi4_rolling_7d,
  COALESCE(r.reopened_count, 0) AS kpi5_reopened_count,
  ROUND(AVG(COALESCE(r.reopened_count, 0)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi5_rolling_7d,
  COALESCE(f.ai_triaged, 0) AS kpi6_ai_triaged,
  ROUND(100.0 * COALESCE(f.ai_triaged, 0) / NULLIF(COALESCE(f.open_rag, 0), 0), 1) AS kpi6_ai_rag_pct,
  ROUND(AVG(ROUND(100.0 * COALESCE(f.ai_triaged, 0) / NULLIF(COALESCE(f.open_rag, 0), 0), 1)) OVER (
    ORDER BY d.trend_date ASC
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  )::NUMERIC, 1) AS kpi6_rolling_7d
FROM date_spine d
LEFT JOIN daily_flow f ON f.trend_date = d.trend_date
LEFT JOIN daily_closed c ON c.trend_date = d.trend_date
LEFT JOIN daily_reopened r ON r.trend_date = d.trend_date
LEFT JOIN daily_open_snapshot os ON os.trend_date = d.trend_date
ORDER BY d.trend_date ASC;
`
}

export function buildIncidentStateOverTimeDailyStackedBarQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n  AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  sninc_opened_at::DATE                                            AS incident_date,
  COUNT(*) FILTER (WHERE sninc_state = 'New')                      AS new_count,
  COUNT(*) FILTER (WHERE sninc_state in ('In Progress', 'On Hold')) AS open_count,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')) AS closed_count,
  COUNT(*)                                                          AS total_count
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
GROUP BY sninc_opened_at::DATE
ORDER BY incident_date ASC;
`
}

export function buildIncidentsByAssignmentGroupTop10Query(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n    AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
grouped AS (
  SELECT
    sninc_assignment_grp AS assignment_group,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
    AND sninc_assignment_grp IS NOT NULL
  GROUP BY sninc_assignment_grp
)
SELECT
  assignment_group,
  incident_count,
  MAX(incident_count) OVER () AS max_count,
  ROUND(100.0 * incident_count / NULLIF(SUM(incident_count) OVER (), 0), 1) AS pct_of_total
FROM grouped
ORDER BY incident_count DESC
LIMIT 10;
`
}

export function buildIncidentsByPlatformApplicationTop10Query(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n    AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
grouped AS (
  SELECT
    COALESCE(sninc_mon_app_name, sninc_appl, 'Unknown') AS platform_app,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')) AS open_count
  FROM latest
  WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
  GROUP BY COALESCE(sninc_mon_app_name, sninc_appl, 'Unknown')
)
SELECT
  platform_app,
  total_count,
  open_count,
  ROUND(100.0 * open_count / NULLIF(SUM(open_count) OVER (), 0), 1) AS pct_of_open
FROM grouped
ORDER BY total_count DESC
LIMIT 10;
`
}

export function buildIncidentsByPriorityDonutQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n    AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
grouped AS (
  SELECT
    sninc_priority AS priority,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
    AND sninc_priority IS NOT NULL
  GROUP BY sninc_priority
)
SELECT
  priority,
  incident_count,
  ROUND(100.0 * incident_count / NULLIF(SUM(incident_count) OVER (), 0), 1) AS pct_of_total
FROM grouped
ORDER BY priority ASC;
`
}

export function buildSlaPerformancePanelGaugeQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n  AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  COUNT(*) FILTER (
    WHERE sninc_expiry_dttm > NOW() + INTERVAL '4 hours'
  ) AS within_sla,
  COUNT(*) FILTER (
    WHERE sninc_expiry_dttm <= NOW() + INTERVAL '4 hours'
      AND sninc_expiry_dttm > NOW()
  ) AS breaching_soon,
  COUNT(*) FILTER (
    WHERE sninc_expiry_dttm <= NOW()
  ) AS breached,
  COUNT(*) AS total_open,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE sninc_expiry_dttm > NOW() + INTERVAL '4 hours'
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS within_sla_pct
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
  AND sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')
  AND sninc_expiry_dttm IS NOT NULL;
`
}

export function buildSlaBreachRiskAlertBannerTicketsQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n  AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
)
SELECT
  sninc_inc_num,
  sninc_short_desc,
  sninc_assignment_grp,
  sninc_priority,
  sninc_expiry_dttm,
  ROUND((EXTRACT(EPOCH FROM (sninc_expiry_dttm - NOW())) / 60)) AS minutes_to_breach,
  sninc_mon_sla,
  sninc_last_updt_dttm
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
  AND sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')
  AND sninc_expiry_dttm BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
ORDER BY sninc_expiry_dttm ASC
LIMIT 10;
`
}

export function buildAgingOfOpenIncidentsHorizontalBarQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n    AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
bucketed AS (
  SELECT
    CASE
      WHEN (NOW()::DATE - sninc_opened_at::DATE) BETWEEN 0 AND 1 THEN '0-1 Days'
      WHEN (NOW()::DATE - sninc_opened_at::DATE) BETWEEN 2 AND 3 THEN '2-3 Days'
      WHEN (NOW()::DATE - sninc_opened_at::DATE) BETWEEN 4 AND 7 THEN '4-7 Days'
      WHEN (NOW()::DATE - sninc_opened_at::DATE) BETWEEN 8 AND 15 THEN '8-15 Days'
      WHEN (NOW()::DATE - sninc_opened_at::DATE) BETWEEN 16 AND 30 THEN '16-30 Days'
      ELSE '31+ Days'
    END AS age_bucket,
    (NOW()::DATE - sninc_opened_at::DATE) AS age_days
  FROM latest
  WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
    AND sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')
    AND sninc_opened_at IS NOT NULL
),
grouped AS (
  SELECT
    age_bucket,
    COUNT(*) AS incident_count,
    MIN(age_days) AS min_age_days
  FROM bucketed
  GROUP BY age_bucket
)
SELECT
  age_bucket,
  incident_count,
  ROUND(100.0 * incident_count / NULLIF(SUM(incident_count) OVER (), 0), 1) AS pct_of_open
FROM grouped
ORDER BY min_age_days ASC;
`
}

export function buildTopIncidentCategoriesQuery(days: number | null, hasPlatform: boolean) {
  const openedAtFilter = days === null ? '' : `\n    AND sninc_opened_at >= NOW() - INTERVAL '${days} days'`
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
grouped AS (
  SELECT
    sninc_category_cd AS category,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)}${openedAtFilter}
    AND sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')
    AND sninc_category_cd IS NOT NULL
  GROUP BY sninc_category_cd
)
SELECT
  category,
  incident_count,
  ROUND(100.0 * incident_count / NULLIF(SUM(incident_count) OVER (), 0), 1) AS pct_of_open
FROM grouped
ORDER BY incident_count DESC
LIMIT 5;
`
}

export function buildTopIncidentsByUpdateCountQuery(days: number | null, hasPlatform: boolean) {
  const updateFilter = days === null ? '' : `\n  WHERE sninc_last_updt_dttm >= NOW() - INTERVAL '${days} days'`
  return `
WITH source_rows AS (
  SELECT *
  FROM edoops.service_now_inc${updateFilter}
),
WITH update_counts AS (
  SELECT
    sninc_inc_num,
    COUNT(*) AS update_count,
    MAX(sninc_last_updt_dttm) AS last_updated
  FROM source_rows
  GROUP BY sninc_inc_num
),
latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM source_rows
)
SELECT
  u.sninc_inc_num,
  u.update_count,
  l.sninc_state,
  l.sninc_priority,
  l.sninc_short_desc,
  l.sninc_assignment_grp,
  u.last_updated AS sninc_last_updt_dttm
FROM update_counts u
JOIN latest l
  ON l.sninc_inc_num = u.sninc_inc_num
 AND l.rn = 1
${hasPlatform ? 'WHERE l.sninc_applkp_pltf_nm = $1' : ''}
ORDER BY u.update_count DESC
LIMIT 10;
`
}

export function buildOperationalKpisQuery(days: number | null, hasPlatform: boolean) {
  if (days === null) {
    return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
first_touch AS (
  -- Separate CTE using ALL rows to find first agent response per ticket
  SELECT DISTINCT ON (sninc_inc_num)
    sninc_inc_num,
    sninc_opened_at,
    EXTRACT(EPOCH FROM (sninc_sys_updt_on - sninc_opened_at)) / 3600.0 AS hours_to_first_response
  FROM edoops.service_now_inc
  WHERE sninc_opened_at IS NOT NULL
    AND sninc_sys_updt_on IS NOT NULL
    AND sninc_sys_updt_on > sninc_opened_at
  ORDER BY sninc_inc_num, sninc_sys_updt_on ASC
),
base AS (
  SELECT
    l.sninc_inc_num,
    l.sninc_state,
    l.sninc_opened_at,
    l.sninc_resolved_at,
    l.sninc_closed_at,
    l.sninc_reopened_dttm,
    l.sninc_knowledge,
    l.sninc_applkp_pltf_nm,
    f.hours_to_first_response,
    EXTRACT(EPOCH FROM (l.sninc_resolved_at - l.sninc_opened_at)) / 86400.0 AS days_to_resolve
  FROM latest l
  LEFT JOIN first_touch f
    ON l.sninc_inc_num = f.sninc_inc_num
  WHERE l.rn = 1
${hasPlatform ? '    AND l.sninc_applkp_pltf_nm = $1' : ''}
)
SELECT
  -- KPI 1: Avg Time to Resolve
  ROUND(AVG(days_to_resolve) FILTER (
    WHERE sninc_state IN ('Resolved','Closed','Canceled')
    AND sninc_resolved_at >= sninc_opened_at
  )::NUMERIC, 1) AS avg_resolve_days_current,

  NULL::NUMERIC AS avg_resolve_days_prev,

  -- KPI 2: First Response Time
  ROUND(AVG(hours_to_first_response) FILTER (
    WHERE sninc_opened_at IS NOT NULL
  )::NUMERIC, 1) AS avg_first_response_hrs_current,

  NULL::NUMERIC AS avg_first_response_hrs_prev,

  -- KPI 3: Backlog Trend
  COUNT(*) FILTER (
    WHERE sninc_state NOT IN ('Closed','Resolved', 'Canceled')
  ) AS backlog_now,

  0::BIGINT AS backlog_90d_ago,

  -- KPI 4: Reopen Rate
  ROUND(100.0
    * COUNT(*) FILTER (
      WHERE sninc_reopened_dttm IS NOT NULL
    )
    / NULLIF(COUNT(*) FILTER (
      WHERE sninc_resolved_at IS NOT NULL
      OR sninc_closed_at IS NOT NULL
    ), 0)
  , 1) AS reopen_rate_pct_current,

  NULL::NUMERIC AS reopen_rate_pct_prev,

  -- KPI 5: Knowledge Articles Used
  COUNT(DISTINCT NULLIF(TRIM(sninc_knowledge), '')) FILTER (
    WHERE sninc_opened_at IS NOT NULL
  ) AS unique_articles_current,

  0::BIGINT AS unique_articles_prev

FROM base;
`
  }

  const currentInterval = `${days} days`
  const previousInterval = `${days * 2} days`

  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM edoops.service_now_inc
),
first_touch AS (
  -- Separate CTE using ALL rows to find first agent response per ticket
  SELECT DISTINCT ON (sninc_inc_num)
    sninc_inc_num,
    sninc_opened_at,
    EXTRACT(EPOCH FROM (sninc_sys_updt_on - sninc_opened_at)) / 3600.0 AS hours_to_first_response
  FROM edoops.service_now_inc
  WHERE sninc_opened_at IS NOT NULL
    AND sninc_sys_updt_on IS NOT NULL
    AND sninc_sys_updt_on > sninc_opened_at
  ORDER BY sninc_inc_num, sninc_sys_updt_on ASC
),
base AS (
  SELECT
    l.sninc_inc_num,
    l.sninc_state,
    l.sninc_opened_at,
    l.sninc_resolved_at,
    l.sninc_closed_at,
    l.sninc_reopened_dttm,
    l.sninc_knowledge,
    l.sninc_applkp_pltf_nm,
    f.hours_to_first_response,
    EXTRACT(EPOCH FROM (l.sninc_resolved_at - l.sninc_opened_at)) / 86400.0 AS days_to_resolve
  FROM latest l
  LEFT JOIN first_touch f
    ON l.sninc_inc_num = f.sninc_inc_num
  WHERE l.rn = 1
${hasPlatform ? '    AND l.sninc_applkp_pltf_nm = $1' : ''}
)
SELECT
  -- KPI 1: Avg Time to Resolve
  ROUND(AVG(days_to_resolve) FILTER (
    WHERE sninc_state IN ('Resolved','Closed','Canceled')
    AND sninc_resolved_at >= NOW() - INTERVAL '${currentInterval}'
    AND sninc_resolved_at >= sninc_opened_at
  )::NUMERIC, 1) AS avg_resolve_days_current,

  ROUND(AVG(days_to_resolve) FILTER (
    WHERE sninc_state IN ('Resolved','Closed','Canceled')
    AND sninc_resolved_at >= NOW() - INTERVAL '${previousInterval}'
    AND sninc_resolved_at < NOW() - INTERVAL '${currentInterval}'
    AND sninc_resolved_at >= sninc_opened_at
  )::NUMERIC, 1) AS avg_resolve_days_prev,

  -- KPI 2: First Response Time
  ROUND(AVG(hours_to_first_response) FILTER (
    WHERE sninc_opened_at >= NOW() - INTERVAL '${currentInterval}'
  )::NUMERIC, 1) AS avg_first_response_hrs_current,

  ROUND(AVG(hours_to_first_response) FILTER (
    WHERE sninc_opened_at >= NOW() - INTERVAL '${previousInterval}'
    AND sninc_opened_at < NOW() - INTERVAL '${currentInterval}'
  )::NUMERIC, 1) AS avg_first_response_hrs_prev,

  -- KPI 3: Backlog Trend
  COUNT(*) FILTER (
    WHERE sninc_state NOT IN ('Closed','Resolved')
  ) AS backlog_now,

  COUNT(*) FILTER (
    WHERE sninc_opened_at <= NOW() - INTERVAL '${currentInterval}'
    AND (sninc_resolved_at IS NULL OR sninc_resolved_at > NOW() - INTERVAL '${currentInterval}')
    AND (sninc_closed_at IS NULL OR sninc_closed_at > NOW() - INTERVAL '${currentInterval}')
  ) AS backlog_90d_ago,

  -- KPI 4: Reopen Rate
  ROUND(100.0
    * COUNT(*) FILTER (
      WHERE sninc_reopened_dttm IS NOT NULL
      AND sninc_reopened_dttm >= NOW() - INTERVAL '${currentInterval}'
    )
    / NULLIF(COUNT(*) FILTER (
      WHERE sninc_resolved_at >= NOW() - INTERVAL '${currentInterval}'
      OR sninc_closed_at >= NOW() - INTERVAL '${currentInterval}'
    ), 0)
  , 1) AS reopen_rate_pct_current,

  ROUND(100.0
    * COUNT(*) FILTER (
      WHERE sninc_reopened_dttm IS NOT NULL
      AND sninc_reopened_dttm >= NOW() - INTERVAL '${previousInterval}'
      AND sninc_reopened_dttm < NOW() - INTERVAL '${currentInterval}'
    )
    / NULLIF(COUNT(*) FILTER (
      WHERE (sninc_resolved_at >= NOW() - INTERVAL '${previousInterval}'
        OR sninc_closed_at >= NOW() - INTERVAL '${previousInterval}')
      AND (sninc_resolved_at < NOW() - INTERVAL '${currentInterval}'
        OR sninc_closed_at < NOW() - INTERVAL '${currentInterval}')
    ), 0)
  , 1) AS reopen_rate_pct_prev,

  -- KPI 5: Knowledge Articles Used
  COUNT(DISTINCT NULLIF(TRIM(sninc_knowledge), '')) FILTER (
    WHERE sninc_opened_at >= NOW() - INTERVAL '${currentInterval}'
  ) AS unique_articles_current,

  COUNT(DISTINCT NULLIF(TRIM(sninc_knowledge), '')) FILTER (
    WHERE sninc_opened_at >= NOW() - INTERVAL '${previousInterval}'
    AND sninc_opened_at < NOW() - INTERVAL '${currentInterval}'
  ) AS unique_articles_prev

FROM base;
`
}