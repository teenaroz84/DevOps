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