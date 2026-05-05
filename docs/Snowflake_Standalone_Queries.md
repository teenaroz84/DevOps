# Snowflake Standalone Queries

Schema: `edoops`

Main tables:
- `edoops.sf_usage_in_currency_daily`
- `edoops.sf_remaining_balance_daily`
- `edoops.sf_rate_sheet_daily`
- `edoops.sf_warehouse_metering_history`
- `edoops.sf_query_history`
- `edoops.sf_task_history`
- `edoops.sf_login_history`
- `edoops.sf_stage_storage_usage_history`

Replace these placeholders before running:
- `{{as_of_date}}`: `YYYY-MM-DD`; if omitted, use `CURRENT_DATE`
- `{{ref_date}}`: `DATE '{{as_of_date}}'` or `CURRENT_DATE`

## Cost Summary

Used by: `/api/snowflake/cost-summary`

```sql
WITH cost_today_cte AS (
  SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_today
  FROM edoops.sf_usage_in_currency_daily
  WHERE usage_date = {{ref_date}}
),
cost_mtd_cte AS (
  SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_mtd
  FROM edoops.sf_usage_in_currency_daily
  WHERE usage_date >= DATE_TRUNC('month', {{ref_date}})::date
    AND usage_date <= {{ref_date}}
),
burn_cte AS (
  SELECT ROUND(COALESCE(AVG(daily_cost::numeric), 0)::numeric, 2) AS avg_daily_burn_30d
  FROM (
    SELECT usage_date, SUM(NULLIF(usage_in_currency::text, '')::numeric) AS daily_cost
    FROM edoops.sf_usage_in_currency_daily
    WHERE NULLIF(usage_date::text, '')::date >= ({{ref_date}} - INTERVAL '30 day')
      AND NULLIF(usage_date::text, '')::date <= {{ref_date}}
    GROUP BY usage_date
  ) d
),
balance_cte AS (
  SELECT ROUND((
      COALESCE(NULLIF(capacity_balance::text, '')::numeric, 0)
    + COALESCE(NULLIF(free_usage_balance::text, '')::numeric, 0)
    + COALESCE(NULLIF(rollover_balance::text, '')::numeric, 0)
    + COALESCE(NULLIF(marketplace_capacity_drawdown_balance::text, '')::numeric, 0)
  )::numeric, 2) AS remaining_balance
  FROM edoops.sf_remaining_balance_daily
  WHERE date = (
    SELECT MAX(date)
    FROM edoops.sf_remaining_balance_daily
    WHERE date <= {{ref_date}}
  )
),
opp_cte AS (
  WITH wasted AS (
    SELECT SUM(
      GREATEST(
        COALESCE(NULLIF(credits_used::text, '')::numeric, 0)
        - COALESCE(NULLIF(credits_attributed_compute_queries::text, '')::numeric, 0),
        0
      )
    ) AS wasted_credits
    FROM edoops.sf_warehouse_metering_history
    WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '7 day')::timestamp
      AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  ),
  rate_cte AS (
    SELECT COALESCE(AVG(NULLIF(effective_rate::text, '')::numeric), 0) AS avg_rate
    FROM edoops.sf_rate_sheet_daily
    WHERE NULLIF(date::text, '')::date >= ({{ref_date}} - INTERVAL '7 day')
      AND NULLIF(date::text, '')::date <= {{ref_date}}
  )
  SELECT ROUND((wasted.wasted_credits * rate_cte.avg_rate)::numeric, 2) AS optimization_opportunity_currency_7d
  FROM wasted
  CROSS JOIN rate_cte
)
SELECT *
FROM cost_today_cte
CROSS JOIN cost_mtd_cte
CROSS JOIN burn_cte
CROSS JOIN balance_cte
CROSS JOIN opp_cte;
```

## Cost by Pipeline

Used by: `/api/snowflake/cost-by-pipeline`

```sql
SELECT service_type AS name,
       ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
FROM edoops.sf_usage_in_currency_daily
WHERE NULLIF(usage_date::text, '')::date >= ({{ref_date}} - INTERVAL '30 day')
  AND NULLIF(usage_date::text, '')::date <= {{ref_date}}
GROUP BY service_type
ORDER BY cost DESC
LIMIT 10;
```

## Cost Scatter

Used by: `/api/snowflake/cost-scatter`

```sql
WITH q AS (
  SELECT warehouse_name,
         COUNT(*) AS query_count,
         ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms
  FROM edoops.sf_query_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
    AND warehouse_name IS NOT NULL
  GROUP BY warehouse_name
),
w AS (
  SELECT warehouse_name,
         SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
  FROM edoops.sf_warehouse_metering_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
    AND warehouse_name IS NOT NULL
  GROUP BY warehouse_name
)
SELECT w.warehouse_name,
       ROUND(COALESCE(w.total_credits, 0)::numeric, 2) AS cost,
       COALESCE(q.query_count, 0) AS runs,
       ROUND(COALESCE(q.avg_runtime_ms, 0)::numeric, 2) AS avg_runtime_ms
FROM w
LEFT JOIN q ON w.warehouse_name = q.warehouse_name
ORDER BY cost DESC NULLS LAST
LIMIT 20;
```

## Warehouse Cost Efficiency

Used by: `/api/snowflake/warehouse-cost-efficiency`

```sql
WITH q AS (
  SELECT warehouse_name,
         COUNT(*) AS query_count,
         ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms
  FROM edoops.sf_query_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
    AND warehouse_name IS NOT NULL
  GROUP BY warehouse_name
),
w AS (
  SELECT warehouse_name,
         SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
  FROM edoops.sf_warehouse_metering_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
    AND warehouse_name IS NOT NULL
  GROUP BY warehouse_name
)
SELECT w.warehouse_name,
       ROUND(COALESCE(w.total_credits, 0)::numeric, 2) AS total_credits,
       COALESCE(q.query_count, 0) AS query_count,
       ROUND(COALESCE(q.avg_runtime_ms, 0)::numeric, 2) AS avg_runtime_ms,
       CASE
         WHEN COALESCE(q.query_count, 0) > 0
         THEN ROUND((w.total_credits / q.query_count)::numeric, 4)
         ELSE NULL
       END AS credits_per_query
FROM w
LEFT JOIN q ON w.warehouse_name = q.warehouse_name
ORDER BY credits_per_query DESC NULLS LAST, total_credits DESC
LIMIT 15;
```

## Cost by Duration

Used by: `/api/snowflake/cost-by-duration`

```sql
SELECT TO_CHAR(NULLIF(usage_date::text, '')::date, 'YYYY-MM-DD') AS bucket,
       ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
FROM edoops.sf_usage_in_currency_daily
WHERE NULLIF(usage_date::text, '')::date >= ({{ref_date}} - INTERVAL '30 day')
  AND NULLIF(usage_date::text, '')::date <= {{ref_date}}
GROUP BY NULLIF(usage_date::text, '')::date
ORDER BY NULLIF(usage_date::text, '')::date;
```

## Top Costly Jobs

Used by: `/api/snowflake/top-costly-jobs`

```sql
WITH query_patterns AS (
  SELECT COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
         warehouse_name,
         COUNT(*) AS execution_count,
         ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms,
         ROUND((SUM(COALESCE(NULLIF(bytes_scanned::text, '')::numeric, 0)) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS scanned_tb
  FROM edoops.sf_query_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  GROUP BY COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))), warehouse_name
),
warehouse_cost AS (
  SELECT warehouse_name,
         SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
  FROM edoops.sf_warehouse_metering_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '30 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  GROUP BY warehouse_name
)
SELECT qp.query_pattern AS pipeline,
       qp.avg_runtime_ms AS run_cost,
       ROUND(COALESCE(wc.total_credits, 0)::numeric, 2) AS run_spend,
       LEAST(qp.execution_count, 100) AS success_pct
FROM query_patterns qp
LEFT JOIN warehouse_cost wc ON qp.warehouse_name = wc.warehouse_name
ORDER BY qp.scanned_tb DESC, qp.avg_runtime_ms DESC
LIMIT 10;
```

## Platform Summary

Used by: `/api/snowflake/platform-summary`

```sql
SELECT COUNT(*) FILTER (WHERE NULLIF(total_elapsed_time::text, '')::numeric > 60000) AS long_queries,
       COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS query_errors,
       COUNT(*) AS queries_today,
       ROUND(100.0 * COUNT(*) FILTER (WHERE execution_status ILIKE 'SUCCESS%') / NULLIF(COUNT(*), 0), 1) AS query_success_pct,
       ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric), 0) AS avg_query_time_ms
FROM edoops.sf_query_history
WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '1 day')::timestamp
  AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day');
```

```sql
SELECT COUNT(*) FILTER (WHERE state ILIKE 'FAILED%') AS task_failures
FROM edoops.sf_task_history
WHERE NULLIF(scheduled_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '1 day')::timestamp
  AND NULLIF(scheduled_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day');
```

```sql
SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(NULLIF(credits_used::text, '')::numeric, 0) > 0) / NULLIF(COUNT(*), 0), 1) AS warehouse_util_pct,
       ROUND(COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0)::numeric, 2) AS warehouse_credits_used
FROM edoops.sf_warehouse_metering_history
WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '1 day')::timestamp
  AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day');
```

```sql
SELECT COUNT(*) AS failed_logins
FROM edoops.sf_login_history
WHERE NULLIF(event_timestamp::text, '')::timestamp >= ({{ref_date}} - INTERVAL '1 day')::timestamp
  AND NULLIF(event_timestamp::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  AND is_success = 'NO';
```

## Warehouse Heatmap

Used by: `/api/snowflake/warehouse-heatmap`

```sql
WITH raw AS (
  SELECT warehouse_name,
         EXTRACT(HOUR FROM NULLIF(start_time::text, '')::timestamp) AS hour,
         COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0) AS credits_used
  FROM edoops.sf_warehouse_metering_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '7 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  GROUP BY warehouse_name, hour
),
maxv AS (
  SELECT GREATEST(MAX(credits_used), 0.000001) AS max_credits
  FROM raw
)
SELECT raw.warehouse_name,
       raw.hour,
       ROUND((raw.credits_used / maxv.max_credits) * 100, 2) AS util_pct,
       ROUND(raw.credits_used, 2) AS credits_used
FROM raw
CROSS JOIN maxv
ORDER BY raw.warehouse_name, raw.hour;
```

## Hourly Queries

Used by: `/api/snowflake/hourly-queries`

```sql
SELECT DATE_PART('hour', NULLIF(start_time::text, '')::timestamp) AS hour,
       COUNT(*) AS queries
FROM edoops.sf_query_history
WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '1 day')::timestamp
  AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
GROUP BY hour
ORDER BY hour;
```

## Top Slow Queries

Used by: `/api/snowflake/top-slow-queries`

```sql
WITH q AS (
  SELECT COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
         MAX(NULLIF(start_time::text, '')::timestamp) AS last_run,
         ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_elapsed_ms,
         ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY NULLIF(total_elapsed_time::text, '')::numeric))::numeric, 2) AS p95_elapsed_ms,
         COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS error_count,
         MAX(error_message) AS latest_error_message
  FROM edoops.sf_query_history
  WHERE NULLIF(total_elapsed_time::text, '')::numeric IS NOT NULL
  GROUP BY COALESCE(query_hash::text, MD5(COALESCE(query_text::text, '')))
)
SELECT q.query_pattern AS pipeline,
       TO_CHAR(q.last_run, 'YYYY-MM-DD') AS start_date,
       ROUND(q.p95_elapsed_ms, 0) AS duration_ms,
       CASE WHEN q.error_count > 0 THEN 'ERROR' ELSE 'SLOW' END AS error_type,
       CASE WHEN q.error_count > 0 OR q.p95_elapsed_ms >= 15000 THEN FALSE ELSE TRUE END AS sla_ok,
       CASE
         WHEN q.p95_elapsed_ms >= 60000 THEN 'Consider clustering, pruning, or materialized view'
         WHEN q.p95_elapsed_ms >= 15000 THEN 'Review joins and warehouse sizing'
         ELSE 'Monitor pattern'
       END AS fix,
       TO_CHAR(q.last_run, 'HH24:MI') AS last_run
FROM q
ORDER BY q.p95_elapsed_ms DESC
LIMIT 10;
```

## Query Volume Trend

Used by: `/api/snowflake/query-volume-trend`

```sql
WITH base AS MATERIALIZED (
  SELECT DATE_TRUNC('day', NULLIF(start_time::text, '')::timestamp) AS day_bucket,
         NULLIF(total_elapsed_time::text, '')::numeric AS elapsed_ms
  FROM edoops.sf_query_history
  WHERE NULLIF(start_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '14 day')::timestamp
    AND NULLIF(start_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
)
SELECT TO_CHAR(day_bucket, 'MM/DD') AS date,
       COUNT(*) AS queries,
       ROUND(AVG(elapsed_ms), 0) AS avg_time_ms
FROM base
GROUP BY day_bucket
ORDER BY day_bucket;
```

## Task Reliability

Used by: `/api/snowflake/task-reliability`

```sql
SELECT TO_CHAR(DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp), 'MM/DD') AS date,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE state ILIKE 'SUCCEEDED%') AS succeeded,
       COUNT(*) FILTER (WHERE state ILIKE 'FAILED%') AS failed
FROM edoops.sf_task_history
WHERE NULLIF(scheduled_time::text, '')::timestamp >= ({{ref_date}} - INTERVAL '14 day')::timestamp
  AND NULLIF(scheduled_time::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
GROUP BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp)
ORDER BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp);
```

## Login Failures

Used by: `/api/snowflake/login-failures`

```sql
SELECT TO_CHAR(DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp), 'MM/DD') AS date,
       COUNT(*) AS failed_logins
FROM edoops.sf_login_history
WHERE NULLIF(event_timestamp::text, '')::timestamp >= ({{ref_date}} - INTERVAL '14 day')::timestamp
  AND NULLIF(event_timestamp::text, '')::timestamp < ({{ref_date}}::timestamp + INTERVAL '1 day')
  AND is_success = 'NO'
GROUP BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp)
ORDER BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp);
```

## Storage Growth

Used by: `/api/snowflake/storage-growth`

```sql
SELECT TO_CHAR(NULLIF(usage_date::text, '')::date, 'MM/DD') AS date,
       ROUND((COALESCE(SUM(NULLIF(average_stage_bytes::text, '')::numeric), 0) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS storage_tb
FROM edoops.sf_stage_storage_usage_history
WHERE NULLIF(usage_date::text, '')::date >= ({{ref_date}} - INTERVAL '30 day')
  AND NULLIF(usage_date::text, '')::date <= {{ref_date}}
GROUP BY NULLIF(usage_date::text, '')::date
ORDER BY NULLIF(usage_date::text, '')::date;
```
