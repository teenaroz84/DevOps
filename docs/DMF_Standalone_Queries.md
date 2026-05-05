# DMF Standalone Queries

Schema: `edoops`

Main tables:
- `edoops.DMF_RUN_MASTER`
- `edoops.DMF_RUN_STEP_DETAIL`

Replace these placeholders before running:
- `{{src_cd}}`: source code
- `{{date_range_interval}}`: for example `3 months`, `1 year`
- `{{from_date}}`, `{{to_date}}`: custom range values in `YYYY-MM-DD`
- `{{proc_type_codes}}`: comma-separated quoted values, for example `'ING','ENR'`
- `{{run_statuses}}`: comma-separated quoted values, for example `'SUCCESS','FAILED'`
- `{{dataset_names}}`: comma-separated quoted values
- `{{src_typ}}`, `{{tgt_typ}}`, `{{step_nm}}`, `{{tgt_nm}}`: filter values for analytics
- `{{page_size}}`, `{{offset}}`: pagination values

For custom ranges, replace the generic date clause with:

```sql
proc_dt::date BETWEEN '{{from_date}}' AND '{{to_date}}'
```

## Overview Summary

Used by: `/api/dmf/summary`

```sql
SELECT
  COUNT(*) AS total_runs,
  SUM(CASE WHEN run_status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
  SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress_count
FROM edoops.DMF_RUN_MASTER;
```

## Run Status Breakdown

Used by: `/api/dmf/run-status`

```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
GROUP BY run_status
ORDER BY cnt DESC;
```

## Failed by Stage

Used by: `/api/dmf/failed-by-stage`

```sql
SELECT step_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm
ORDER BY cnt DESC;
```

## Stage Summary

Used by: `/api/dmf/stages`

```sql
SELECT
  proc_typ_cd AS stage,
  SUM(CASE WHEN run_status = 'SUCCESS' THEN 1 ELSE 0 END) AS success,
  SUM(CASE WHEN run_status IN ('IN PROGRESS','IN_PROGRESS','STARTED') THEN 1 ELSE 0 END) AS in_progress,
  SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END) AS failed,
  COUNT(*) AS total
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_typ_cd
ORDER BY proc_typ_cd;
```

## Runs Over Time

Used by: `/api/dmf/runs-over-time`

```sql
SELECT proc_dt::date AS date,
       COUNT(*) AS total,
       SUM(CASE WHEN run_status = 'FAILED' THEN 1 ELSE 0 END) AS failed
FROM edoops.DMF_RUN_MASTER
GROUP BY proc_dt::date
ORDER BY proc_dt::date;
```

## Error Reasons

Used by: `/api/dmf/error-reasons`

```sql
SELECT step_nm,
       proc_typ_cd,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
GROUP BY step_nm, proc_typ_cd
ORDER BY step_nm;
```

## Recent Failures

Used by: `/api/dmf/recent-failures`

```sql
SELECT run_id, dataset_nm, proc_typ_cd, run_strt_tm, run_end_tm, src_nm, tgt_nm, run_status
FROM edoops.DMF_RUN_MASTER
WHERE run_status = 'FAILED'
ORDER BY proc_dt DESC, run_strt_tm DESC;
```

## Lineage Metadata

Used by: `/api/dmf/lineage/meta`

```sql
SELECT ARRAY_AGG(DISTINCT src_cd) FILTER (WHERE src_cd IS NOT NULL) AS src_cds
FROM edoops.DMF_RUN_MASTER;

SELECT dataset_nm
FROM edoops.DMF_RUN_MASTER
WHERE dataset_nm IS NOT NULL
GROUP BY dataset_nm
ORDER BY COUNT(*) DESC;
```

## Lineage Counts

Used by: `/api/dmf/lineage/counts`

Apply the same `WHERE` block to each query below.

```sql
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  AND proc_typ_cd IN ({{proc_type_codes}})
  AND run_status IN ({{run_statuses}})
  AND dataset_nm IN ({{dataset_names}})
```

```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY run_status;

SELECT proc_typ_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY proc_typ_cd;

SELECT src_cd, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY src_cd;

SELECT tgt_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY tgt_nm
ORDER BY cnt DESC
LIMIT 10;

SELECT dataset_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY dataset_nm
ORDER BY cnt DESC
LIMIT 10;
```

## Lineage Jobs

Used by: `/api/dmf/lineage/jobs`

```sql
SELECT run_id, proc_dt, src_cd, dataset_nm, proc_typ_cd,
       src_nm, tgt_nm, run_strt_tm, run_end_tm, run_status,
       COUNT(*) OVER() AS total_rows
FROM edoops.DMF_RUN_MASTER
WHERE src_cd = '{{src_cd}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  AND proc_typ_cd IN ({{proc_type_codes}})
  AND run_status IN ({{run_statuses}})
  AND dataset_nm IN ({{dataset_names}})
ORDER BY proc_dt DESC
LIMIT {{page_size}} OFFSET {{offset}};
```

## Analytics Metadata

Used by: `/api/dmf/analytics/meta`

```sql
SELECT src_typ
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE src_typ IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY src_typ
ORDER BY COUNT(*) DESC
LIMIT 100;

SELECT tgt_typ
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE tgt_typ IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY tgt_typ
ORDER BY COUNT(*) DESC
LIMIT 100;

SELECT step_nm
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_nm IS NOT NULL
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY step_nm
ORDER BY COUNT(*) DESC
LIMIT 100;

SELECT ARRAY_AGG(DISTINCT run_status) FILTER (WHERE run_status IS NOT NULL) AS run_statuses
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}';
```

## Analytics Status Summary

Used by: `/api/dmf/analytics`

```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE tgt_nm = '{{tgt_nm}}'
  AND run_status = '{{run_status}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY run_status;
```

If step-detail filters are active, use the route's `EXISTS` pattern:

```sql
SELECT run_status, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER m
WHERE m.proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  AND EXISTS (
    SELECT 1
    FROM edoops.DMF_RUN_STEP_DETAIL d
    WHERE d.run_id = m.run_id
      AND d.src_typ = '{{src_typ}}'
      AND d.tgt_typ = '{{tgt_typ}}'
      AND d.step_nm = '{{step_nm}}'
      AND d.proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  )
GROUP BY run_status;
```

## Analytics Detail Aggregation

```sql
SELECT src_typ,
       tgt_typ,
       CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END AS failed_step_nm,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  AND src_typ = '{{src_typ}}'
  AND tgt_typ = '{{tgt_typ}}'
  AND step_nm = '{{step_nm}}'
GROUP BY src_typ, tgt_typ, CASE WHEN step_status = 'FAILED' THEN step_nm ELSE NULL END;
```

## Failures by Source

```sql
SELECT src_nm, COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE run_status = 'FAILED'
  AND tgt_nm = '{{tgt_nm}}'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY src_nm
ORDER BY cnt DESC;
```

## Dataset Execution Time

```sql
SELECT dataset_nm,
       AVG(EXTRACT(EPOCH FROM (run_end_tm::timestamp - run_strt_tm::timestamp)) * 1000) AS avg_ms
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
  AND run_end_tm IS NOT NULL
  AND run_strt_tm IS NOT NULL
GROUP BY dataset_nm
ORDER BY avg_ms DESC;
```

## Status Trend

Used by: `/api/dmf/status-trend`

```sql
SELECT run_status,
       DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY run_status, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

## Rows Trend

Used by: `/api/dmf/rows-trend`

```sql
SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
       SUM(rows_loaded) AS rows_loaded,
       SUM(rows_parsed) AS rows_parsed,
       SUM(rows_rjctd) AS rows_rjctd
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

## Jobs Trend

Used by: `/api/dmf/jobs-trend`

```sql
SELECT proc_typ_cd,
       DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(DISTINCT run_id) AS cnt
FROM edoops.DMF_RUN_MASTER
WHERE proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY proc_typ_cd, DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```

## Step Failure Trend

Used by: `/api/dmf/step-failure-trend`

```sql
SELECT DATE_TRUNC('month', proc_dt::date) AS month_start,
       COUNT(*) AS cnt
FROM edoops.DMF_RUN_STEP_DETAIL
WHERE step_status = 'FAILED'
  AND proc_dt::date >= CURRENT_DATE - INTERVAL '{{date_range_interval}}'
GROUP BY DATE_TRUNC('month', proc_dt::date)
ORDER BY month_start;
```
