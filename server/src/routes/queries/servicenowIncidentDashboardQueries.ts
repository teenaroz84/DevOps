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
  COUNT(*) FILTER (WHERE sninc_state = 'Open'
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_current,
  COUNT(*) FILTER (WHERE sninc_state = 'Closed'
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS closed_current,
  COUNT(*) FILTER (WHERE sninc_reopened_dttm IS NOT NULL
                   AND sninc_opened_at >= NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS reopened_current,
  COUNT(*) FILTER (WHERE sninc_state = 'New'
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS new_prev,
  COUNT(*) FILTER (WHERE sninc_state = 'Open'
                   AND sninc_opened_at >= NOW() - INTERVAL '${PREVIOUS_INTERVAL_TOKEN}'
                   AND sninc_opened_at < NOW() - INTERVAL '${CURRENT_INTERVAL_TOKEN}') AS open_prev,
  COUNT(*) FILTER (WHERE sninc_state = 'Closed'
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
  COUNT(*) FILTER (WHERE sninc_state = 'Open') AS open_current,
  COUNT(*) FILTER (WHERE sninc_state = 'Closed') AS closed_current,
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