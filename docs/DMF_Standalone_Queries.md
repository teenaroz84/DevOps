# DMF Dashboard — Standalone SQL Queries

All queries run against **PostgreSQL** (`edoops` schema). Tables: `edoops.DMF_RUN_MASTER`, `edoops.DMF_RUN_STEP_DETAIL`.

Replace `$date_range` with an interval string (`'3 months'`, `'1 year'`, etc.) or a `BETWEEN` clause for custom ranges.

---

## Overview KPIs

### Summary KPI Cards (Total Runs, Failed, In-Progress, Success Rate)
```sql
SELECT
  COUNT(*)                                                                              AS total_runs,
  SUM(CASE WHEN run_status = 'SUCCESS'                                THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN run_status = 'FAILED'                                 THEN 1 ELSE 0 END) AS failed_count,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress_count
FROM edoops.DMF_RUN_MASTER;
```

---

### Run Status Breakdown (Donut Chart)
```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
GROUP BY run_status
ORDER BY cnt DESC;
```

---

### Per-Stage Breakdown — Success / In-Progress / Failed (Bar Chart)
```sql
SELECT
  proc_typ_cd                                                                            AS stage,
  SUM(CASE WHEN run_status = 'SUCCESS'                                THEN 1 ELSE 0 END) AS success,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress,
  SUM(CASE WHEN run_status = 'FAILED'                                 THEN 1 ELSE 0 END) AS failed,
  COUNT(*)                                                                               AS total
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_typ_cd
ORDER BY proc_typ_cd;
```

---

### Daily Run Counts — Total vs Failed (Line/Bar Trend Chart)
```sql
SELECT
  proc_dt::date                                           AS date,
  COUNT(*)                                                AS total,
  SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END) AS failed
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_dt::date
ORDER BY proc_dt::date;
```

---

### Failed by Stage — Step-Level (Bar Chart)
```sql
SELECT step_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm
ORDER BY cnt DESC;
```

---

### Error Reasons by Stage (Grouped Bar Chart)
```sql
SELECT step_nm, proc_typ_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm, proc_typ_cd
ORDER BY step_nm;
```
> Pivot `proc_typ_cd` values (`ING`, `ENR`, `DIS`, `INT`) into columns for the grouped bar chart.

---

### Recent Failures Table
```sql
SELECT run_id, dataset_nm, proc_typ_cd, run_strt_tm, run_end_tm, src_nm, tgt_nm, run_status
FROM edoops.DMF_RUN_MASTER
WHERE run_status = 'FAILED'
ORDER BY proc_dt DESC, run_strt_tm DESC;
```

---

## Trends Tab

### Status Trend by Month (Stacked Bar / Line Chart)
```sql
SELECT
  run_status,
  DATE_TRUNC('month', proc_dt::date) AS month_start,
  COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY run_status, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

---

### Rows Loaded / Parsed / Rejected by Month (Line Chart)
```sql
SELECT
  DATE_TRUNC('month', proc_dt::date) AS month_start,
  SUM(rows_loaded) AS rows_loaded,
  SUM(rows_parsed) AS rows_parsed,
  SUM(rows_rjctd)  AS rows_rejected
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

---

### Job Count by Process Type per Month (Stacked Bar Chart)
```sql
SELECT
  proc_typ_cd,
  DATE_TRUNC('month', proc_dt::date) AS month_start,
  COUNT(DISTINCT run_id) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY proc_typ_cd, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```
> Pivot `proc_typ_cd` values (`ING`, `ENR`, `DIS`, `INT`) into columns.

---

### Step Failure Count by Month (Line Chart)
```sql
SELECT
  DATE_TRUNC('month', proc_dt::date) AS month_start,
  COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

---

## Lineage Tab

### Source Code & Dataset Name Filter Options
```sql
-- Distinct source codes
SELECT ARRAY_AGG(DISTINCT src_cd) FILTER (WHERE src_cd IS NOT NULL) AS src_cds
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range';

-- Top 300 dataset names by frequency
SELECT dataset_nm
FROM edoops.DMF_RUN_MASTER
WHERE dataset_nm IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY dataset_nm
ORDER BY COUNT(*) DESC
LIMIT 300;
```

---

### Lineage Counts — All Chart Aggregates
All five charts share the same filter set. Apply `WHERE` conditions for `src_cd`, `proc_typ_cd`, `run_status`, `dataset_nm`, and date range as needed.

#### Run Status Breakdown
```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '$src_cd'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  -- AND proc_typ_cd = ANY(ARRAY['ING','ENR'])   -- optional
  -- AND run_status  = ANY(ARRAY['SUCCESS'])      -- optional
  -- AND dataset_nm  = ANY(ARRAY['MY_DATASET'])   -- optional
GROUP BY run_status;
```

#### Process Type Breakdown
```sql
SELECT proc_typ_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '$src_cd'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY proc_typ_cd;
```

#### Source Code Breakdown
```sql
SELECT src_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY src_cd;
```

#### Top 10 Target Names
```sql
SELECT tgt_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '$src_cd'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY tgt_nm
ORDER BY cnt DESC
LIMIT 10;
```

#### Top 10 Dataset Names
```sql
SELECT dataset_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '$src_cd'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY dataset_nm
ORDER BY cnt DESC
LIMIT 10;
```

---

### Lineage Job Detail Table (Paginated)
```sql
SELECT proc_dt, src_cd, dataset_nm, proc_typ_cd,
       src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status,
       COUNT(*) OVER() AS total_rows
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  AND src_cd = '$src_cd'
ORDER BY proc_dt DESC
LIMIT 100 OFFSET 0;
```

---

## Analytics Tab

### Filter Options (Source Type, Target Type, Step Name, Run Status)
```sql
-- Source types (top 100 by frequency)
SELECT src_typ
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE src_typ IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY src_typ
ORDER BY COUNT(*) DESC
LIMIT 100;

-- Target types (top 100)
SELECT tgt_typ
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE tgt_typ IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY tgt_typ
ORDER BY COUNT(*) DESC
LIMIT 100;

-- Step names (top 100)
SELECT step_nm
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_nm IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
GROUP BY step_nm
ORDER BY COUNT(*) DESC
LIMIT 100;

-- Run statuses
SELECT ARRAY_AGG(DISTINCT run_status) FILTER (WHERE run_status IS NOT NULL) AS run_statuses
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range';
```

---

### Status Summary (KPI / Donut Chart)
```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  -- AND tgt_nm     = '$tgt_nm'       -- optional
  -- AND run_status = '$run_status'    -- optional
GROUP BY run_status;
```
> When step-level filters (`src_typ`, `tgt_typ`, `step_nm`) are active, restrict via EXISTS:
```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER m
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  AND EXISTS (
    SELECT 1 FROM edoops.DMF_RUN_STEP_DETAIL d
    WHERE d.run_id = m.run_id
      AND d.src_typ = '$src_typ'     -- apply active step filters here
      AND d.proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  )
GROUP BY run_status;
```

---

### Source Type / Target Type / Step Failure Counts (Bar Charts)
Single scan of `DMF_RUN_STEP_DETAIL` returns all three:
```sql
SELECT
  src_typ,
  tgt_typ,
  CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END AS failed_step_nm,
  COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  -- AND src_typ = '$src_typ'    -- optional
  -- AND tgt_typ = '$tgt_typ'    -- optional
  -- AND step_nm = '$step_nm'    -- optional
GROUP BY src_typ, tgt_typ,
         CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END;
```
> Group the result by column to get `sourceTypeCounts`, `targetTypeCounts`, and `stepFailureCounts` separately.

---

### Failures by Source Name (Bar Chart)
```sql
SELECT src_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE run_status = 'FAILED'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  -- AND tgt_nm = '$tgt_nm'     -- optional
GROUP BY src_nm
ORDER BY cnt DESC;
```

---

### Avg Execution Time by Dataset (Bar Chart)
```sql
SELECT
  dataset_nm,
  AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
FROM edoops.DMF_RUN_MASTER
WHERE run_end_tm IS NOT NULL
  AND run_strt_tm IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '$date_range'
  -- AND tgt_nm = '$tgt_nm'     -- optional
GROUP BY dataset_nm
ORDER BY avg_ms DESC;
```
