export type EspOverviewIntervalDays = number | null

interface EspOverviewQueryOptions {
  platformName?: string | null
  applName?: string | null
  intervalDays: EspOverviewIntervalDays
}

export interface EspOverviewQuerySpec {
  text: string
  values: Array<string | number>
}

function buildScopedConfigCte(platformName?: string | null, applName?: string | null) {
  const values: string[] = []
  const filters: string[] = []

  if (platformName) {
    values.push(platformName)
    filters.push(`cfg.pltf_name = $${values.length}`)
  }

  if (applName) {
    values.push(applName)
    filters.push(`cfg.appl_name = $${values.length}`)
  }

  const filterSql = filters.length ? `\n    AND ${filters.join('\n    AND ')}` : ''

  return {
    values,
    text: `WITH scoped_config AS MATERIALIZED (
  SELECT DISTINCT cfg.appl_name, cfg.jobname, cfg.pltf_name, cfg.job_type, cfg.last_updt_dttm
  FROM edoops.esp_job_config cfg
  WHERE cfg.appl_name IS NOT NULL
    AND cfg.jobname IS NOT NULL${filterSql}
)`,
  }
}

function buildTimestampIntervalClause(values: Array<string | number>, column: string, intervalDays: EspOverviewIntervalDays, prefix = 'AND') {
  if (intervalDays === null) {
    return ''
  }

  values.push(intervalDays)
  return `\n  ${prefix} ${column} >= NOW() - ($${values.length}::text || ' days')::interval`
}

export function buildEspTotalJobsOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)

  return {
    text: `${scope.text}
SELECT COUNT(DISTINCT jobname) AS total_jobs
FROM scoped_config`,
    values: scope.values,
  }
}

export function buildEspTotalJobsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'last_updt_dttm', options.intervalDays, 'WHERE')

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', last_updt_dttm) AS trend_date,
       COUNT(DISTINCT jobname) AS total_jobs
FROM scoped_config${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspIdleJobsOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)

  return {
    text: `${scope.text}
SELECT COUNT(DISTINCT c.jobname) AS idle_jobs
FROM edoops.esp_job_cmnd c
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
WHERE c.noruns IS NOT NULL
  AND TRIM(c.noruns) <> ''`,
    values: scope.values,
  }
}

export function buildEspIdleJobsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `COALESCE(NULLIF(s.end_date::text, '')::timestamp, NULLIF(s.start_date::text, '')::timestamp)`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', ${trendColumn}) AS trend_date,
       COUNT(DISTINCT c.jobname) AS idle_jobs
FROM edoops.esp_job_cmnd c
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
LEFT JOIN edoops.esp_job_stats_recent s
  ON s.appl_name = c.appl_name
 AND s.job_longname = c.jobname
WHERE c.noruns IS NOT NULL
  AND TRIM(c.noruns) <> ''
  AND ${trendColumn} IS NOT NULL${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspFailedJobsOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, `NULLIF(s.end_date::text, '')::timestamp`, options.intervalDays)

  return {
    text: `${scope.text}
SELECT COUNT(DISTINCT s.job_longname) AS failed_jobs
FROM edoops.esp_job_stats_recent s
JOIN scoped_config cfg
  ON cfg.appl_name = s.appl_name
 AND cfg.jobname = s.job_longname
WHERE (
    (s.ccfail IS NOT NULL AND TRIM(s.ccfail) <> '')
    OR (s.comp_code IS NOT NULL AND TRIM(s.comp_code) NOT IN ('0', ''))
  )${intervalClause}`,
    values,
  }
}

export function buildEspFailedJobsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `NULLIF(s.end_date::text, '')::timestamp`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', ${trendColumn}) AS trend_date,
       COUNT(DISTINCT s.job_longname) AS failed_jobs
FROM edoops.esp_job_stats_recent s
JOIN scoped_config cfg
  ON cfg.appl_name = s.appl_name
 AND cfg.jobname = s.job_longname
WHERE ${trendColumn} IS NOT NULL
  AND (
    (s.ccfail IS NOT NULL AND TRIM(s.ccfail) <> '')
    OR (s.comp_code IS NOT NULL AND TRIM(s.comp_code) NOT IN ('0', ''))
  )${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspSlaBreachesOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]

  return {
    text: `${scope.text}
SELECT COUNT(*) AS sla_breaches
FROM edoops.job_sla_missed s
JOIN scoped_config cfg
  ON cfg.pltf_name = s.jslmis_pltf_nm
 AND cfg.appl_name = s.jslmis_appl_lib
 AND cfg.jobname = s.jslmis_job_nm
WHERE s.jslmis_batch_dt = CURRENT_DATE
  AND UPPER(TRIM(s.jslmis_sla_status)) IN ('MISSED', 'LATE', 'BREACH')`,
    values,
  }
}

export function buildEspSlaBreachesTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 's.jslmis_batch_dt', options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', s.jslmis_batch_dt) AS trend_date,
       COUNT(*) AS sla_breaches
FROM edoops.job_sla_missed s
JOIN scoped_config cfg
  ON cfg.pltf_name = s.jslmis_pltf_nm
 AND cfg.appl_name = s.jslmis_appl_lib
 AND cfg.jobname = s.jslmis_job_nm
WHERE UPPER(TRIM(s.jslmis_sla_status)) IN ('MISSED', 'LATE', 'BREACH')${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspActiveAgentsOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]

  return {
    text: `${scope.text}
SELECT COUNT(DISTINCT c.agent) AS active_agents
FROM edoops.esp_job_cmnd c
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
WHERE c.agent IS NOT NULL
  AND TRIM(c.agent) <> ''`,
    values,
  }
}

export function buildEspActiveAgentsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `NULLIF(s.end_date::text, '')::timestamp`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', ${trendColumn}) AS trend_date,
       COUNT(DISTINCT c.agent) AS active_agents
FROM edoops.esp_job_cmnd c
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
LEFT JOIN edoops.esp_job_stats_recent s
  ON s.appl_name = c.appl_name
 AND s.job_longname = c.jobname
WHERE c.agent IS NOT NULL
  AND TRIM(c.agent) <> ''
  AND ${trendColumn} IS NOT NULL${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspJobRunRunsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `NULLIF(s.end_date::text, '')::timestamp`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', ${trendColumn}) AS trend_date,
       COUNT(DISTINCT s.job_longname) AS total_runs
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_stats_recent s
  ON s.appl_name = c.appl_name
 AND s.job_longname = c.jobname
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
WHERE ${trendColumn} IS NOT NULL${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspJobRunFailsTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `NULLIF(s.end_date::text, '')::timestamp`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', ${trendColumn}) AS trend_date,
       COUNT(*) AS total_fails
FROM edoops.esp_job_stats_recent s
JOIN scoped_config cfg
  ON cfg.appl_name = s.appl_name
 AND cfg.jobname = s.job_longname
WHERE ${trendColumn} IS NOT NULL${intervalClause}
  AND (
    (s.ccfail IS NOT NULL AND TRIM(s.ccfail) <> '')
    OR (s.comp_code IS NOT NULL AND TRIM(s.comp_code) NOT IN ('0', ''))
  )
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspJobRunAvgTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const values: Array<string | number> = []
  const intervalClause = buildTimestampIntervalClause(values, 'f.submission_tmst', options.intervalDays, 'WHERE')

  return {
    text: `SELECT DATE_TRUNC('day', f.submission_tmst) AS trend_date,
       AVG(CAST(f.exec_time_mins AS NUMERIC)) AS avg_exec_mins
FROM edoops.esp_forecast f${intervalClause}
GROUP BY 1
ORDER BY 1 ASC`,
    values,
  }
}

export function buildEspJobRunAgentsOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const trendColumn = `NULLIF(s.end_date::text, '')::timestamp`
  const intervalClause = buildTimestampIntervalClause(values, trendColumn, options.intervalDays)

  return {
    text: `${scope.text}
SELECT c.agent,
       COUNT(DISTINCT s.job_longname) AS run_count
FROM edoops.esp_job_cmnd c
JOIN scoped_config cfg
  ON cfg.appl_name = c.appl_name
 AND cfg.jobname = c.jobname
LEFT JOIN edoops.esp_job_stats_recent s
  ON s.appl_name = c.appl_name
 AND s.job_longname = c.jobname
  AND ${trendColumn} IS NOT NULL${intervalClause}
WHERE c.agent IS NOT NULL
  AND TRIM(c.agent) <> ''
GROUP BY 1
ORDER BY run_count DESC
LIMIT 12`,
    values,
  }
}

export function buildEspJobTypeDistributionOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]

  return {
    text: `${scope.text}
SELECT UPPER(TRIM(COALESCE(cfg.job_type, 'UNKNOWN'))) AS job_type,
       COUNT(DISTINCT cfg.jobname) AS job_count,
       ROUND(COUNT(DISTINCT cfg.jobname) * 100.0 / SUM(COUNT(DISTINCT cfg.jobname)) OVER (), 1) AS pct
FROM edoops.esp_job_config cfg
WHERE cfg.job_type IS NOT NULL
GROUP BY 1
ORDER BY job_count DESC`,
    values,
  }
}

function buildSlaStatusScopeClause(options: EspOverviewQueryOptions): { values: Array<string | number>; clause: string } {
  const values: Array<string | number> = []
  const filters: string[] = []

  if (options.platformName) {
    values.push(options.platformName)
    filters.push(`js.jobsla_pltf_nm = $${values.length}`)
  }

  if (options.applName) {
    values.push(options.applName)
    filters.push(`js.jobsla_appl_lib = $${values.length}`)
  }

  if (options.intervalDays !== null) {
    values.push(options.intervalDays)
    filters.push(`js.jobsla_batch_dt >= CURRENT_DATE - ($${values.length}::text || ' days')::interval`)
  }

  return {
    values,
    clause: filters.length ? `WHERE ${filters.join('\n  AND ')}` : '',
  }
}

export function buildEspGroupedJobExecutionStatusQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const values: Array<string | number> = []
  const filters: string[] = []

  if (options.platformName) {
    values.push(options.platformName)
    filters.push(`c.pltf_name = $${values.length}`)
  }

  if (options.applName) {
    values.push(options.applName)
    filters.push(`c.appl_name = $${values.length}`)
  }

  if (options.intervalDays !== null) {
    values.push(options.intervalDays)
    filters.push(`s.end_date >= NOW() - ($${values.length}::text || ' days')::interval`)
  }

  const whereClause = filters.length ? `\nWHERE ${filters.join('\n  AND ')}` : ''

  return {
    text: `SELECT
  s.appl_name AS appl_name,
  s.job_longname AS jobname,
  MAX(s.end_date) AS last_run,
  AVG(CAST(f.exec_time_mins AS NUMERIC)) AS avg_run_mins,
  CASE
    WHEN s.ccfail IS NOT NULL AND TRIM(s.ccfail) <> '' THEN 'FAILED'
    WHEN s.comp_code IS NOT NULL AND TRIM(s.comp_code) NOT IN ('0', '') THEN 'FAILED'
    WHEN s.end_date IS NULL THEN 'NEVER RUN'
    WHEN s.comp_code IS NULL THEN 'UNKNOWN'
    ELSE 'SUCCESS'
  END AS status,
  c.job_type
FROM edoops.esp_job_stats_recent s
JOIN edoops.esp_job_config c
  ON s.appl_name = c.appl_name
 AND s.job_longname = c.jobname
LEFT JOIN edoops.esp_forecast f
  ON s.job_longname = f.jobname${whereClause}
GROUP BY s.appl_name, s.job_longname, s.ccfail, s.comp_code, s.end_date, c.job_type
ORDER BY last_run DESC NULLS LAST
LIMIT 1000`,
    values,
  }
}

export function buildEspGroupedSlaStatusBarsQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildSlaStatusScopeClause(options)

  return {
    text: `SELECT
  COALESCE(js.jobsla_pltf_nm, 'Unknown') AS platform,
  COUNT(*)::int AS total,
  SUM(CASE WHEN UPPER(TRIM(COALESCE(js.jobsla_sla_status, 'UNKNOWN'))) NOT IN ('MISSED', 'LATE', 'BREACH') THEN 1 ELSE 0 END)::int AS met_count,
  ROUND(
    SUM(CASE WHEN UPPER(TRIM(COALESCE(js.jobsla_sla_status, 'UNKNOWN'))) NOT IN ('MISSED', 'LATE', 'BREACH') THEN 1 ELSE 0 END)
    * 100.0 / NULLIF(COUNT(*), 0),
    1
  ) AS pct_met
FROM edoops.job_sla_status js
${scope.clause}
GROUP BY COALESCE(js.jobsla_pltf_nm, 'Unknown')
ORDER BY pct_met DESC NULLS LAST, platform`,
    values: scope.values,
  }
}

export function buildEspGroupedSlaRecentEventsQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildSlaStatusScopeClause(options)

  return {
    text: `SELECT
  js.jobsla_job_nm AS job_name,
  js.jobsla_appl_lib AS applib,
  js.jobsla_sla_time AS sla_time,
  js.jobsla_job_end_time AS end_time,
  js.jobsla_time_diff AS time_diff,
  js.jobsla_sla_status AS status
FROM edoops.job_sla_status js
${scope.clause}
ORDER BY
  CASE UPPER(TRIM(COALESCE(js.jobsla_sla_status, 'UNKNOWN')))
    WHEN 'MISSED' THEN 1
    WHEN 'BREACH' THEN 2
    WHEN 'LATE' THEN 3
    ELSE 4
  END,
  js.jobsla_job_end_time DESC NULLS LAST
LIMIT 12`,
    values: scope.values,
  }
}

export function buildEspGroupedJobDependenciesQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)

  return {
    text: `${scope.text}
SELECT
  d.appl_name,
  d.jobname,
  d.release,
  NULL::text AS external_ind,
  p.jobname AS predecessor_job,
  p.appl_name AS predecessor_applib
FROM edoops.esp_job_dpndnt d
JOIN scoped_config cfg
  ON cfg.appl_name = d.appl_name
 AND cfg.jobname = d.jobname
LEFT JOIN edoops.esp_job_dpndnt p
  ON p.appl_name = d.appl_name
 AND p.release = d.jobname
ORDER BY d.appl_name, d.jobname
LIMIT 200`,
    values: scope.values,
  }
}

export function buildEspGroupedExecutionForecastMetricsQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values: Array<string | number> = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'f.submission_tmst', options.intervalDays, 'WHERE')

  return {
    text: `${scope.text}
SELECT
  ROUND(AVG(CAST(f.exec_time_mins AS NUMERIC)), 1) AS avg_exec_mins,
  ROUND(AVG(CAST(f.cpu_time_mins AS NUMERIC)), 1) AS avg_cpu_mins,
  COALESCE(SUM(CAST(f.samples_used AS INTEGER)), 0) AS total_samples,
  COALESCE(SUM(CAST(f.print_lines AS INTEGER)), 0) AS total_print_lines
FROM edoops.esp_forecast f
JOIN scoped_config cfg
  ON cfg.appl_name = f.appl_name
 AND cfg.jobname = f.jobname${intervalClause}`,
    values,
  }
}

export function buildEspGroupedForecastExecByApplibQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values: Array<string | number> = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'f.submission_tmst', options.intervalDays)

  return {
    text: `${scope.text}
SELECT
  f.appl_name,
  ROUND(AVG(CAST(f.exec_time_mins AS NUMERIC)), 1) AS avg_exec_mins,
  ROUND(AVG(CAST(f.cpu_time_mins AS NUMERIC)), 1) AS avg_cpu_mins,
  COUNT(*)::int AS job_count
FROM edoops.esp_forecast f
JOIN scoped_config cfg
  ON cfg.appl_name = f.appl_name
 AND cfg.jobname = f.jobname
WHERE f.appl_name IS NOT NULL${intervalClause}
GROUP BY f.appl_name
ORDER BY avg_exec_mins DESC NULLS LAST, f.appl_name
LIMIT 8`,
    values,
  }
}

export function buildEspGroupedCriticalJobsPillsQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values: Array<string | number> = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'cfg2.last_updt_dttm', options.intervalDays)

  return {
    text: `${scope.text}
SELECT
  cfg2.appl_name,
  cfg2.critical_ind,
  COUNT(DISTINCT cfg2.jobname) AS critical_job_count
FROM edoops.esp_job_config cfg2
JOIN scoped_config cfg
  ON cfg.appl_name = cfg2.appl_name
 AND cfg.jobname = cfg2.jobname
WHERE UPPER(TRIM(COALESCE(cfg2.critical_ind, ''))) = 'Y'${intervalClause}
GROUP BY cfg2.appl_name, cfg2.critical_ind
ORDER BY critical_job_count DESC, cfg2.appl_name
LIMIT 12`,
    values,
  }
}

export function buildEspGroupedRunFrequencyBarsQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values: Array<string | number> = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'cfg2.last_updt_dttm', options.intervalDays)

  return {
    text: `${scope.text}
SELECT
  COALESCE(UPPER(TRIM(cfg2.app_freq)), 'UNKNOWN') AS frequency,
  COUNT(DISTINCT cfg2.jobname) AS job_count
FROM edoops.esp_job_config cfg2
JOIN scoped_config cfg
  ON cfg.appl_name = cfg2.appl_name
 AND cfg.jobname = cfg2.jobname
WHERE 1=1${intervalClause}
GROUP BY 1
ORDER BY job_count DESC, frequency`,
    values,
  }
}

export function buildEspGroupedSlaConfigByLobQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values: Array<string | number> = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'cfg2.last_updt_dttm', options.intervalDays)

  return {
    text: `${scope.text}
SELECT
  cfg2.appl_name,
  MAX(cfg2.sla_time) AS sla_time,
  MAX(cfg2.lob) AS lob,
  MAX(cfg2.sub_lob) AS sub_lob,
  MAX(cfg2.holiday_run_ind) AS holiday_run_ind,
  MAX(cfg2.critical_ind) AS critical_ind,
  COUNT(DISTINCT cfg2.jobname) AS job_count,
  MAX(cfg2.last_updt_dttm) AS last_updated
FROM edoops.esp_job_config cfg2
JOIN scoped_config cfg
  ON cfg.appl_name = cfg2.appl_name
 AND cfg.jobname = cfg2.jobname
WHERE 1=1${intervalClause}
GROUP BY cfg2.appl_name
ORDER BY cfg2.appl_name
LIMIT 50`,
    values,
  }
}