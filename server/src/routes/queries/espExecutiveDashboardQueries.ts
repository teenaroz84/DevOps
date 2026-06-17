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
  SELECT DISTINCT cfg.appl_name, cfg.jobname, cfg.pltf_name, cfg.last_updt_dttm
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
FROM edoops.job_sla_status jss
JOIN scoped_config cfg
  ON cfg.appl_name = jss.jobsla_appl_nm
 AND cfg.jobname = jss.jobsla_job_nm
WHERE jss.jobsla_batch_dt = CURRENT_DATE
  AND UPPER(TRIM(jss.jobsla_sla_status)) IN ('MISSED', 'LATE', 'BREACH')`,
    values,
  }
}

export function buildEspSlaBreachesTrendOverviewQuery(options: EspOverviewQueryOptions): EspOverviewQuerySpec {
  const scope = buildScopedConfigCte(options.platformName, options.applName)
  const values = [...scope.values]
  const intervalClause = buildTimestampIntervalClause(values, 'jss.jobsla_batch_dt', options.intervalDays)

  return {
    text: `${scope.text}
SELECT DATE_TRUNC('day', jss.jobsla_batch_dt) AS trend_date,
       COUNT(*) AS sla_breaches
FROM edoops.job_sla_status jss
JOIN scoped_config cfg
  ON cfg.appl_name = jss.jobsla_appl_nm
 AND cfg.jobname = jss.jobsla_job_nm
WHERE UPPER(TRIM(jss.jobsla_sla_status)) IN ('MISSED', 'LATE', 'BREACH')${intervalClause}
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
  const trendColumn = `NULLIF(s.start_date::text, '')::timestamp`
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
       SUM(CAST(c.runs AS INTEGER)) AS total_runs
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
SELECT UPPER(TRIM(COALESCE(cfg.jobtype, 'UNKNOWN'))) AS job_type,
       COUNT(DISTINCT cfg.jobname) AS job_count,
       ROUND(COUNT(DISTINCT cfg.jobname) * 100.0 / SUM(COUNT(DISTINCT cfg.jobname)) OVER (), 1) AS pct
FROM scoped_config cfg
WHERE cfg.jobtype IS NOT NULL
GROUP BY 1
ORDER BY job_count DESC`,
    values,
  }
}