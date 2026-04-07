# ESP Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()`.  
Primary tables: `esp_job_cmnd`, `esp_job_stats_recent`, `esp_job_dpndnt`.

---

## Tables Reference

| Table | Description |
|---|---|
| `esp_job_cmnd` | Job definitions — one row per job. Columns: `appl_name`, `jobname`, `agent`, `jobtype`, `command`, `argument`, `runs`, `user_job`, `cmpl_cd`, `last_run_date` |
| `esp_job_stats_recent` | Recent run history. Columns: `appl_name`, `job_longname`, `start_date`, `start_time`, `end_date`, `end_time`, `exec_qtime`, `ccfail`, `comp_code` |
| `esp_job_dpndnt` | Job dependency chains. Columns: `appl_name`, `jobname`, `release` (successor job name) |

---

## Endpoints & Queries

---

### 1. Application List
**Endpoint:** `GET /api/esp/applications`  
**Widget:** Application selector dropdown

```sql
SELECT DISTINCT appl_name
FROM esp_job_cmnd
ORDER BY appl_name;
```

---

### 2. Application Summary (Main Dashboard Load)
**Endpoint:** `GET /api/esp/summary/:appl_name`  
**Widget:** All KPI cards + charts for a selected application (parallel queries)

#### 2a. Total Job Count
```sql
SELECT COUNT(DISTINCT jobname) AS cnt
FROM esp_job_cmnd
WHERE appl_name = $1;
```

#### 2b. Idle Job Count
Jobs with no run in the last 2 days (or never run):
```sql
SELECT COUNT(DISTINCT jobname) AS cnt
FROM esp_job_cmnd
WHERE appl_name = $1
  AND (last_run_date IS NULL OR last_run_date < NOW() - INTERVAL '2 days');
```

#### 2c. Special Job Count
Jobs matching delay/retrigger naming patterns:
```sql
SELECT COUNT(DISTINCT jobname) AS cnt
FROM esp_job_cmnd
WHERE appl_name = $1
  AND (jobname LIKE '%JSDELAY%' OR jobname LIKE '%RETRIG%');
```

#### 2d. Jobs by Agent
```sql
SELECT COALESCE(agent, 'Null') AS name, COUNT(*) AS count
FROM esp_job_cmnd
WHERE appl_name = $1
GROUP BY agent
ORDER BY count DESC
LIMIT 10;
```

#### 2e. Jobs by Job Type
```sql
SELECT COALESCE(jobtype, 'Null') AS name, COUNT(*) AS count
FROM esp_job_cmnd
WHERE appl_name = $1
GROUP BY jobtype
ORDER BY count DESC;
```

#### 2f. Jobs by Completion Code
```sql
SELECT COALESCE(CAST(cmpl_cd AS TEXT), 'Null') AS name, COUNT(*) AS count
FROM esp_job_cmnd
WHERE appl_name = $1
GROUP BY cmpl_cd
ORDER BY count DESC;
```

#### 2g. Jobs by User Job (Account)
```sql
SELECT COALESCE(user_job, 'Null') AS name, COUNT(*) AS count
FROM esp_job_cmnd
WHERE appl_name = $1
GROUP BY user_job
ORDER BY count DESC
LIMIT 10;
```

#### 2h. Job List (with Last Run Date)
```sql
SELECT jobname, last_run_date
FROM esp_job_cmnd
WHERE appl_name = $1
ORDER BY jobname;
```

#### 2i. Job Run Trend (last 2 days, bucketed by hour)
```sql
SELECT DATE(last_run_date::timestamp)                        AS day,
       EXTRACT(HOUR FROM last_run_date::timestamp)::int      AS hour,
       COUNT(*)::int                                         AS count
FROM esp_job_cmnd
WHERE appl_name = $1
  AND last_run_date::timestamp >= NOW() - INTERVAL '2 days'
GROUP BY DATE(last_run_date::timestamp),
         EXTRACT(HOUR FROM last_run_date::timestamp)
ORDER BY DATE(last_run_date::timestamp),
         EXTRACT(HOUR FROM last_run_date::timestamp);
```

#### 2j. Successor Jobs (Dependency Chain)
```sql
SELECT jobname, release AS successor_job
FROM esp_job_dpndnt
WHERE appl_name = $1
ORDER BY jobname
LIMIT 50;
```

#### 2k. Predecessor Jobs (Dependency Chain)
```sql
SELECT jobname, release AS predecessor_job
FROM esp_job_dpndnt
WHERE release = $1
ORDER BY jobname
LIMIT 50;
```

#### 2l. Job Metadata (Command / Argument)
```sql
SELECT jobname, command, argument
FROM esp_job_cmnd
WHERE appl_name = $1
ORDER BY jobname
LIMIT 100;
```

---

### 3. Job Run Trend (Dynamic Days)
**Endpoint:** `GET /api/esp/job-run-trend/:appl_name?days=N`  
**Widget:** Job Run Trend chart (supports 1–7 day range selector)

```sql
WITH base AS (
  SELECT
    end_date,
    end_time::time AS et,
    jobname,
    ccfail
  FROM esp_job_stats_recent
  WHERE appl_name = $1
)
SELECT
  end_date                                               AS day,
  EXTRACT(HOUR FROM et)::int                             AS hour,
  COUNT(jobname)::int                                    AS job_count,
  SUM(CASE WHEN ccfail = 'YES' THEN 1 ELSE 0 END)::int  AS job_fail_count
FROM base
GROUP BY end_date, EXTRACT(HOUR FROM et)
ORDER BY end_date, EXTRACT(HOUR FROM et);
```

> `days` param is validated: `1 ≤ days ≤ 7`. Used for date filtering on the client side after fetch.

---

### 4. Job Run Table (Recent History)
**Endpoint:** `GET /api/esp/job-run-table/:appl_name`  
**Widget:** Job Run History data table

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
FROM esp_job_cmnd ec
JOIN esp_job_stats_recent es
  ON ec.appl_name   = es.appl_name
 AND ec.jobname     = es.job_longname
WHERE ec.appl_name = $1
ORDER BY es.end_date DESC, es.end_time DESC
LIMIT 500;
```

---

### 5. Job Metadata Detail
**Endpoint:** `GET /api/esp/metadata/:appl_name`  
**Widget:** Job Metadata detail table

```sql
SELECT jobname,
       command,
       argument,
       agent,
       jobtype          AS job_type,
       esp_command      AS comp_code,
       runs,
       user_job
FROM esp_job_cmnd
WHERE appl_name = $1
ORDER BY jobname
LIMIT 200;
```

---

### 6. Global: All-Application Job Counts
**Endpoint:** `GET /api/esp/job-counts`  
**Widget:** Cross-application job count summary

```sql
SELECT appl_name,
       COUNT(DISTINCT jobname) AS total_jobs
FROM esp_job_cmnd
GROUP BY appl_name
ORDER BY total_jobs DESC;
```

---

### 7. Global: Idle Jobs per Application
**Endpoint:** `GET /api/esp/idle-jobs`

```sql
SELECT appl_name, COUNT(DISTINCT jobname) AS idle_jobs
FROM esp_job_cmnd
WHERE last_run_date < NOW() - INTERVAL '2 days'
GROUP BY appl_name;
```

---

### 8. Global: Special Jobs per Application
**Endpoint:** `GET /api/esp/special-jobs`

```sql
SELECT appl_name, COUNT(DISTINCT jobname) AS spl_jobs
FROM esp_job_cmnd
WHERE jobname LIKE '%JSDDELAY%' OR jobname LIKE '%RETRIG%'
GROUP BY appl_name;
```

---

### 9. Global: Jobs by Agent (All Applications)
**Endpoint:** `GET /api/esp/agents`

```sql
SELECT agent, COUNT(DISTINCT jobname) AS count
FROM esp_job_cmnd
GROUP BY agent
ORDER BY count DESC;
```

---

### 10. Global: Jobs by Job Type (All Applications)
**Endpoint:** `GET /api/esp/job-types`

```sql
SELECT jobtype AS job_type, COUNT(DISTINCT jobname) AS count
FROM esp_job_cmnd
GROUP BY jobtype
ORDER BY count DESC;
```

---

### 11. Global: Jobs by User Job (All Applications)
**Endpoint:** `GET /api/esp/user-jobs`

```sql
SELECT COALESCE(user_job, 'Null') AS user_job, COUNT(DISTINCT jobname) AS count
FROM esp_job_cmnd
GROUP BY user_job
ORDER BY count DESC;
```

---

## Notes

- All parameterised queries use `$1` positional placeholders (node-postgres style) to prevent SQL injection.
- `appl_name` values passed in URL path segments are `decodeURIComponent`-decoded before use.
- The `days` parameter in the trend endpoint is clamped server-side: `Math.min(Math.max(rawDays, 1), 7)`.
- Queries returning large result sets are capped with `LIMIT` (200 for metadata, 500 for job run table).
- Inside `GET /api/esp/summary/:appl_name` all sub-queries run in parallel via `Promise.all` and each is individually wrapped in a `safe()` helper that returns its fallback value rather than failing the entire request if one sub-query errors.
