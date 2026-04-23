# ESP Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/esp.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `esp_plt_mapping` | `edoops` | Platform registry — each row maps one `keys` value to a `plt_name` display name. Multiple `keys` rows can share the same `plt_name`. |
| `esp_job_cmnd` | `edoops` | Job definitions — one row per job / appl_name entry |
| `esp_job_stats_recent` | `edoops` | Recent job run history |
| `esp_job_dpndt` | `edoops` | Job dependency chains |

**`esp_plt_mapping` columns:**

| Column | Description |
|---|---|
| `keys` | Canonical identifier for a platform key — used as `platform_id` in all API routes |
| `plt_name` | Human-readable platform display name — may be shared across multiple `keys` rows |

**`esp_job_cmnd` columns:**

| Column | Description |
|---|---|
| `jobname` | Job name |
| `appl_name` | Application/library name |
| `plt_name` | Platform key (`keys` value from `esp_plt_mapping`) |
| `agent` | Agent the job runs on |
| `jobtype` | Job type classification |
| `user_job` | User/account the job runs as |
| `command` | Command to execute |
| `argument` | Command arguments |
| `esp_command` | ESP completion code |
| `runs` | Number of runs |
| `last_run_date` | Last execution date |

**`esp_job_stats_recent` columns:** `appl_name`, `job_longname`, `start_date`, `start_time`, `end_date`, `end_time`, `exec_qtime`, `ccfail` (`YES`/`NO`), `comp_code`

**`esp_job_dpndt` columns:** `appl_name`, `jobname`, `release` (successor job name)

---

## Query Helpers

### Platform resolution
All platform-scoped endpoints accept a `:platformId` path param, which is the canonical `keys` value from `esp_plt_mapping`.

```sql
-- Look up a platform by its canonical keys value
SELECT keys AS platform_id, plt_name AS platform_name
FROM edoops.esp_plt_mapping
WHERE keys = $1
LIMIT 1
```

### Platform keys subquery (`pltKeysSubquery`)
Used to fan a single `plt_name` back out to all `keys` values — necessary because a platform's jobs may be spread across multiple `keys` rows:

```sql
(SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
```

Applied as: `WHERE c.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)`

### `parseDays(?days=N)`
Trend endpoints accept `?days=N` (default `2`, clamped `1`–`5`). Applied as a date filter against `end_date` or `last_run_date`.

---

## Endpoints & Queries

---

### 1. Platform Summary (Dashboard Landing)
**Endpoint:** `GET /api/esp/platform-summary`  
**Response format:** NDJSON (one JSON object per line, streamed)  
**Widget:** Platform selector list — total / idle / special job counts per platform

Single query that scans `esp_job_cmnd` once across all platforms:

```sql
WITH per_job AS (
  -- Deduplicate: count each jobname once per platform with its latest last_run_date
  SELECT
    m.plt_name,
    c.jobname,
    MAX(c.last_run_date) AS last_run_date
  FROM edoops.esp_plt_mapping m
  JOIN edoops.esp_job_cmnd c ON c.plt_name = m.keys
  GROUP BY m.plt_name, c.jobname
),
counts AS (
  SELECT
    plt_name,
    COUNT(*)::int AS total,
    COUNT(CASE WHEN last_run_date IS NOT NULL
                 AND last_run_date::timestamp < NOW() - INTERVAL '2 days'
               THEN 1 END)::int AS idle,
    COUNT(CASE WHEN jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%'
               THEN 1 END)::int AS special
  FROM per_job
  GROUP BY plt_name
),
platforms AS (
  -- Canonical platform_id per plt_name
  SELECT DISTINCT ON (plt_name) keys AS platform_id, plt_name
  FROM edoops.esp_plt_mapping
  ORDER BY plt_name, keys
)
SELECT p.platform_id, p.plt_name,
       COALESCE(c.total,   0) AS total,
       COALESCE(c.idle,    0) AS idle,
       COALESCE(c.special, 0) AS special
FROM platforms p
LEFT JOIN counts c ON c.plt_name = p.plt_name
ORDER BY p.plt_name
```

**Response (NDJSON):** `{ platform, platform_name, total, idle, special }` — one line per platform. Talend platforms are streamed first.

---

### 2. Platform Applications (Paginated)
**Endpoint:** `GET /api/esp/platform-applications/:platformId?limit=N&offset=N&search=<text>`  
**Widget:** Application autocomplete / search within a platform

Resolves `platformId` → `plt_name`, then runs two parallel queries:

```sql
-- Total count
SELECT COUNT(DISTINCT appl_name) AS cnt
FROM edoops.esp_job_cmnd
WHERE plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
  [AND appl_name ILIKE $2]   -- only when ?search= is supplied

-- Paginated application names
SELECT DISTINCT appl_name
FROM edoops.esp_job_cmnd
WHERE plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
  [AND appl_name ILIKE $2]
ORDER BY appl_name
LIMIT <limit> OFFSET <offset>
```

**Default:** `limit=200`, max `1000`. Search pattern uses `%<text>%`.  
**Response:** `{ items: string[], total, hasMore, offset, limit }`

---

### 3. Platform Detail (Aggregate Widgets)
**Endpoint:** `GET /api/esp/platform-detail/:platformId`  
**Widget:** KPI cards + breakdown charts for agents, job types, user jobs, dependency counts

Single materialized CTE scans `esp_job_cmnd` once; a second CTE extracts distinct `appl_name` values for the dependency subquery:

```sql
WITH base AS MATERIALIZED (
  SELECT jobname, appl_name, agent, jobtype, user_job, last_run_date
  FROM edoops.esp_job_cmnd
  WHERE plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
),
appl_names AS MATERIALIZED (
  SELECT DISTINCT appl_name FROM base
)
SELECT
  (SELECT COUNT(DISTINCT jobname)::int FROM base) AS job_count,

  (SELECT COUNT(*)::int FROM (
     SELECT jobname FROM base
     GROUP BY jobname
     HAVING MAX(last_run_date) IS NOT NULL
        AND MAX(last_run_date)::timestamp < NOW() - INTERVAL '2 days'
   ) s) AS idle_count,

  (SELECT COUNT(DISTINCT jobname)::int FROM base
   WHERE jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%') AS spl_count,

  (SELECT COALESCE(json_agg(a ORDER BY a.count DESC), '[]'::json)
   FROM (SELECT COALESCE(agent, 'Null') AS name, COUNT(*)::int AS count
         FROM base GROUP BY agent) a) AS agents,

  (SELECT COALESCE(json_agg(jt ORDER BY jt.count DESC), '[]'::json)
   FROM (SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*)::int AS count
         FROM base GROUP BY jobtype) jt) AS job_types,

  (SELECT COALESCE(json_agg(uj ORDER BY uj.count DESC), '[]'::json)
   FROM (SELECT COALESCE(user_job, 'Null') AS name, COUNT(*)::int AS count
         FROM base GROUP BY user_job) uj) AS user_jobs,

  (SELECT COALESCE(json_agg(s), '[]'::json)
   FROM (SELECT DISTINCT d.jobname, d.release AS successor_job
         FROM edoops.esp_job_dpndt d
         WHERE d.appl_name IN (SELECT appl_name FROM appl_names)
         ORDER BY d.jobname LIMIT 200) s) AS successors,

  (SELECT COALESCE(json_agg(p), '[]'::json)
   FROM (SELECT DISTINCT d.jobname, d.release AS predecessor_job
         FROM edoops.esp_job_dpndt d
         WHERE d.appl_name IN (SELECT appl_name FROM appl_names)
         ORDER BY d.jobname LIMIT 200) p) AS predecessors
```

**Response:** `{ appl_name, platform_id, job_count, idle_job_count, spl_job_count, agents, job_types, user_jobs, successor_jobs, predecessor_jobs }`

---

### 4. Platform Job List (Paginated)
**Endpoint:** `GET /api/esp/platform-job-list/:platformId?limit=N&offset=N`  
**Widget:** Job table rendered separately from aggregate widgets (runs in background)

Default `limit=2000`, max `5000`. Runs two parallel queries:

```sql
-- Total count
SELECT COUNT(DISTINCT jobname) AS cnt
FROM edoops.esp_job_cmnd
WHERE plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)

-- Paginated job rows with latest run status
WITH filtered_jobs AS (
  SELECT DISTINCT ON (c.jobname)
    c.jobname, c.appl_name, c.jobtype AS job_type, c.last_run_date
  FROM edoops.esp_job_cmnd c
  WHERE c.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
  ORDER BY c.jobname, c.last_run_date DESC NULLS LAST
),
latest_status AS (
  SELECT DISTINCT ON (s.job_longname)
    s.job_longname, s.ccfail
  FROM edoops.esp_job_stats_recent s
  JOIN filtered_jobs f ON f.jobname = s.job_longname AND f.appl_name = s.appl_name
  ORDER BY s.job_longname,
           s.end_date DESC NULLS LAST, s.end_time DESC NULLS LAST,
           s.start_date DESC NULLS LAST, s.start_time DESC NULLS LAST
)
SELECT
  f.jobname, f.appl_name, f.job_type, f.last_run_date,
  CASE
    WHEN ls.ccfail = 'YES' THEN 'FAILED'
    WHEN ls.ccfail = 'NO'  THEN 'SUCCESS'
    WHEN f.last_run_date IS NULL THEN 'NEVER RUN'
    ELSE 'UNKNOWN'
  END AS run_status
FROM filtered_jobs f
LEFT JOIN latest_status ls ON ls.job_longname = f.jobname
ORDER BY f.last_run_date DESC NULLS LAST, f.jobname
LIMIT $2 OFFSET $3
```

**Response:** `{ jobs: [{ jobname, appl_name, job_type, last_run_date, run_status }], total, limited, limit, offset, hasMore }`

---

### 5. Platform Run Trend
**Endpoint:** `GET /api/esp/platform-run-trend/:platformId?days=N`  
**Widget:** Hourly run heatmap / line chart (default 2 days, max 5)

```sql
WITH base AS (
  SELECT s.end_date, s.end_time::time AS et, s.jobname, s.ccfail
  FROM edoops.esp_job_stats_recent s
  JOIN edoops.esp_job_cmnd c
    ON c.appl_name = s.appl_name AND c.jobname = s.job_longname
  WHERE c.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
    AND s.end_date >= CURRENT_DATE - INTERVAL '<N> days'
)
SELECT
  end_date AS day,
  EXTRACT(HOUR FROM et)::int                            AS hour,
  COUNT(jobname)::int                                   AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et)
```

**Response:** `[{ day, hour, job_count, job_fail_count }]`

---

### 6. Platform Metadata
**Endpoint:** `GET /api/esp/platform-metadata/:platformId`  
**Widget:** Job metadata detail table (command, argument, agent, etc.)

```sql
SELECT jobname, command, argument, agent, jobtype AS job_type,
       esp_command AS comp_code, runs, user_job, appl_name
FROM edoops.esp_job_cmnd
WHERE plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
ORDER BY jobname
```

**Response:** `[{ jobname, command, argument, agent, job_type, comp_code, runs, user_job, appl_name }]`

---

### 7. Platform Job Run Table
**Endpoint:** `GET /api/esp/platform-job-run-table/:platformId?days=N`  
**Widget:** Full job run history table (default 2 days, max 5)

```sql
SELECT ec.appl_name, es.job_longname, ec.command, ec.argument, ec.runs,
       es.start_date, es.start_time, es.end_date, es.end_time,
       es.exec_qtime, es.ccfail, es.comp_code
FROM edoops.esp_job_cmnd ec
JOIN edoops.esp_job_stats_recent es
  ON ec.appl_name = es.appl_name AND ec.jobname = es.job_longname
WHERE ec.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = $1)
  AND es.end_date >= CURRENT_DATE - INTERVAL '<N> days'
ORDER BY es.end_date DESC, es.end_time DESC
```

**Response:** `[{ job_longname, command, argument, runs, start_date, start_time, end_date, end_time, exec_qtime, ccfail, comp_code, appl_name }]`

---

### 8. All Applications (Cross-Platform)
**Endpoint:** `GET /api/esp/applications`  
**Widget:** Global application browser

```sql
WITH plt_ids AS (
  SELECT DISTINCT ON (plt_name) keys AS platform_id, plt_name
  FROM edoops.esp_plt_mapping
  ORDER BY plt_name, keys
)
SELECT DISTINCT ON (c.appl_name)
  c.appl_name,
  pi.platform_id,
  pi.plt_name AS platform_name
FROM edoops.esp_job_cmnd c
LEFT JOIN plt_ids pi
  ON c.plt_name IN (SELECT keys FROM edoops.esp_plt_mapping WHERE plt_name = pi.plt_name)
ORDER BY c.appl_name
```

**Response:** `{ applications: [{ appl_name, platform_id, platform_name }] }`

---

### 9. Job List (Global)
**Endpoint:** `GET /api/esp/job-list`

```sql
SELECT appl_name, last_run_date
FROM edoops.esp_job_cmnd
ORDER BY jobname
```

**Response:** `{ job_lists: [{ appl_name, last_run_date }] }`

---

### 10. Special Jobs (Global)
**Endpoint:** `GET /api/esp/special-jobs`

```sql
SELECT appl_name, COUNT(DISTINCT jobname) AS spl_jobs
FROM edoops.esp_job_cmnd
WHERE jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%'
GROUP BY appl_name
```

**Response:** `{ spl_jobs: [{ appl_name, spl_jobs }] }`

---

### 11. Job Counts (Global)
**Endpoint:** `GET /api/esp/job-counts`

```sql
SELECT appl_name,
       COUNT(DISTINCT jobname) AS total_jobs
FROM   edoops.esp_job_cmnd
GROUP BY appl_name
ORDER BY total_jobs DESC
```

**Response:** `{ jobs_summary: [{ appl_name, total_jobs }] }`

---

### 12. Idle Jobs (Global)
**Endpoint:** `GET /api/esp/idle-jobs`

```sql
SELECT appl_name, COUNT(DISTINCT jobname) AS idle_jobs
FROM edoops.esp_job_cmnd
WHERE last_run_date::timestamp < NOW() - INTERVAL '2 days'
GROUP BY appl_name
```

**Response:** `{ idle_jobs: [{ appl_name, idle_jobs }] }`

---

### 13. Agents (Global)
**Endpoint:** `GET /api/esp/agents`

```sql
SELECT agent, COUNT(DISTINCT jobname) AS count
FROM edoops.esp_job_cmnd
GROUP BY agent
ORDER BY count DESC
```

**Response:** `{ agents: [{ agent, count }] }`

---

### 14. Job Types (Global)
**Endpoint:** `GET /api/esp/job-types`

```sql
SELECT jobtype AS job_type, COUNT(DISTINCT jobname) AS count
FROM edoops.esp_job_cmnd
GROUP BY jobtype
ORDER BY count DESC
```

**Response:** `{ job_types: [{ job_type, count }] }`

---

### 15. SLA Violations List
**Endpoint:** `GET /api/esp/sla-violations?platformId=<id>&applName=<name>&limit=N`  
**Widget:** SLA Violations data table  
**Default limit:** 250, max 1000. `applName` is optional.

```sql
SELECT
  s.jslmis_pltf_nm,
  s.jslmis_batch_dt,
  s.jslmis_appl_lib,
  s.jslmis_job_nm,
  s.jslmis_run_criteria,
  s.jslmis_sla_time,
  s.jslmis_sla_typ,
  s.jslmis_job_start_time,
  s.jslmis_job_end_time,
  s.jslmis_sla_status,
  s.jslmis_time_diff,
  s.jslmis_application_desc,
  s.jslmis_ccfail,
  s.jslmis_bus_unit,
  s.jslmis_sub_bus_unit,
  s.jslmis_bus_summary,
  s.jslmis_last_updt_dttm
FROM edoops.job_sla_missed s
WHERE s.jslmis_pltf_nm IN (
  SELECT DISTINCT pltf_name FROM edoops.esp_job_config WHERE pltf_name = $1
)
[AND s.jslmis_appl_lib = $2]   -- only when applName is supplied
ORDER BY s.jslmis_batch_dt DESC NULLS LAST,
         s.jslmis_job_start_time DESC NULLS LAST,
         s.jslmis_job_nm ASC
LIMIT 250
```

**Response:** `[{ platform, batch_dt, appl_lib, job_name, run_criteria, sla_time, sla_type, job_start_time, job_end_time, sla_status, time_diff, application_desc, ccfail, bus_unit, sub_bus_unit, bus_summary, last_updated }]`

---

### 16. SLA Missed Dashboard (KPIs + All Widgets)
**Endpoint:** `GET /api/esp/sla-missed-dashboard?platformId=<id>&applName=<name>`  
**Table:** `edoops.job_sla_missed`  
**Filter:** `jslmis_pltf_nm` matched via `esp_job_config`. Optional `jslmis_appl_lib`.  
All sub-queries run in parallel via `Promise.all`.

#### KPI Cards
```sql
WITH base AS MATERIALIZED (
  SELECT * FROM edoops.job_sla_missed s WHERE <whereClause>
)
SELECT
  COUNT(*) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int
    AS total_sla_missed_jobs_today,
  COUNT(*) FILTER (WHERE jslmis_job_end_time IS NULL)::int
    AS open_missed_jobs_right_now,
  COUNT(DISTINCT jslmis_application_desc) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int
    AS distinct_applications_impacted,
  COUNT(DISTINCT jslmis_bus_unit) FILTER (WHERE jslmis_batch_dt = CURRENT_DATE)::int
    AS distinct_business_units_impacted,
  ROUND(AVG(CASE WHEN jslmis_job_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
  END)::numeric, 2) AS avg_delay_minutes,
  ROUND(MAX(CASE WHEN jslmis_job_start_time IS NOT NULL
    THEN EXTRACT(EPOCH FROM (COALESCE(jslmis_job_end_time, CURRENT_TIMESTAMP) - jslmis_job_start_time)) / 60
  END)::numeric, 2) AS longest_delay_minutes
FROM base
```

**KPIs returned:** `total_sla_missed_jobs_today`, `open_missed_jobs_right_now`, `distinct_applications_impacted`, `distinct_business_units_impacted`, `avg_delay_minutes`, `longest_delay_minutes`

#### Daily SLA Misses (14-day trend)
```sql
SELECT s.jslmis_batch_dt AS day, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY s.jslmis_batch_dt
ORDER BY s.jslmis_batch_dt
```

#### Hourly SLA Misses (7-day window)
```sql
SELECT EXTRACT(HOUR FROM s.jslmis_job_start_time)::int AS job_start_hour,
       COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause>
  AND s.jslmis_job_start_time IS NOT NULL
  AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY EXTRACT(HOUR FROM s.jslmis_job_start_time)
ORDER BY job_start_hour
```

#### Platform Trend (7-day)
```sql
SELECT s.jslmis_batch_dt AS day, s.jslmis_pltf_nm AS platform, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.jslmis_batch_dt, s.jslmis_pltf_nm
ORDER BY s.jslmis_batch_dt, s.jslmis_pltf_nm
```

#### SLA Type Trend (7-day)
```sql
SELECT s.jslmis_batch_dt AS day,
       COALESCE(s.jslmis_sla_typ, 'Unknown') AS sla_type,
       COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY s.jslmis_batch_dt, COALESCE(s.jslmis_sla_typ, 'Unknown')
ORDER BY s.jslmis_batch_dt, sla_type
```

#### Top 10 Applications (7-day)
```sql
SELECT COALESCE(s.jslmis_application_desc, 'Unknown') AS name,
       COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_application_desc, 'Unknown')
ORDER BY sla_misses DESC, name
LIMIT 10
```

#### Top 10 Business Units (7-day)
```sql
SELECT COALESCE(s.jslmis_bus_unit, 'Unknown') AS name,
       COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_bus_unit, 'Unknown')
ORDER BY sla_misses DESC, name
LIMIT 10
```

#### Misses by Platform (7-day)
```sql
SELECT COALESCE(s.jslmis_pltf_nm, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_pltf_nm, 'Unknown')
ORDER BY sla_misses DESC, name
```

#### Misses by SLA Type (7-day)
```sql
SELECT COALESCE(s.jslmis_sla_typ, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_sla_typ, 'Unknown')
ORDER BY sla_misses DESC, name
```

#### Misses by Run Criteria (Top 10, 7-day)
```sql
SELECT COALESCE(s.jslmis_run_criteria, 'Unknown') AS name, COUNT(*)::int AS sla_misses
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_run_criteria, 'Unknown')
ORDER BY sla_misses DESC, name
LIMIT 10
```

#### Top Repeated Jobs (30-day)
```sql
SELECT s.jslmis_job_nm, COUNT(*)::int AS sla_miss_count
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY s.jslmis_job_nm
ORDER BY sla_miss_count DESC, s.jslmis_job_nm
LIMIT 10
```

#### Open Queue (currently running, no end time)
```sql
SELECT <all detail fields>,
       ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - s.jslmis_job_start_time)) / 60, 2)
         AS running_minutes
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_job_end_time IS NULL
ORDER BY s.jslmis_job_start_time ASC NULLS LAST
LIMIT 25
```

#### Longest Running (Top 10 by duration)
```sql
SELECT <all detail fields>,
       ROUND(EXTRACT(EPOCH FROM (COALESCE(s.jslmis_job_end_time, CURRENT_TIMESTAMP) - s.jslmis_job_start_time)) / 60, 2)
         AS duration_minutes
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_job_start_time IS NOT NULL
ORDER BY duration_minutes DESC NULLS LAST
LIMIT 10
```

#### Recently Updated (Top 10)
```sql
SELECT <all detail fields>
FROM edoops.job_sla_missed s
WHERE <whereClause>
ORDER BY s.jslmis_last_updt_dttm DESC NULLS LAST
LIMIT 10
```

#### No End Time (Top 50)
```sql
SELECT <all detail fields>
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_job_end_time IS NULL
ORDER BY s.jslmis_job_start_time ASC NULLS LAST
LIMIT 50
```

#### Percent by Platform (7-day)
```sql
SELECT COALESCE(s.jslmis_pltf_nm, 'Unknown') AS name,
       COUNT(*)::int AS sla_misses,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_pltf_nm, 'Unknown')
ORDER BY sla_misses DESC, name
```

#### Percent by Business Unit (7-day)
```sql
SELECT COALESCE(s.jslmis_bus_unit, 'Unknown') AS name,
       COUNT(*)::int AS sla_misses,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_bus_unit, 'Unknown')
ORDER BY sla_misses DESC, name
```

#### Daily Open vs Closed (14-day)
```sql
SELECT s.jslmis_batch_dt AS day,
       SUM(CASE WHEN s.jslmis_job_end_time IS NULL THEN 1 ELSE 0 END)::int AS open_jobs,
       SUM(CASE WHEN s.jslmis_job_end_time IS NOT NULL THEN 1 ELSE 0 END)::int AS closed_jobs
FROM edoops.job_sla_missed s
WHERE <whereClause> AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY s.jslmis_batch_dt
ORDER BY s.jslmis_batch_dt
```

#### Avg Duration by Application (Top 10, 7-day)
```sql
SELECT COALESCE(s.jslmis_application_desc, 'Unknown') AS name,
       ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(s.jslmis_job_end_time, CURRENT_TIMESTAMP) - s.jslmis_job_start_time)) / 60)::numeric, 2)
         AS avg_duration_minutes
FROM edoops.job_sla_missed s
WHERE <whereClause>
  AND s.jslmis_job_start_time IS NOT NULL
  AND s.jslmis_batch_dt >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY COALESCE(s.jslmis_application_desc, 'Unknown')
ORDER BY avg_duration_minutes DESC NULLS LAST, name
LIMIT 10
```

**Full response shape:**
```json
{
  "metrics": { "total_sla_missed_jobs_today": 0, "open_missed_jobs_right_now": 0, "distinct_applications_impacted": 0, "distinct_business_units_impacted": 0, "avg_delay_minutes": null, "longest_delay_minutes": null },
  "daily_misses": [], "hourly_misses": [], "platform_trend": [], "sla_type_trend": [],
  "top_applications": [], "top_business_units": [],
  "misses_by_platform": [], "misses_by_sla_type": [], "misses_by_run_criteria": [],
  "top_repeated_jobs": [],
  "open_queue": [], "longest_running": [], "recently_updated": [], "no_end_time": [],
  "percent_by_platform": [], "percent_by_business_unit": [],
  "daily_open_closed": [], "avg_duration_by_application": []
}
```

---

### 17. SLA Missed Job Detail
**Endpoint:** `GET /api/esp/sla-missed-job-detail?platformId=<id>&jobName=<name>&applName=<name>&limit=N`  
**Widget:** Drill-down history for a specific job  
**Default limit:** 100, max 500. `platformId` and `applName` are optional.

```sql
SELECT
  s.jslmis_pltf_nm, s.jslmis_batch_dt, s.jslmis_appl_lib,
  s.jslmis_application_desc, s.jslmis_job_nm, s.jslmis_run_criteria,
  s.jslmis_sla_time, s.jslmis_sla_typ, s.jslmis_sla_status,
  s.jslmis_job_start_time, s.jslmis_job_end_time, s.jslmis_time_diff,
  s.jslmis_bus_unit, s.jslmis_sub_bus_unit, s.jslmis_bus_summary,
  s.jslmis_last_updt_dttm
FROM edoops.job_sla_missed s
WHERE s.jslmis_job_nm = $1
  [AND s.jslmis_pltf_nm IN (SELECT DISTINCT pltf_name FROM edoops.esp_job_config WHERE pltf_name = $1)]
  [AND s.jslmis_appl_lib = $N]
ORDER BY s.jslmis_last_updt_dttm DESC NULLS LAST
LIMIT 100
```

**Response:** `[{ platform, batch_dt, appl_lib, application_desc, job_name, run_criteria, sla_time, sla_type, sla_status, job_start_time, job_end_time, time_diff, bus_unit, sub_bus_unit, bus_summary, last_updated }]`

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Platform model**: Platforms are identified in URLs and state by their canonical `keys` value (`platform_id`). The `esp_plt_mapping` table may have multiple `keys` rows per `plt_name`; all are included via `pltKeysSubquery`.
- **NDJSON streaming**: `/platform-summary` streams results line-by-line so the browser can render platforms progressively before the full response completes.
- **Single-scan CTEs**: `/platform-summary` and `/platform-detail` use `MATERIALIZED` CTEs to scan `esp_job_cmnd` once — critical for the EDL platform (~25k jobs) where per-platform scans previously caused 1.5-minute waits.
- **Run status derivation**: Derived from `ccfail` (`YES` → `FAILED`, `NO` → `SUCCESS`) joined from `esp_job_stats_recent`; `NEVER RUN` when `last_run_date IS NULL`.
- **Idle threshold**: 2 days (`last_run_date < NOW() - INTERVAL '2 days'`).
- **Special jobs**: Identified by `LIKE '%JSDELAY%' OR LIKE '%RETRIG%'` on `jobname`.

