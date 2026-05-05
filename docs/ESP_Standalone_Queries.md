# ESP Standalone Queries

Schema: `edoops`

Main tables:
- `edoops.esp_job_config`
- `edoops.esp_job_cmnd`
- `edoops.esp_job_stats_recent`
- `edoops.esp_job_dpndt`
- `edoops.job_sla_missed`

Replace these placeholders before running:
- `{{platform_name}}`: `pltf_name` from `esp_job_config`
- `{{platform_id}}`: same value as `{{platform_name}}` in the current code
- `{{appl_name}}`: application library name
- `{{jobname}}`: ESP job name
- `{{days}}`: lookback window, for example `2`
- `{{limit}}`: page size
- `{{offset}}`: page offset
- `{{search_text}}`: text fragment for `ILIKE` filtering

Notes:
- Most platform routes resolve membership through `edoops.esp_job_config`.
- Application summary routes are composites. The standalone blocks below are the SQL fragments that back the individual widgets.

## Platform Summary

Used by: `/api/esp/platform-summary`

```sql
WITH config_jobs AS MATERIALIZED (
  SELECT cfg.pltf_name, cfg.appl_name, cfg.jobname
  FROM edoops.esp_job_config cfg
  WHERE cfg.pltf_name IS NOT NULL
    AND cfg.appl_name IS NOT NULL
    AND cfg.jobname IS NOT NULL
),
per_job AS (
  SELECT cfg.pltf_name, c.jobname, MAX(c.last_run_date) AS last_run_date
  FROM config_jobs cfg
  JOIN edoops.esp_job_cmnd c ON c.appl_name = cfg.appl_name AND c.jobname = cfg.jobname
  GROUP BY cfg.pltf_name, c.jobname
),
counts AS (
  SELECT
    pltf_name,
    COUNT(*)::int AS total,
    COUNT(CASE WHEN last_run_date IS NOT NULL
                 AND last_run_date::timestamp < NOW() - INTERVAL '2 days'
               THEN 1 END)::int AS idle,
    COUNT(CASE WHEN jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%'
               THEN 1 END)::int AS special
  FROM per_job
  GROUP BY pltf_name
),
platforms AS (
  SELECT DISTINCT pltf_name AS platform_id, pltf_name AS platform_name
  FROM edoops.esp_job_config
  WHERE pltf_name IS NOT NULL
)
SELECT p.platform_id, p.platform_name,
       COALESCE(c.total, 0) AS total,
       COALESCE(c.idle, 0) AS idle,
       COALESCE(c.special, 0) AS special
FROM platforms p
LEFT JOIN counts c ON c.pltf_name = p.platform_name
ORDER BY p.platform_name;
```

## Platform Applications

Used by: `/api/esp/platform-applications/:platformId`

```sql
SELECT DISTINCT appl_name
FROM edoops.esp_job_config
WHERE pltf_name = '{{platform_id}}'
  AND appl_name ILIKE '%{{search_text}}%'
ORDER BY appl_name
LIMIT {{limit}} OFFSET {{offset}};
```

## Platform Job Count

Used inside: `/api/esp/platform-detail/:platformId`

```sql
SELECT COUNT(DISTINCT jobname)::int AS job_count
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
);
```

## Platform Idle Job Count

```sql
SELECT COUNT(*)::int AS idle_count
FROM (
  SELECT jobname
  FROM edoops.esp_job_cmnd
  WHERE (appl_name, jobname) IN (
    SELECT DISTINCT appl_name, jobname
    FROM edoops.esp_job_config
    WHERE pltf_name = '{{platform_name}}'
      AND appl_name IS NOT NULL
      AND jobname IS NOT NULL
  )
  GROUP BY jobname
  HAVING MAX(last_run_date) IS NOT NULL
     AND MAX(last_run_date)::timestamp < NOW() - INTERVAL '2 days'
) s;
```

## Platform Special Job Count

```sql
SELECT COUNT(DISTINCT jobname)::int AS special_count
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
  AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%');
```

## Platform Agent Breakdown

```sql
SELECT COALESCE(agent, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY agent
ORDER BY count DESC;
```

## Platform Job Type Breakdown

```sql
SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY jobtype
ORDER BY count DESC;
```

## Platform User Job Breakdown

```sql
SELECT COALESCE(user_job, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY user_job
ORDER BY count DESC;
```

## Platform Job List

Used by: `/api/esp/platform-job-list/:platformId`

```sql
SELECT DISTINCT ON (c.jobname)
  c.jobname,
  c.appl_name,
  c.jobtype AS job_type,
  c.last_run_date
FROM edoops.esp_job_cmnd c
JOIN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
) cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
ORDER BY c.jobname, c.last_run_date DESC NULLS LAST
LIMIT {{limit}} OFFSET {{offset}};
```

## Platform Run Trend

Used by: `/api/esp/platform-run-trend/:platformId`

```sql
WITH base AS (
  SELECT s.end_date, s.end_time::time AS et, s.job_longname AS jobname, s.ccfail
  FROM edoops.esp_job_stats_recent s
  JOIN (
    SELECT DISTINCT appl_name, jobname
    FROM edoops.esp_job_config
    WHERE pltf_name = '{{platform_name}}'
      AND appl_name IS NOT NULL
      AND jobname IS NOT NULL
  ) cfg ON cfg.appl_name = s.appl_name AND cfg.jobname = s.job_longname
  WHERE s.end_date >= CURRENT_DATE - INTERVAL '{{days}} days'
)
SELECT end_date AS day,
       EXTRACT(HOUR FROM et)::int AS hour,
       COUNT(jobname)::int AS job_count,
       SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

## Platform Metadata

Used by: `/api/esp/platform-metadata/:platformId`

```sql
SELECT jobname, command, argument, agent, jobtype AS job_type,
       esp_command AS comp_code, runs, user_job, appl_name
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
ORDER BY jobname;
```

## Platform Job Run Table

Used by: `/api/esp/platform-job-run-table/:platformId`

```sql
SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
       es.start_date, es.start_time, es.end_date, es.end_time,
       es.exec_qtime, es.ccfail, es.comp_code
FROM edoops.esp_job_cmnd ec
JOIN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '{{platform_name}}'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
) cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
JOIN edoops.esp_job_stats_recent es
  ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
WHERE es.end_date >= CURRENT_DATE - INTERVAL '{{days}} days'
ORDER BY es.end_date DESC, es.end_time DESC;
```

## SLA Violations

Used by: `/api/esp/sla-violations`

```sql
SELECT *
FROM edoops.job_sla_missed
WHERE jslmis_batch_dt >= CURRENT_DATE - INTERVAL '{{days}} days'
  AND jslmis_pltf_nm = '{{platform_name}}'
ORDER BY jslmis_batch_dt DESC, jslmis_last_updt_dttm DESC
LIMIT 250;
```

## Application List

Used by: `/api/esp/applications`

```sql
SELECT DISTINCT ON (cfg.appl_name)
  cfg.appl_name,
  cfg.pltf_name AS platform_id,
  cfg.pltf_name AS platform_name
FROM edoops.esp_job_config cfg
WHERE cfg.appl_name IS NOT NULL
ORDER BY cfg.appl_name, cfg.pltf_name;
```

## Application Summary Job Count

Used inside: `/api/esp/summary/:appl_name`

```sql
SELECT COUNT(DISTINCT c.jobname) AS cnt
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '{{appl_name}}'
  AND cfg.pltf_name = '{{platform_name}}';
```

## Application Idle Job Count

```sql
SELECT COUNT(DISTINCT c.jobname) AS cnt
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '{{appl_name}}'
  AND cfg.pltf_name = '{{platform_name}}'
  AND c.last_run_date IS NOT NULL
  AND c.last_run_date::timestamp < NOW() - INTERVAL '2 days';
```

## Application Special Job Count

```sql
SELECT COUNT(DISTINCT c.jobname) AS cnt
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '{{appl_name}}'
  AND cfg.pltf_name = '{{platform_name}}'
  AND (c.jobname LIKE '%JSDELAY%' OR c.jobname LIKE '%RETRIG%');
```

## Application Metadata

Used by: `/api/esp/metadata/:appl_name`

```sql
SELECT c.jobname,
       c.command,
       c.argument,
       c.agent,
       c.jobtype AS job_type,
       c.esp_command AS comp_code,
       c.runs,
       c.user_job
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '{{appl_name}}'
ORDER BY c.jobname;
```

## Application Job Run Table

Used by: `/api/esp/job-run-table/:appl_name`

```sql
SELECT ec.appl_name,
       es.job_longname,
       ec.command,
       ec.argument,
       ec.runs,
       es.start_date,
       es.start_time,
       es.end_date,
       es.end_time,
       es.exec_qtime,
       es.ccfail,
       es.comp_code
FROM edoops.esp_job_cmnd ec
JOIN edoops.esp_job_stats_recent es
   ON ec.appl_name = es.appl_name
  AND ec.jobname   = es.job_longname
JOIN edoops.esp_job_config cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
WHERE ec.appl_name = '{{appl_name}}'
  AND es.end_date >= CURRENT_DATE - INTERVAL '{{days}} days'
ORDER BY es.end_date DESC, es.end_time DESC;
```

## Application Job Run Trend

Used by: `/api/esp/job-run-trend/:appl_name`

```sql
WITH base AS (
  SELECT end_date,
         end_time::time AS et,
         jobname,
         ccfail
  FROM edoops.esp_job_stats_recent
  WHERE appl_name = '{{appl_name}}'
    AND end_date >= CURRENT_DATE - INTERVAL '{{days}} days'
)
SELECT end_date AS day,
       EXTRACT(HOUR FROM et)::int AS hour,
       COUNT(jobname)::int AS job_count,
       SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

## Run Trend by Job

Used by: `/api/esp/run-trend-by-job/:jobname`

```sql
WITH base AS (
  SELECT end_date,
         end_time::time AS et,
         job_longname,
         ccfail
  FROM edoops.esp_job_stats_recent
  WHERE job_longname = '{{jobname}}'
    AND end_date >= CURRENT_DATE - INTERVAL '{{days}} days'
)
SELECT end_date AS day,
       EXTRACT(HOUR FROM et)::int AS hour,
       COUNT(job_longname)::int AS job_count,
       SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```
