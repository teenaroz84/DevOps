# ESP Dashboard — Standalone SQL Queries

All queries run against **PostgreSQL** (`edoops` schema). Replace `$platform`, `$appl_name`, `$jobname`, and `$N_days` with actual values.

---

## Platform-Level Widgets

### Platform List (Summary Cards)
```sql
WITH config_jobs AS MATERIALIZED (
  SELECT cfg.pltf_name, cfg.appl_name, cfg.jobname
  FROM edoops.esp_job_config cfg
  WHERE cfg.pltf_name IS NOT NULL AND cfg.appl_name IS NOT NULL AND cfg.jobname IS NOT NULL
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
                 AND last_run_date::timestamp < NOW() - INTERVAL '2 days' THEN 1 END)::int AS idle,
    COUNT(CASE WHEN jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%' THEN 1 END)::int AS special
  FROM per_job
  GROUP BY pltf_name
),
platforms AS (
  SELECT DISTINCT pltf_name AS platform_id, pltf_name AS platform_name
  FROM edoops.esp_job_config WHERE pltf_name IS NOT NULL
)
SELECT p.platform_id, p.platform_name,
       COALESCE(c.total, 0)   AS total_jobs,
       COALESCE(c.idle, 0)    AS idle_jobs,
       COALESCE(c.special, 0) AS special_jobs
FROM platforms p
LEFT JOIN counts c ON c.pltf_name = p.platform_name
ORDER BY p.platform_name;
```

---

### Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS job_count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
);
```

---

### Idle Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS idle_count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
AND c.last_run_date IS NOT NULL
AND c.last_run_date::timestamp < NOW() - INTERVAL '2 days';
```

---

### Special Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS special_count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
AND (c.jobname LIKE '%JSDELAY%' OR c.jobname LIKE '%RETRIG%');
```

---

### Agent Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.agent, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY c.agent
ORDER BY count DESC;
```

---

### Job Type Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.jobtype, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY c.jobtype
ORDER BY count DESC;
```

---

### User Jobs Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.user_job, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
WHERE (c.appl_name, c.jobname) IN (
  SELECT DISTINCT appl_name, jobname
  FROM edoops.esp_job_config
  WHERE pltf_name = '$platform'
    AND appl_name IS NOT NULL
    AND jobname IS NOT NULL
)
GROUP BY c.user_job
ORDER BY count DESC;
```

---

### Successor Dependencies (Dependency Table)
```sql
SELECT DISTINCT d.jobname, d.appl_name, d.release AS successor_job
FROM edoops.esp_job_dpndt d
JOIN edoops.esp_job_config cfgSrc  ON cfgSrc.appl_name  = d.appl_name AND cfgSrc.jobname  = d.jobname
JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
WHERE d.appl_name IN (
  SELECT DISTINCT appl_name FROM edoops.esp_job_config WHERE pltf_name = '$platform'
)
ORDER BY d.jobname
LIMIT 200;
```

---

### Predecessor Dependencies (Dependency Table)
```sql
SELECT DISTINCT d.jobname, d.appl_name, d.release AS predecessor_job
FROM edoops.esp_job_dpndt d
JOIN edoops.esp_job_config cfgSrc  ON cfgSrc.appl_name  = d.appl_name AND cfgSrc.jobname  = d.jobname
JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
WHERE d.appl_name IN (
  SELECT DISTINCT appl_name FROM edoops.esp_job_config WHERE pltf_name = '$platform'
)
ORDER BY d.jobname
LIMIT 200;
```

---

### Platform Job List (Paginated Table)
```sql
SELECT DISTINCT ON (c.jobname)
  c.jobname, c.appl_name, c.jobtype AS job_type, c.last_run_date
FROM edoops.esp_job_cmnd c
JOIN (
  SELECT DISTINCT appl_name, jobname FROM edoops.esp_job_config
  WHERE pltf_name = '$platform' AND appl_name IS NOT NULL AND jobname IS NOT NULL
) cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
-- AND c.appl_name = '$appl_name'   -- optional: filter to one applib
ORDER BY c.jobname, c.last_run_date DESC NULLS LAST
LIMIT 2000 OFFSET 0;
```

---

### Platform Run Trend (Hourly Chart)
```sql
WITH base AS (
  SELECT s.end_date, s.end_time::time AS et, s.job_longname AS jobname, s.ccfail
  FROM edoops.esp_job_stats_recent s
  JOIN (
    SELECT DISTINCT appl_name, jobname FROM edoops.esp_job_config
    WHERE pltf_name = '$platform' AND appl_name IS NOT NULL AND jobname IS NOT NULL
  ) cfg ON cfg.appl_name = s.appl_name AND cfg.jobname = s.job_longname
  WHERE s.end_date >= CURRENT_DATE - INTERVAL '$N_days days'
)
SELECT
  end_date AS day,
  EXTRACT(HOUR FROM et)::int AS hour,
  COUNT(jobname)::int AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

---

### Platform Job Run History Table
```sql
SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
       es.start_date, es.start_time, es.end_date, es.end_time,
       es.exec_qtime, es.ccfail, es.comp_code
FROM edoops.esp_job_cmnd ec
JOIN (
  SELECT DISTINCT appl_name, jobname FROM edoops.esp_job_config
  WHERE pltf_name = '$platform' AND appl_name IS NOT NULL AND jobname IS NOT NULL
) cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
JOIN edoops.esp_job_stats_recent es
  ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
WHERE es.end_date >= CURRENT_DATE - INTERVAL '$N_days days'
ORDER BY es.end_date DESC, es.end_time DESC;
```

---

### Platform Metadata Table
```sql
SELECT jobname, command, argument, agent, jobtype AS job_type,
       esp_command AS comp_code, runs, user_job, appl_name
FROM edoops.esp_job_cmnd
WHERE (appl_name, jobname) IN (
  SELECT DISTINCT appl_name, jobname FROM edoops.esp_job_config
  WHERE pltf_name = '$platform' AND appl_name IS NOT NULL AND jobname IS NOT NULL
)
ORDER BY jobname;
```

---

## Application-Level Widgets

All application-level queries accept an optional platform filter (`AND cfg.pltf_name = '$platform'`) to scope counts correctly when an applib belongs to a specific platform. Shown as a commented line below.

### Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS job_count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform';
```

---

### Idle Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS idle_count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
  AND c.last_run_date IS NOT NULL
  AND c.last_run_date::timestamp < NOW() - INTERVAL '2 days';
```

---

### Special Job Count (KPI)
```sql
SELECT COUNT(DISTINCT c.jobname)::int AS special_count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
  AND (c.jobname LIKE '%JSDELAY%' OR c.jobname LIKE '%RETRIG%');
```

---

### Agent Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.agent, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
GROUP BY c.agent
ORDER BY count DESC;
```

---

### Job Type Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.jobtype, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
GROUP BY c.jobtype
ORDER BY count DESC;
```

---

### Completion Codes (Donut / Bar Chart)
```sql
SELECT COALESCE(CAST(c.cmpl_cd AS TEXT), 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
GROUP BY c.cmpl_cd
ORDER BY count DESC;
```

---

### User Jobs Breakdown (Donut / Bar Chart)
```sql
SELECT COALESCE(c.user_job, 'Null') AS name, COUNT(*)::int AS count
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
GROUP BY c.user_job
ORDER BY count DESC;
```

---

### Job List (Table)
```sql
SELECT DISTINCT ON (c.jobname)
  c.jobname, c.jobtype AS job_type, c.last_run_date
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
ORDER BY c.jobname, c.last_run_date DESC NULLS LAST;
```

---

### Job Run Trend (Hourly Chart)
```sql
WITH base AS (
  SELECT end_date, end_time::time AS et, job_longname AS jobname, ccfail
  FROM edoops.esp_job_stats_recent
  WHERE appl_name = '$appl_name'
    AND end_date >= CURRENT_DATE - INTERVAL '$N_days days'
)
SELECT
  end_date AS day,
  EXTRACT(HOUR FROM et)::int AS hour,
  COUNT(jobname)::int AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

---

### Job Run History Table
```sql
SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
       es.start_date, es.start_time, es.end_date, es.end_time,
       es.exec_qtime, es.ccfail, es.comp_code
FROM edoops.esp_job_cmnd ec
JOIN edoops.esp_job_stats_recent es
  ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
JOIN edoops.esp_job_config cfg ON cfg.appl_name = ec.appl_name AND cfg.jobname = ec.jobname
WHERE ec.appl_name = '$appl_name'
  AND es.end_date >= CURRENT_DATE - INTERVAL '$N_days days'
ORDER BY es.end_date DESC, es.end_time DESC;
```

---

### Metadata Table
```sql
SELECT c.jobname, c.command, c.argument, c.agent,
       c.jobtype AS job_type, c.esp_command AS comp_code, c.runs, c.user_job
FROM edoops.esp_job_cmnd c
JOIN edoops.esp_job_config cfg ON cfg.appl_name = c.appl_name AND cfg.jobname = c.jobname
WHERE c.appl_name = '$appl_name'
-- AND cfg.pltf_name = '$platform'
ORDER BY c.jobname;
```

---

### Successor Jobs (Dependency Table)
```sql
SELECT DISTINCT d.jobname, d.appl_name, d.release AS successor_job
FROM edoops.esp_job_dpndt d
JOIN edoops.esp_job_config cfgSrc  ON cfgSrc.appl_name  = d.appl_name AND cfgSrc.jobname  = d.jobname
JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
WHERE d.appl_name = '$appl_name'
ORDER BY d.jobname;
```

---

### Predecessor Jobs (Dependency Table)
```sql
SELECT DISTINCT d.jobname, d.appl_name, d.release AS predecessor_job
FROM edoops.esp_job_dpndt d
JOIN edoops.esp_job_config cfgSrc  ON cfgSrc.appl_name  = d.appl_name AND cfgSrc.jobname  = d.jobname
JOIN edoops.esp_job_config cfgDest ON cfgDest.appl_name = d.appl_name AND cfgDest.jobname = d.release
WHERE d.release = '$appl_name'
ORDER BY d.jobname;
```

---

### Run Trend by Single Job
```sql
WITH base AS (
  SELECT end_date, end_time::time AS et, job_longname, ccfail
  FROM edoops.esp_job_stats_recent
  WHERE job_longname = '$jobname'
    AND end_date >= CURRENT_DATE - INTERVAL '$N_days days'
)
SELECT
  end_date AS day,
  EXTRACT(HOUR FROM et)::int AS hour,
  COUNT(job_longname)::int AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

---

### Run Trend by Dimension (agent / job_type / user_job)
Replace `<col>` with `agent`, `jobtype`, or `user_job`, and `<value>` with the selected value.
```sql
WITH base AS (
  SELECT es.end_date, es.end_time::time AS et, es.job_longname, es.ccfail
  FROM edoops.esp_job_stats_recent es
  JOIN edoops.esp_job_cmnd ec ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
  WHERE ec.<col> = '<value>'                      -- or: ec.<col> IS NULL for 'Null'
    AND es.end_date >= CURRENT_DATE - INTERVAL '$N_days days'
)
SELECT
  end_date AS day,
  EXTRACT(HOUR FROM et)::int AS hour,
  COUNT(job_longname)::int AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

---

## SLA Widgets

### KPI Cards
```sql
SELECT
  COUNT(*) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int            AS total_sla_missed_today,
  COUNT(*) FILTER (WHERE jslmis_job_end_time IS NULL)::int               AS open_missed_jobs,
  COUNT(DISTINCT jslmis_application_desc)
    FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int                   AS apps_impacted,
  COUNT(DISTINCT jslmis_bus_unit)
    FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int                   AS bus_units_impacted,
  ROUND(AVG(CASE WHEN jslmis_job_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
  END)::numeric, 2)                                                       AS avg_delay_minutes,
  ROUND(MAX(CASE WHEN jslmis_job_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
  END)::numeric, 2)                                                       AS longest_delay_minutes
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform';
```

---

### Daily SLA Misses (14-day Trend Chart)
```sql
SELECT jslmis_batch_dt AS day, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY jslmis_batch_dt
ORDER BY jslmis_batch_dt;
```

---

### Hourly SLA Misses (7-day Heatmap)
```sql
SELECT EXTRACT(HOUR FROM jslmis_job_start_time)::int AS hour, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_job_start_time IS NOT NULL
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM jslmis_job_start_time)
ORDER BY hour;
```

---

### SLA Misses by Platform (7-day Bar Chart)
```sql
SELECT COALESCE(jslmis_pltf_nm, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_pltf_nm, 'Unknown')
ORDER BY sla_misses DESC;
```

---

### SLA Misses by SLA Type (7-day Bar Chart)
```sql
SELECT COALESCE(jslmis_sla_typ, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_sla_typ, 'Unknown')
ORDER BY sla_misses DESC;
```

---

### SLA Misses by Run Criteria (Top 10, 7-day)
```sql
SELECT COALESCE(jslmis_run_criteria, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_run_criteria, 'Unknown')
ORDER BY sla_misses DESC
LIMIT 10;
```

---

### Top 10 Applications by SLA Misses (7-day)
```sql
SELECT COALESCE(jslmis_application_desc, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_application_desc, 'Unknown')
ORDER BY sla_misses DESC
LIMIT 10;
```

---

### Top 10 Business Units by SLA Misses (7-day)
```sql
SELECT COALESCE(jslmis_bus_unit, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_bus_unit, 'Unknown')
ORDER BY sla_misses DESC
LIMIT 10;
```

---

### Top Repeated Jobs (30-day)
```sql
SELECT jslmis_job_nm AS job_name, COUNT(*)::int AS sla_miss_count
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY jslmis_job_nm
ORDER BY sla_miss_count DESC
LIMIT 10;
```

---

### Open Queue (Jobs with No End Time)
```sql
SELECT jslmis_pltf_nm, jslmis_batch_dt, jslmis_appl_lib, jslmis_application_desc,
       jslmis_job_nm, jslmis_run_criteria, jslmis_sla_time, jslmis_sla_typ, jslmis_sla_status,
       jslmis_job_start_time, jslmis_job_end_time, jslmis_time_diff,
       jslmis_bus_unit, jslmis_sub_bus_unit, jslmis_bus_summary, jslmis_last_updt_dttm,
       ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - jslmis_job_start_time)) / 60, 2) AS running_minutes
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_job_end_time IS NULL
ORDER BY jslmis_job_start_time ASC NULLS LAST
LIMIT 25;
```

---

### Longest Running Jobs (Top 10)
```sql
SELECT jslmis_pltf_nm, jslmis_batch_dt, jslmis_appl_lib, jslmis_application_desc,
       jslmis_job_nm, jslmis_sla_time, jslmis_sla_typ, jslmis_sla_status,
       jslmis_job_start_time, jslmis_job_end_time, jslmis_bus_unit,
       ROUND(EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60, 2)
         AS duration_minutes
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_job_start_time IS NOT NULL
ORDER BY duration_minutes DESC NULLS LAST
LIMIT 10;
```

---

### Recently Updated (Top 10)
```sql
SELECT jslmis_pltf_nm, jslmis_batch_dt, jslmis_appl_lib, jslmis_application_desc,
       jslmis_job_nm, jslmis_sla_time, jslmis_sla_typ, jslmis_sla_status,
       jslmis_job_start_time, jslmis_job_end_time, jslmis_bus_unit, jslmis_last_updt_dttm
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
ORDER BY jslmis_last_updt_dttm DESC NULLS LAST
LIMIT 10;
```

---

### Daily Open vs Closed (14-day Chart)
```sql
SELECT
  jslmis_batch_dt AS day,
  SUM(CASE WHEN jslmis_job_end_time IS NULL     THEN 1 ELSE 0 END)::int AS open_jobs,
  SUM(CASE WHEN jslmis_job_end_time IS NOT NULL THEN 1 ELSE 0 END)::int AS closed_jobs
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY jslmis_batch_dt
ORDER BY jslmis_batch_dt;
```

---

### Avg Duration by Application (Top 10, 7-day)
```sql
SELECT
  COALESCE(jslmis_application_desc, 'Unknown') AS name,
  ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60)::numeric, 2)
    AS avg_duration_minutes
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  AND jslmis_job_start_time IS NOT NULL
  AND jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(jslmis_application_desc, 'Unknown')
ORDER BY avg_duration_minutes DESC NULLS LAST
LIMIT 10;
```

---

### SLA Violations List
```sql
SELECT jslmis_pltf_nm, jslmis_batch_dt, jslmis_appl_lib, jslmis_application_desc,
       jslmis_job_nm, jslmis_run_criteria, jslmis_sla_time, jslmis_sla_typ, jslmis_sla_status,
       jslmis_job_start_time, jslmis_job_end_time, jslmis_time_diff,
       jslmis_ccfail, jslmis_bus_unit, jslmis_sub_bus_unit, jslmis_bus_summary, jslmis_last_updt_dttm
FROM edoops.job_sla_missed
WHERE jslmis_pltf_nm = '$platform'
  -- AND jslmis_appl_lib = '$appl_name'    -- uncomment to filter by application
ORDER BY jslmis_batch_dt DESC NULLS LAST,
         jslmis_job_start_time DESC NULLS LAST,
         jslmis_job_nm ASC
LIMIT 250;
```

---

### SLA Job Drill-Down (Single Job History)
```sql
SELECT jslmis_pltf_nm, jslmis_batch_dt, jslmis_appl_lib, jslmis_application_desc,
       jslmis_job_nm, jslmis_run_criteria, jslmis_sla_time, jslmis_sla_typ, jslmis_sla_status,
       jslmis_job_start_time, jslmis_job_end_time, jslmis_time_diff,
       jslmis_bus_unit, jslmis_sub_bus_unit, jslmis_bus_summary, jslmis_last_updt_dttm
FROM edoops.job_sla_missed
WHERE jslmis_job_nm = '$jobname'
  -- AND jslmis_pltf_nm = '$platform'      -- uncomment to narrow by platform
  -- AND jslmis_appl_lib = '$appl_name'    -- uncomment to narrow by application
ORDER BY jslmis_last_updt_dttm DESC NULLS LAST
LIMIT 100;
```
