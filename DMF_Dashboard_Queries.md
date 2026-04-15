# DMF Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/dmfDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `DMF_RUN_MASTER` | `edoops` | One row per pipeline run — source, target, status, timestamps |
| `DMF_RUN_STEP_DETAIL` | `edoops` | Per-step detail — rows loaded/parsed/rejected, step status |

---

## Date Range Filtering

All Trends and Lineage/Analytics endpoints accept an optional `date_range` query parameter processed by the `dateRangeClause()` helper:

| Value | SQL fragment injected |
|---|---|
| `1m` | `AND proc_dt::date >= CURRENT_DATE - INTERVAL '1 month'` |
| `3m` | `AND proc_dt::date >= CURRENT_DATE - INTERVAL '3 months'` |
| `6m` | `AND proc_dt::date >= CURRENT_DATE - INTERVAL '6 months'` |
| `1y` | `AND proc_dt::date >= CURRENT_DATE - INTERVAL '1 year'` |
| `2y` | `AND proc_dt::date >= CURRENT_DATE - INTERVAL '2 years'` |
| `custom:YYYY-MM-DD:YYYY-MM-DD` | `AND proc_dt::date BETWEEN '<from>' AND '<to>'` |
| _(absent / unrecognised)_ | _(empty string — no date constraint)_ |

Date values in custom ranges are validated against `/^\d{4}-\d{2}-\d{2}$/` before interpolation to prevent injection.

---

## 1. Overview Tab

### GET `/api/dmf/summary`
KPI cards: total runs, failed runs, runs in progress, success rate.  
No date filter — always aggregates over all rows.

```sql
SELECT
  COUNT(*)                                                                               AS total_runs,
  SUM(CASE WHEN run_status = 'SUCCESS'                               THEN 1 ELSE 0 END)  AS success_count,
  SUM(CASE WHEN run_status = 'FAILED'                                THEN 1 ELSE 0 END)  AS failed_count,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress_count
FROM edoops.DMF_RUN_MASTER
```

Response shape: `{ totalRuns, failedRuns, runsInProgress, successRate }` — each with `{ value, trend, label }`.

---

### GET `/api/dmf/stages`
Per-stage (proc_typ_cd) success / in-progress / failed breakdown — pipeline stage progress bars.  
No date filter.

```sql
SELECT
  proc_typ_cd                                                                             AS stage,
  SUM(CASE WHEN run_status = 'SUCCESS'                               THEN 1 ELSE 0 END)   AS success,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END)  AS in_progress,
  SUM(CASE WHEN run_status = 'FAILED'                                THEN 1 ELSE 0 END)   AS failed,
  COUNT(*)                                                                                AS total
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_typ_cd
ORDER BY proc_typ_cd
```

Response shape: `[{ stage, success, inProgress, failed, rate }]` where `rate` is integer percent.

---

### GET `/api/dmf/run-status`
Donut chart — run counts grouped by overall run status.  
No date filter.

```sql
SELECT run_status, COUNT(*) AS cnt
FROM   edoops.DMF_RUN_MASTER
GROUP BY run_status
ORDER BY cnt DESC
```

Response shape: `[{ name, value, color }]` — colors from `STATUS_COLOR` map (`SUCCESS`=`#2e7d32`, `FAILED`=`#d32f2f`, `IN PROGRESS`=`#f57c00`, `STARTED`=`#1565c0`, `PARTIAL LOAD`=`#ff9800`).

---

### GET `/api/dmf/failed-by-stage`
Bar chart — failed step counts grouped by step name.  
No date filter.

```sql
SELECT step_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm
ORDER BY cnt DESC
```

Response shape: `[{ name, value, color }]` — colors from `STAGE_COLORS` map (`ING`/`INGESTION`=`#1565c0`, `ENR`/`ENRICHMENT`=`#f57c00`, `DIS`/`DISTRIBUTION`=`#2e7d32`, `INT`/`INTEGRATION`=`#7b1fa2`, other=`#757575`).

---

### GET `/api/dmf/runs-over-time`
Daily run counts (total + failed) — no date filter, returns all available days.

```sql
SELECT
  proc_dt::date                                             AS date,
  COUNT(*)                                                  AS total,
  SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END)   AS failed
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_dt::date
ORDER BY proc_dt::date
```

Response shape: `[{ date, total, failed }]` — `date` is `YYYY-MM-DD` string.

---

### GET `/api/dmf/error-reasons`
Failed step counts cross-tabulated by step_nm × proc_typ_cd stage — stacked bar chart.

```sql
SELECT
  step_nm,
  proc_typ_cd,
  COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm, proc_typ_cd
ORDER BY step_nm
```

The server pivots the result in JavaScript into:
```
[{ reason, ingestion, enrichment, distribution, integration }]
```
where `ingestion` sums `ING`/`INGESTION`, `enrichment` sums `ENR`/`ENRICHMENT`, etc.

---

### GET `/api/dmf/recent-failures`
Last FAILED runs from `DMF_RUN_MASTER`, ordered most-recent first.

```sql
SELECT run_id, dataset_nm, proc_typ_cd, run_strt_tm, run_end_tm, src_nm, tgt_nm, run_status
FROM edoops.DMF_RUN_MASTER
WHERE run_status = 'FAILED'
ORDER BY proc_dt DESC, run_strt_tm DESC
```

Response shape: `[{ id, etlProcess, runId, batchId, startTime, endTime, failedStage, errorDescription, details }]`.

---

## 2. Trends Tab

All trend endpoints accept `date_range` (see **Date Range Filtering** above) and use `DATE_TRUNC('month', proc_dt::date)` for bucketing so months sort correctly by calendar order.

### GET `/api/dmf/status-trend`
Line/bar chart — monthly run counts pivoted by status.

```sql
SELECT run_status,
       DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE 1=1 <date_range_clause>
GROUP BY run_status, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start
```

Server pivots into: `[{ month, success, failed, inProgress, partialLoad }]`  
`month` is a human-readable label like `"Jan 2025"` derived from the ISO `month_start`.

---

### GET `/api/dmf/rows-trend`
Line chart — monthly rows loaded / parsed / rejected.

```sql
SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
       SUM(rows_loaded) AS rows_loaded,
       SUM(rows_parsed) AS rows_parsed,
       SUM(rows_rjctd)  AS rows_rjctd
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE 1=1 <date_range_clause>
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start
```

Response shape: `[{ month, rowsLoaded, rowsParsed, rowsRjctd }]`.

---

### GET `/api/dmf/jobs-trend`
Line chart — monthly distinct run counts pivoted by process type (ING, ENR, DIS, INT).

```sql
SELECT proc_typ_cd,
       DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(DISTINCT run_id) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE 1=1 <date_range_clause>
GROUP BY proc_typ_cd, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start
```

Server pivots into: `[{ month, ING, ENR, DIS, INT, … }]` — one key per distinct `proc_typ_cd`.

---

### GET `/api/dmf/step-failure-trend`
Line chart — failed step counts per month.

```sql
SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED' <date_range_clause>
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start
```

Response shape: `[{ period, count }]` — `period` is a human-readable `"Mon YYYY"` label.

---

## 3. Lineage Tab

### GET `/api/dmf/lineage/meta`
Populates source-code and dataset-name filter dropdowns — 2 parallel queries.  
Accepts `date_range` to scope the distinct-value scan.

```sql
-- Source codes (ARRAY_AGG — typically <100 distinct values)
SELECT ARRAY_AGG(DISTINCT src_cd) FILTER (WHERE src_cd IS NOT NULL) AS src_cds
FROM edoops.DMF_RUN_MASTER
WHERE 1=1 <date_range_clause>

-- Dataset names (GROUP BY + LIMIT — can be thousands of distinct values)
SELECT dataset_nm
FROM edoops.DMF_RUN_MASTER
WHERE dataset_nm IS NOT NULL
  AND 1=1 <date_range_clause>
GROUP BY dataset_nm
ORDER BY COUNT(*) DESC
LIMIT 300
```

Response shape: `{ sourceCodes: string[], datasetNames: string[] }` — both sorted alphabetically.

---

### GET `/api/dmf/lineage/counts`
KPI cards + summary charts for the Lineage tab.  
Accepts filter params: `src_cd`, `date_range`, `proc_typ_cd` (comma-separated), `run_status` (comma-separated), `dataset_nm` (comma-separated).  
All filters are applied **server-side** via parameterised queries; multi-value params use `= ANY($n)`.

```sql
-- Uses a dynamically-built WHERE clause: <where>

-- 1. Run counts by status
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER <where>
GROUP BY run_status

-- 2. Run counts by process type
SELECT proc_typ_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER <where>
GROUP BY proc_typ_cd

-- 3. Run counts by source code
SELECT src_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER <where>
GROUP BY src_cd

-- 4. Top 10 target names by count
SELECT tgt_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER <where>
GROUP BY tgt_nm
ORDER BY cnt DESC
LIMIT 10

-- 5. Top 10 dataset names by count
SELECT dataset_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER <where>
GROUP BY dataset_nm
ORDER BY cnt DESC
LIMIT 10
```

All 5 run in parallel via `Promise.all`.  
Response shape:
```json
{
  "total":       1234,
  "byStatus":    [{ "status": "success"|"failed", "count": 0 }],
  "byProcType":  [{ "procTypeCode": "ING", "count": 0 }],
  "bySrcCd":     [{ "sourceCode": "SRC1", "count": 0 }],
  "byTgtNm":     [{ "targetName": "TGT1", "count": 0 }],
  "byDatasetNm": [{ "name": "DS1",         "count": 0 }]
}
```

---

### GET `/api/dmf/lineage/jobs`
Paginated job detail table.  
**Requires** `src_cd` param (returns `{ rows: [], total: 0 }` when absent or `"All"`).  
Accepts: `src_cd`, `date_range`, `page` (0-based, default 0), `pageSize` (10–500, default 100).

Uses `COUNT(*) OVER()` window function to return the total row count in a single pass — no second count query.  
Default date window when `date_range` is absent: last 3 months.

```sql
SELECT proc_dt, src_cd, dataset_nm, proc_typ_cd,
       src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status,
       COUNT(*) OVER() AS total_rows
FROM edoops.DMF_RUN_MASTER
WHERE <date_filter>
  AND src_cd = $1
ORDER BY proc_dt DESC
LIMIT <pageSize> OFFSET <page * pageSize>
```

Response shape:
```json
{
  "total": 1234,
  "rows": [{
    "id": "0-0-SRC-date",
    "processDate": "YYYY-MM-DD",
    "sourceCode": "",
    "datasetName": "",
    "processTypeCode": "",
    "sourceName": "",
    "targetName": "",
    "runStartTime": "YYYY-MM-DD HH:MM:SS",
    "runEndTime": "YYYY-MM-DD HH:MM:SS",
    "status": "success"|"failed"
  }]
}
```

---

## 4. Analytics Tab

### GET `/api/dmf/analytics/meta`
Populates analytics filter dropdowns — 4 parallel queries.  
Accepts `date_range`. High-cardinality fields (`src_typ`, `tgt_typ`, `step_nm`) use `GROUP BY … LIMIT 100` to avoid sending large payloads. `run_status` uses `ARRAY_AGG DISTINCT` (few distinct values).

```sql
-- Source types (top 100 most common)
SELECT src_typ FROM edoops.DMF_RUN_STEP_DETAIL
WHERE src_typ IS NOT NULL AND 1=1 <date_range_clause>
GROUP BY src_typ ORDER BY COUNT(*) DESC LIMIT 100

-- Target types (top 100 most common)
SELECT tgt_typ FROM edoops.DMF_RUN_STEP_DETAIL
WHERE tgt_typ IS NOT NULL AND 1=1 <date_range_clause>
GROUP BY tgt_typ ORDER BY COUNT(*) DESC LIMIT 100

-- Step names (top 100 most common)
SELECT step_nm FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_nm IS NOT NULL AND 1=1 <date_range_clause>
GROUP BY step_nm ORDER BY COUNT(*) DESC LIMIT 100

-- Run statuses (all — low cardinality)
SELECT ARRAY_AGG(DISTINCT run_status) FILTER (WHERE run_status IS NOT NULL) AS run_statuses
FROM edoops.DMF_RUN_MASTER
WHERE 1=1 <date_range_clause>
```

Response shape: `{ sourceTypes: [], targetTypes: [], stepNames: [], runStatuses: [] }` — all arrays sorted alphabetically.

---

### GET `/api/dmf/analytics`
Analytics charts.  
Accepts: `src_typ`, `tgt_typ`, `step_nm`, `tgt_nm`, `run_status`, `date_range`.  
`master_conditions` apply to `DMF_RUN_MASTER`; `detail_conditions` apply to `DMF_RUN_STEP_DETAIL`.

Uses a **single-pass aggregation** on `DMF_RUN_STEP_DETAIL` that groups by `(src_typ, tgt_typ, failed_step_nm)` simultaneously, then pivots in JavaScript — this replaces three separate detail queries.

When detail filters (`src_typ`, `tgt_typ`, `step_nm`) are active, the status summary uses an `EXISTS` correlated subquery to restrict master rows:

```sql
-- 1. Status summary (run master) — EXISTS variant when detail filters active
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER m
WHERE <master_conditions> <date_range_clause>
  AND EXISTS (
    SELECT 1 FROM edoops.DMF_RUN_STEP_DETAIL d
    WHERE d.run_id = m.run_id
      AND <detail_conditions> <date_range_clause>
  )
GROUP BY run_status
-- (EXISTS subquery omitted when no detail filters are active)

-- 2. Single-pass detail aggregation (pivoted in JS into sourceTypeCounts,
--    targetTypeCounts, and stepFailureCounts)
SELECT
  src_typ,
  tgt_typ,
  CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END AS failed_step_nm,
  COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE <detail_conditions> <date_range_clause>
GROUP BY src_typ, tgt_typ,
         CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END

-- 3. Top failed source names (run master)
SELECT src_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE <master_conditions> <date_range_clause>
  AND run_status = 'FAILED'
GROUP BY src_nm ORDER BY cnt DESC

-- 4. Average execution time per dataset (run master)
SELECT dataset_nm,
       AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
FROM edoops.DMF_RUN_MASTER
WHERE <master_conditions> <date_range_clause>
  AND run_end_tm IS NOT NULL AND run_strt_tm IS NOT NULL
GROUP BY dataset_nm ORDER BY avg_ms DESC
```

Queries 1–4 run in parallel via `Promise.all`.

Response shape:
```json
{
  "statusSummary":      [{ "status": "SUCCESS", "count": 0 }],
  "sourceTypeCounts":   [{ "type": "FILE",      "count": 0 }],
  "targetTypeCounts":   [{ "type": "DB",        "count": 0 }],
  "stepFailureCounts":  [{ "step": "LOAD",      "count": 0 }],
  "failuresBySource":   [{ "source": "SRC1",    "count": 0 }],
  "datasetsByExecTime": [{ "dataset": "DS1",    "avgMs": 1234 }]
}
```

> **Multi-value filters:** Each filter param is a single value (no comma-splitting). Use separate requests or filter client-side for multi-select scenarios at the analytics level.

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Error handling**: `safeQuery()` helper swallows errors and returns a fallback `[]`; individual endpoints catch errors and return `500` with `{ error, details }`
- **Date filtering**: `dateRangeClause(req.query.date_range, col?)` generates the SQL fragment; custom ranges are regex-validated before interpolation
- **Color mapping**: `STATUS_COLOR` constant in the module; `#2e7d32` = SUCCESS, `#d32f2f` = FAILED, `#f57c00` = IN PROGRESS, `#1565c0` = STARTED, `#ff9800` = PARTIAL LOAD
- **Lineage jobs pagination**: `page` is 0-based; `pageSize` is clamped to 10–500; `COUNT(*) OVER()` avoids a second COUNT query
- **Stage color mapping**: `STAGE_COLORS` keyed by both abbreviation (`ING`) and full name (`INGESTION`); unknown stages default to `#757575`
