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
  COUNT(*) FILTER (WHERE sninc_state in ('in Progress', 'On Hold')
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_current,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS closed_current,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS reopened_current,
  COUNT(*) FILTER (WHERE sninc_state = 'New'
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS new_prev,
  COUNT(*) FILTER (WHERE sninc_state in ('in Progress', 'On Hold')
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_prev,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS closed_prev,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS reopened_prev
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
  COUNT(*) FILTER (WHERE sninc_state in ('in Progress', 'On Hold')) AS open_current,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')) AS closed_current,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL) AS reopened_current,
  0 AS new_prev,
  0 AS open_prev,
  0 AS closed_prev,
  0 AS reopened_prev
FROM latest
WHERE rn = 1
${buildPlatformFilter(hasPlatform, 1)};
`
  }

  return applyQueryTokens(INCIDENT_LIFECYCLE_QUERY_TEMPLATE, days, hasPlatform)
}

export function buildIncidentTrendDailyLineQuery() {
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
  AND sninc_opened_at >= NOW() - INTERVAL '90 days'
GROUP BY sninc_opened_at::DATE
ORDER BY incident_date ASC;
`
}

export function buildIncidentStateOverTimeDailyStackedBarQuery() {
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
  COUNT(*) FILTER (WHERE sninc_state in ('in Progress', 'On Hold')) AS open_count,
  COUNT(*) FILTER (WHERE sninc_state in ('Closed', 'Resolved', 'Canceled')) AS closed_count,
  COUNT(*)                                                          AS total_count
FROM latest
WHERE rn = 1
  AND sninc_opened_at >= NOW() - INTERVAL '90 days'
GROUP BY sninc_opened_at::DATE
ORDER BY incident_date ASC;
`
}

export function buildIncidentsByAssignmentGroupTop10Query() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
),
grouped AS (
  SELECT
    sninc_assignment_grp AS assignment_group,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
    AND sninc_opened_at >= NOW() - INTERVAL '90 days'
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

export function buildIncidentsByPlatformApplicationTop10Query() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
),
grouped AS (
  SELECT
    COALESCE(sninc_mon_app_name, sninc_appl, 'Unknown') AS platform_app,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')) AS open_count
  FROM latest
  WHERE rn = 1
    AND sninc_opened_at >= NOW() - INTERVAL '90 days'
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

export function buildIncidentsByPriorityDonutQuery() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
),
grouped AS (
  SELECT
    sninc_priority AS priority,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
    AND sninc_opened_at >= NOW() - INTERVAL '90 days'
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

export function buildSlaPerformancePanelGaugeQuery() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
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
  AND sninc_state NOT IN ('Closed', 'Resolved', 'Canceled')
  AND sninc_expiry_dttm IS NOT NULL;
`
}

export function buildSlaBreachRiskAlertBannerTicketsQuery() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
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
  AND sninc_state NOT IN ('Closed', 'Resolved')
  AND sninc_expiry_dttm BETWEEN NOW() AND NOW() + INTERVAL '4 hours'
ORDER BY sninc_expiry_dttm ASC
LIMIT 10;
`
}

export function buildAgingOfOpenIncidentsHorizontalBarQuery() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
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
    AND sninc_state NOT IN ('Closed', 'Resolved')
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

export function buildTopIncidentCategoriesQuery() {
  return `
WITH latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
),
grouped AS (
  SELECT
    sninc_category_cd AS category,
    COUNT(*) AS incident_count
  FROM latest
  WHERE rn = 1
    AND sninc_state NOT IN ('Closed', 'Resolved')
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

export function buildTopIncidentsByUpdateCountQuery() {
  return `
WITH update_counts AS (
  SELECT
    sninc_inc_num,
    COUNT(*) AS update_count,
    MAX(sninc_last_updt_dttm) AS last_updated
  FROM ebd.service_now_inc
  GROUP BY sninc_inc_num
),
latest AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY sninc_inc_num
           ORDER BY sninc_last_updt_dttm DESC NULLS LAST
         ) AS rn
  FROM ebd.service_now_inc
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
ORDER BY u.update_count DESC
LIMIT 10;
`
}