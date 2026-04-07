# DMF Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/dmfDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `DMF_RUN_MASTER` | `edoops` | One row per pipeline run — source, target, status, timestamps |
| `DMF_RUN_STEP_DETAIL` | `edoops` | Per-step detail — rows loaded/parsed/rejected, step status |

---

## 1. Overview Tab

### GET `/api/dmf/summary`
KPI cards: total runs, failed runs, runs in progress, success rate.

```sql
SELECT
  COUNT(*)                                                                              AS total_runs,
  SUM(CASE WHEN run_status = 'SUCCESS'                               THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN run_status = 'FAILED'                                THEN 1 ELSE 0 END) AS failed_count,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress_count
FROM edoops.DMF_RUN_MASTER
```

---

### GET `/api/dmf/stages`
Per-stage (proc_typ_cd) success / in-progress / failed breakdown — pipeline stage progress bars.

```sql
SELECT
  proc_typ_cd                                                                            AS stage,
  SUM(CASE WHEN run_status = 'SUCCESS'                               THEN 1 ELSE 0 END)  AS success,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress,
  SUM(CASE WHEN run_status = 'FAILED'                                THEN 1 ELSE 0 END)  AS failed,
  COUNT(*)                                                                               AS total
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_typ_cd
ORDER BY proc_typ_cd
LIMIT 150
```

---

### GET `/api/dmf/run-status`
Donut chart — run counts grouped by overall run status.

```sql
SELECT run_status, COUNT(*) AS cnt
FROM   edoops.DMF_RUN_MASTER
GROUP BY run_status
ORDER BY cnt DESC
LIMIT 150
```

---

### GET `/api/dmf/failed-by-stage`
Bar chart — failed step counts grouped by step name.

```sql
SELECT step_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm
ORDER BY cnt DESC
LIMIT 150
```

---

## 2. Trends Tab

### GET `/api/dmf/status-trend`
Line/bar chart — monthly run counts pivoted by status.

```sql
SELECT run_status,
       TO_CHAR(proc_dt::date, 'Mon') AS month_name,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
GROUP BY run_status, TO_CHAR(proc_dt::date, 'Mon')
ORDER BY MIN(proc_dt::date)
LIMIT 150
```

Response shape: `[{ month, success, failed, inProgress, partialLoad }]`

---

### GET `/api/dmf/rows-trend`
Line chart — monthly rows loaded / parsed / rejected.

```sql
SELECT TO_CHAR(proc_dt::date, 'Mon') AS month_name,
       SUM(rows_loaded) AS rows_loaded,
       SUM(rows_parsed) AS rows_parsed,
       SUM(rows_rjctd)  AS rows_rjctd
FROM edoops.DMF_RUN_STEP_DETAIL
GROUP BY TO_CHAR(proc_dt::date, 'Mon')
ORDER BY MIN(proc_dt::date)
LIMIT 150
```

---

### GET `/api/dmf/jobs-trend`
Line chart — monthly distinct run counts pivoted by process type.

```sql
SELECT proc_typ_cd,
       TO_CHAR(proc_dt::date, 'Mon') AS month_name,
       COUNT(DISTINCT run_id) AS cnt
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_typ_cd, TO_CHAR(proc_dt::date, 'Mon')
ORDER BY MIN(proc_dt::date)
LIMIT 150
```

Response shape: `[{ month, ING, ENR, DIS, INT }]`

---

### GET `/api/dmf/step-failure-trend`
Line chart — total step executions per month.

```sql
SELECT TO_CHAR(proc_dt::date, 'Mon') AS period,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
GROUP BY TO_CHAR(proc_dt::date, 'Mon')
ORDER BY MIN(proc_dt::date)
LIMIT 150
```

---

## 3. Lineage Tab

### GET `/api/dmf/lineage/meta`
Populates all filter dropdowns — runs 5 queries in parallel via `Promise.all`.

```sql
-- Source codes
SELECT DISTINCT src_cd      FROM edoops.DMF_RUN_MASTER WHERE src_cd      IS NOT NULL ORDER BY src_cd      LIMIT 150

-- Dataset names
SELECT DISTINCT dataset_nm  FROM edoops.DMF_RUN_MASTER WHERE dataset_nm  IS NOT NULL ORDER BY dataset_nm  LIMIT 150

-- Source names
SELECT DISTINCT src_nm      FROM edoops.DMF_RUN_MASTER WHERE src_nm      IS NOT NULL ORDER BY src_nm      LIMIT 150

-- Target names
SELECT DISTINCT tgt_nm      FROM edoops.DMF_RUN_MASTER WHERE tgt_nm      IS NOT NULL ORDER BY tgt_nm      LIMIT 150

-- Process type codes
SELECT DISTINCT proc_typ_cd FROM edoops.DMF_RUN_MASTER WHERE proc_typ_cd IS NOT NULL ORDER BY proc_typ_cd LIMIT 150
```

---

### GET `/api/dmf/lineage/counts?src_cd=<value>`
KPI cards + summary charts for the selected source.  
Runs 5 queries in parallel via `Promise.all`. All queries apply the same optional `WHERE src_cd = $1` filter.

```sql
-- Total runs
SELECT COUNT(*) AS cnt FROM edoops.DMF_RUN_MASTER [WHERE src_cd = $1]

-- Counts by status
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER [WHERE src_cd = $1]
GROUP BY run_status ORDER BY cnt DESC

-- Counts by process type
SELECT proc_typ_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER [WHERE src_cd = $1]
GROUP BY proc_typ_cd ORDER BY cnt DESC

-- Top 15 source codes
SELECT src_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER [WHERE src_cd = $1]
GROUP BY src_cd ORDER BY cnt DESC LIMIT 15

-- Top 15 target names
SELECT tgt_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER [WHERE src_cd = $1]
GROUP BY tgt_nm ORDER BY cnt DESC LIMIT 15
```

---

### GET `/api/dmf/lineage/jobs?src_cd=<value>`
Job table — detailed run rows.  
Accepts optional filter params: `src_cd`, `dataset_nm`, `src_nm`, `tgt_nm`, `proc_typ_cd`, `run_status`.  
Unset params are ignored (no constraint added).

```sql
SELECT DISTINCT proc_dt, src_cd, dataset_nm, proc_typ_cd,
                src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status
FROM edoops.DMF_RUN_MASTER
[WHERE src_cd = $1 AND dataset_nm = $2 AND ...]
ORDER BY proc_dt DESC
LIMIT 150
```

> **Note:** Dataset type, process type, and status sub-filters are applied **client-side** after the initial fetch scoped to `src_cd`.

---

## 4. Analytics Tab

### GET `/api/dmf/analytics/meta`
Populates all analytics filter dropdowns — 5 queries in parallel.

```sql
-- Source types (from step detail)
SELECT DISTINCT src_typ  FROM edoops.DMF_RUN_STEP_DETAIL WHERE src_typ  IS NOT NULL ORDER BY src_typ  LIMIT 150

-- Target types (from step detail)
SELECT DISTINCT tgt_typ  FROM edoops.DMF_RUN_STEP_DETAIL WHERE tgt_typ  IS NOT NULL ORDER BY tgt_typ  LIMIT 150

-- Step names (from step detail)
SELECT DISTINCT step_nm  FROM edoops.DMF_RUN_STEP_DETAIL WHERE step_nm  IS NOT NULL ORDER BY step_nm  LIMIT 150

-- Run statuses (from run master)
SELECT DISTINCT run_status FROM edoops.DMF_RUN_MASTER WHERE run_status IS NOT NULL ORDER BY run_status LIMIT 150

-- Target names (from run master)
SELECT DISTINCT tgt_nm   FROM edoops.DMF_RUN_MASTER     WHERE tgt_nm   IS NOT NULL ORDER BY tgt_nm   LIMIT 150
```

---

### GET `/api/dmf/analytics?src_typ=<>&tgt_typ=<>&step_nm=<>&run_status=<>`
Analytics charts — 6 queries in parallel via `Promise.all`.  
Accepts optional params: `src_typ`, `tgt_typ`, `step_nm`, `tgt_nm`, `run_status`.  
`master_conditions` apply to `DMF_RUN_MASTER`; `detail_conditions` apply to `DMF_RUN_STEP_DETAIL`.

```sql
-- 1. Status summary (run master)
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE <master_conditions>
GROUP BY run_status

-- 2. Source type counts (step detail)
SELECT src_typ, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE <detail_conditions>
GROUP BY src_typ

-- 3. Target type counts (step detail)
SELECT tgt_typ, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE <detail_conditions>
GROUP BY tgt_typ

-- 4. Step execution counts (step detail)
SELECT step_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE <detail_conditions>
GROUP BY step_nm

-- 5. Top failed source names (run master)
SELECT src_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE <master_conditions> AND run_status = 'FAILED'
GROUP BY src_nm ORDER BY cnt DESC LIMIT 150

-- 6. Average execution time per dataset (run master)
SELECT dataset_nm,
       AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
FROM edoops.DMF_RUN_MASTER
WHERE <master_conditions>
  AND run_end_tm IS NOT NULL AND run_strt_tm IS NOT NULL
GROUP BY dataset_nm ORDER BY avg_ms DESC
LIMIT 150
```

> **Multi-select filters:** Frontend sends comma-separated values (e.g. `src_typ=ING,ENR`). The `ANY($1::text[])` pattern is used server-side. Empty arrays default to `'All'` which skips the filter.

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Error handling**: `safeQuery()` helper swallows errors and returns a fallback `[]`
- **Row limits**: Most queries cap at `LIMIT 150` to prevent large payloads
- **Client-side filtering**: Lineage sub-filters (dataset, proc type, status) are applied in the browser after the initial network request
- **Color mapping**: Status colors resolved in server response; `#2e7d32` = success, `#d32f2f` = failed, `#f57c00` = in-progress
