# Snowflake Dashboard Widget Documentation

This document explains what each Snowflake dashboard widget shows, what every label or column means, and the exact SQL query used by the backend route.

Notes on date placeholders used inside SQL:
- ${windowEndDate} = DATE reference date from query param asOf, else CURRENT_DATE
- ${windowEndTimestamp} = timestamp form of reference date
- ${rollingWindowStartDate} / ${rollingWindowStartTimestamp} = lookback start based on endpoint window
- ${summaryWindowStartTimestamp}, ${trendWindowStartTimestamp}, etc. are endpoint-specific lookback starts

## Cost and Efficiency Tab

## Widget: KPI Cards (Cost Today, Cost MTD, Avg Daily Burn (30d), Remaining Balance, Days Remaining, Savings Opp (7d))
What it shows:
- High-level FinOps snapshot for current reference date and recent burn.
- Combines daily usage, month-to-date spend, remaining capacity balances, and 7-day optimization opportunity.

Label meanings:
- Cost Today: Total usage_in_currency for reference date.
- Cost MTD: Sum of usage_in_currency from month start through reference date.
- Avg Daily Burn (30d): Average daily spend over rolling 30-day window.
- Remaining Balance: Sum of capacity, free usage, rollover, and marketplace drawdown balances from latest available balance row on or before reference date.
- Days Remaining: Remaining Balance divided by Avg Daily Burn (30d).
- Savings Opp (7d): Estimated currency opportunity from wasted credits over last 7 days multiplied by average effective rate.

Backend endpoint:
- /api/snowflake/cost-summary

Exact SQL:
    WITH cost_today_cte AS (
      SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_today
      FROM edoops.sf_usage_in_currency_daily
      WHERE usage_date = ${windowEndDate}
    ),
    cost_mtd_cte AS (
      SELECT ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost_mtd
      FROM edoops.sf_usage_in_currency_daily
      WHERE usage_date >= DATE_TRUNC('month', ${windowEndDate})::date
        AND usage_date <= ${windowEndDate}
    ),
    burn_cte AS (
      SELECT ROUND(COALESCE(AVG(daily_cost::numeric), 0)::numeric, 2) AS avg_daily_burn_30d
      FROM (
        SELECT usage_date, SUM(NULLIF(usage_in_currency::text, '')::numeric) AS daily_cost
        FROM edoops.sf_usage_in_currency_daily
        WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
          AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
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
        SELECT MAX(date) FROM edoops.sf_remaining_balance_daily
        WHERE date <= ${windowEndDate}
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
        WHERE NULLIF(start_time::text, '')::timestamp >= ${opportunityWindowStartTimestamp}
          AND NULLIF(start_time::text, '')::timestamp < (${windowEndDate}::timestamp + INTERVAL '1 day')
      ),
      rate_cte AS (
        SELECT COALESCE(AVG(NULLIF(effective_rate::text, '')::numeric), 0) AS avg_rate
        FROM edoops.sf_rate_sheet_daily
        WHERE NULLIF(date::text, '')::date >= ${opportunityWindowStartDate}
          AND NULLIF(date::text, '')::date <= ${windowEndDate}
      )
      SELECT ROUND((wasted.wasted_credits * rate_cte.avg_rate)::numeric, 2) AS optimization_opportunity_currency_7d
      FROM wasted
      CROSS JOIN rate_cte
    )
    SELECT
      m.cost_mtd AS monthly_cost,
      t.cost_today AS warehouse_spend,
      ROUND(
        CASE
          WHEN (m.cost_mtd + b.remaining_balance) > 0
          THEN (b.remaining_balance / (m.cost_mtd + b.remaining_balance)) * 100
          ELSE 0
        END::numeric,
        1
      ) AS efficient_pct,
      o.optimization_opportunity_currency_7d AS wasted_spend,
      ROUND((m.cost_mtd + b.remaining_balance)::numeric, 2) AS budget,
      t.cost_today,
      m.cost_mtd,
      r.avg_daily_burn_30d,
      b.remaining_balance,
      ROUND(
        CASE WHEN r.avg_daily_burn_30d > 0 THEN (b.remaining_balance / r.avg_daily_burn_30d) ELSE NULL END::numeric,
        1
      ) AS days_remaining,
      o.optimization_opportunity_currency_7d
    FROM cost_today_cte t
    CROSS JOIN cost_mtd_cte m
    CROSS JOIN burn_cte r
    CROSS JOIN balance_cte b
    CROSS JOIN opp_cte o

## Widget: Cost by Service Type
What it shows:
- Donut split of total Snowflake cost by service_type over rolling 30-day window.
- Highlights largest contributors to spend.

Label meanings:
- name: Service type.
- value/cost: Total usage_in_currency for that service type.
- center total: Sum of all returned slices.

Backend endpoint:
- /api/snowflake/cost-by-pipeline

Exact SQL:
    SELECT
      service_type AS name,
      ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
    FROM edoops.sf_usage_in_currency_daily
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY service_type
    ORDER BY cost DESC
    LIMIT 10

## Widget: Daily Cost Trend
What it shows:
- Day-by-day spend trend over rolling 30-day window.
- Bar and line both represent daily cost.

Label meanings:
- bucket: Usage date in YYYY-MM-DD.
- cost: Total usage_in_currency for that day.

Backend endpoint:
- /api/snowflake/cost-by-duration

Exact SQL:
    SELECT
      TO_CHAR(NULLIF(usage_date::text, '')::date, 'YYYY-MM-DD') AS bucket,
      ROUND(COALESCE(SUM(NULLIF(usage_in_currency::text, '')::numeric), 0)::numeric, 2) AS cost
    FROM edoops.sf_usage_in_currency_daily
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY NULLIF(usage_date::text, '')::date
    ORDER BY NULLIF(usage_date::text, '')::date

## Widget: Warehouse Cost Efficiency (chart and table)
What it shows:
- Per-warehouse cost efficiency view combining credits consumed, query volume, and runtime.
- Table supports quick triage of high credits per query patterns.

Column and legend meanings:
- Query / Job: Warehouse name.
- Credits: Total credits used by warehouse in lookback window.
- Query Count: Number of queries run by warehouse.
- Avg Runtime: Average query elapsed time in minutes in UI (source is milliseconds).
- Efficiency: UI band based on credits_per_query threshold.
  - Efficient: credits_per_query < 0.2
  - Needs Review: credits_per_query >= 0.2 and < 0.35
  - Inefficient: credits_per_query >= 0.35
- Chart bars: total_credits and query_count.
- Chart line: credits_per_query.

Backend endpoint:
- /api/snowflake/warehouse-cost-efficiency

Exact SQL:
    WITH q AS (
      SELECT
        warehouse_name,
        COUNT(*) AS query_count,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    ),
    w AS (
      SELECT
        warehouse_name,
        SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND warehouse_name IS NOT NULL
      GROUP BY warehouse_name
    )
    SELECT
      w.warehouse_name,
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
    LIMIT 15

## Widget: Top Costly Queries / Jobs
What it shows:
- Trend comparison of expensive query patterns by credits used and average runtime.
- Prioritizes candidates by scanned data and runtime.

Label meanings:
- name: Query pattern hash surrogate (pipeline in response).
- Credits Used: Warehouse credits assigned via warehouse join.
- Avg Runtime (ms): Average elapsed runtime per query pattern in milliseconds.

Backend endpoint:
- /api/snowflake/top-costly-jobs

Exact SQL:
    WITH query_patterns AS (
      SELECT
        COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
        warehouse_name,
        COUNT(*) AS execution_count,
        ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric)::numeric, 2) AS avg_runtime_ms,
        ROUND((SUM(COALESCE(NULLIF(bytes_scanned::text, '')::numeric, 0)) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS scanned_tb
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))), warehouse_name
    ),
    warehouse_cost AS (
      SELECT
        warehouse_name,
        SUM(NULLIF(credits_used::text, '')::numeric) AS total_credits
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY warehouse_name
    )
    SELECT
      qp.query_pattern AS pipeline,
      qp.avg_runtime_ms AS run_cost,
      ROUND(COALESCE(wc.total_credits, 0)::numeric, 2) AS run_spend,
      LEAST(qp.execution_count, 100) AS success_pct
    FROM query_patterns qp
    LEFT JOIN warehouse_cost wc ON qp.warehouse_name = wc.warehouse_name
    ORDER BY qp.scanned_tb DESC, qp.avg_runtime_ms DESC
    LIMIT 10

## Widget: Stage Storage Trend
What it shows:
- Daily stage storage footprint in TB over rolling 30-day window.
- Used in both FinOps and Platform tabs.

Label meanings:
- date: Day bucket in MM/DD.
- storage_tb: Sum of average_stage_bytes converted to terabytes.

Backend endpoint:
- /api/snowflake/storage-growth

Exact SQL:
    SELECT
      TO_CHAR(NULLIF(usage_date::text, '')::date, 'MM/DD') AS date,
      ROUND((COALESCE(SUM(NULLIF(average_stage_bytes::text, '')::numeric), 0) / 1024 / 1024 / 1024 / 1024)::numeric, 2) AS storage_tb
    FROM edoops.sf_stage_storage_usage_history
    WHERE NULLIF(usage_date::text, '')::date >= ${rollingWindowStartDate}
      AND NULLIF(usage_date::text, '')::date <= ${windowEndDate}
    GROUP BY NULLIF(usage_date::text, '')::date
    ORDER BY NULLIF(usage_date::text, '')::date

## Platform Intelligence Tab

## Widget: KPI Cards (Queries Today, Query Success %, Avg Query Time, Credits Used, Failed Tasks, Failed Logins)
What it shows:
- Near-real-time operational snapshot for query health, task outcomes, and access failures.
- Combines results from query history, task history, warehouse metering, and login history.

Label meanings:
- Queries Today: Total query count in summary window.
- Query Success %: Successful query executions divided by total queries.
- Avg Query Time: Mean total_elapsed_time in milliseconds.
- Credits Used: Total warehouse credits in summary window.
- Failed Tasks: Count of task runs with failed state.
- Failed Logins: Count of login events with is_success = NO.

Backend endpoint:
- /api/snowflake/platform-summary

Exact SQL query 1 (query metrics):
    SELECT
      COUNT(*) FILTER (WHERE NULLIF(total_elapsed_time::text, '')::numeric > 60000) AS long_queries,
      COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS query_errors,
      COUNT(*)                                        AS queries_today,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE execution_status ILIKE 'SUCCESS%') / NULLIF(COUNT(*), 0)
      , 1) AS query_success_pct,
      ROUND(AVG(NULLIF(total_elapsed_time::text, '')::numeric), 0) AS avg_query_time_ms
    FROM edoops.sf_query_history
    WHERE NULLIF(start_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
      AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')

Exact SQL query 2 (task failures):
    SELECT COUNT(*) FILTER (WHERE state ILIKE 'FAILED%') AS task_failures
    FROM edoops.sf_task_history
    WHERE NULLIF(scheduled_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
      AND NULLIF(scheduled_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')

Exact SQL query 3 (warehouse utilization and credits):
    SELECT
      ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(NULLIF(credits_used::text, '')::numeric, 0) > 0) / NULLIF(COUNT(*), 0), 1) AS warehouse_util_pct,
      ROUND(COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0)::numeric, 2) AS warehouse_credits_used
    FROM edoops.sf_warehouse_metering_history
    WHERE NULLIF(start_time::text, '')::timestamp >= ${summaryWindowStartTimestamp}
      AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')

Exact SQL query 4 (failed logins):
    SELECT COUNT(*) AS failed_logins
    FROM edoops.sf_login_history
    WHERE NULLIF(event_timestamp::text, '')::timestamp >= ${summaryWindowStartTimestamp}
      AND NULLIF(event_timestamp::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      AND is_success = 'NO'

## Widget: Warehouse Usage Heatmap
What it shows:
- Hourly warehouse usage intensity over a 7-day lookback.
- Values normalized to percent of max observed credits in window.

Label meanings:
- row: warehouse_name.
- col: hour bucket 00:00 to 23:00.
- util_pct/value: normalized percentage of credits_used relative to max warehouse-hour value.
- heat legend bands in UI map percent ranges to colors.

Backend endpoint:
- /api/snowflake/warehouse-heatmap

Exact SQL:
    WITH raw AS (
      SELECT
        warehouse_name,
        EXTRACT(HOUR FROM NULLIF(start_time::text, '')::timestamp) AS hour,
        COALESCE(SUM(NULLIF(credits_used::text, '')::numeric), 0) AS credits_used
      FROM edoops.sf_warehouse_metering_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${heatmapWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      GROUP BY warehouse_name, hour
    ),
    maxv AS (
      SELECT GREATEST(MAX(credits_used), 0.000001) AS max_credits
      FROM raw
    )
    SELECT
      raw.warehouse_name,
      raw.hour,
      ROUND((raw.credits_used / maxv.max_credits) * 100, 2) AS util_pct,
      ROUND(raw.credits_used, 2) AS credits_used
    FROM raw
    CROSS JOIN maxv
    ORDER BY raw.warehouse_name, raw.hour

## Widget: Query Volume and Performance
What it shows:
- Daily query volume and average query time over 14-day trend window.
- Used to correlate load spikes with latency changes.

Label meanings:
- date: day bucket in MM/DD.
- queries: number of queries in that day.
- avg_time_ms: average elapsed time for that day in ms.

Backend endpoint:
- /api/snowflake/query-volume-trend

Exact SQL:
    WITH base AS MATERIALIZED (
      SELECT
        DATE_TRUNC('day', NULLIF(start_time::text, '')::timestamp) AS day_bucket,
        NULLIF(total_elapsed_time::text, '')::numeric AS elapsed_ms
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${trendWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    )
    SELECT
      TO_CHAR(day_bucket, 'MM/DD') AS date,
      COUNT(*) AS queries,
      ROUND(AVG(elapsed_ms), 0) AS avg_time_ms
    FROM base
    GROUP BY day_bucket
    ORDER BY day_bucket

## Widget: Top Slow Queries
What it shows:
- Worst query patterns ranked by p95 latency and failure signal.
- Includes SLA compliance flag and suggested optimization action.

Column meanings:
- Pipeline: query pattern identifier based on query_hash or hash(query_text).
- Last Run: latest run time in HH24:MI.
- Error Type: ERROR if failing queries exist for pattern, else SLOW.
- SLA Status: false when error_count > 0 or p95 >= 15000 ms; true otherwise.
- Suggested Fix: heuristic recommendation based on p95 latency threshold.

Backend endpoint:
- /api/snowflake/top-slow-queries

Exact SQL:
    WITH base AS MATERIALIZED (
      SELECT
        COALESCE(query_hash::text, MD5(COALESCE(query_text::text, ''))) AS query_pattern,
        NULLIF(start_time::text, '')::timestamp AS start_ts,
        NULLIF(total_elapsed_time::text, '')::numeric AS elapsed_ms,
        COALESCE(execution_status::text, '') AS execution_status,
        NULLIF(error_message::text, '') AS error_message
      FROM edoops.sf_query_history
      WHERE NULLIF(start_time::text, '')::timestamp >= ${rollingWindowStartTimestamp}
        AND NULLIF(start_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
        AND NULLIF(total_elapsed_time::text, '')::numeric IS NOT NULL
    ),
    candidates AS MATERIALIZED (
      SELECT
        query_pattern,
        MAX(start_ts) AS last_run,
        ROUND(AVG(elapsed_ms), 2) AS avg_elapsed_ms,
        MAX(elapsed_ms) AS max_elapsed_ms,
        COUNT(*) FILTER (WHERE execution_status NOT ILIKE 'SUCCESS%') AS error_count,
        MAX(error_message) AS latest_error_message
      FROM base
      GROUP BY query_pattern
      ORDER BY error_count DESC, max_elapsed_ms DESC NULLS LAST, avg_elapsed_ms DESC NULLS LAST
      LIMIT 25
    ),
    ranked AS (
      SELECT
        b.query_pattern,
        ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY b.elapsed_ms))::numeric, 2) AS p95_elapsed_ms
      FROM base b
      JOIN candidates c ON c.query_pattern = b.query_pattern
      GROUP BY b.query_pattern
    )
    SELECT
      c.query_pattern AS pipeline,
      TO_CHAR(c.last_run, 'HH24:MI') AS last_run,
      CASE WHEN c.error_count > 0 THEN 'ERROR' ELSE 'SLOW' END AS error_type,
      CASE WHEN c.error_count > 0 OR ranked.p95_elapsed_ms >= 15000 THEN FALSE ELSE TRUE END AS sla_ok,
      CASE
        WHEN ranked.p95_elapsed_ms >= 60000 THEN 'Consider clustering, pruning, or materialized view'
        WHEN ranked.p95_elapsed_ms >= 15000 THEN 'Review joins and warehouse sizing'
        ELSE 'Monitor pattern'
      END AS fix
    FROM candidates c
    JOIN ranked ON ranked.query_pattern = c.query_pattern
    ORDER BY ranked.p95_elapsed_ms DESC NULLS LAST, c.error_count DESC, c.max_elapsed_ms DESC NULLS LAST
    LIMIT 10

## Widget: Task Reliability
What it shows:
- Daily total task runs and outcome split (succeeded vs failed) over 14 days.
- Helps spot orchestration instability.

Label meanings:
- date: day bucket in MM/DD.
- total: all task records that day.
- succeeded: state matching SUCCEEDED%.
- failed: state matching FAILED%.

Backend endpoint:
- /api/snowflake/task-reliability

Exact SQL:
    SELECT
      TO_CHAR(DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp), 'MM/DD') AS date,
      COUNT(*)                                              AS total,
      COUNT(*) FILTER (WHERE state ILIKE 'SUCCEEDED%')      AS succeeded,
      COUNT(*) FILTER (WHERE state ILIKE 'FAILED%')         AS failed
    FROM edoops.sf_task_history
    WHERE NULLIF(scheduled_time::text, '')::timestamp >= ${reliabilityWindowStartTimestamp}
      AND NULLIF(scheduled_time::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
    GROUP BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp)
    ORDER BY DATE_TRUNC('day', NULLIF(scheduled_time::text, '')::timestamp)

## Widget: Login Failures Trend
What it shows:
- Daily failed login count over 14 days.
- Security and access friction indicator.

Label meanings:
- date: day bucket in MM/DD.
- failed_logins: count of login events with is_success = NO.

Backend endpoint:
- /api/snowflake/login-failures

Exact SQL:
    SELECT
      TO_CHAR(DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp), 'MM/DD') AS date,
      COUNT(*) AS failed_logins
    FROM edoops.sf_login_history
    WHERE NULLIF(event_timestamp::text, '')::timestamp >= ${loginWindowStartTimestamp}
      AND NULLIF(event_timestamp::text, '')::timestamp < (${windowEndTimestamp} + INTERVAL '1 day')
      AND is_success = 'NO'
    GROUP BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp)
    ORDER BY DATE_TRUNC('day', NULLIF(event_timestamp::text, '')::timestamp)

## Widget: Alert Banner
What it shows:
- UI status text based on whether core and analytics API calls completed.
- Not driven by a direct SQL query. It is set in frontend load-state logic.

Source logic:
- Success in core promise set: Core Snowflake metrics loaded. Query analytics are still loading.
- Success in analytics promise set: Live Snowflake metrics loaded from database queries.
- No success: Unable to load live Snowflake data. Check server query errors.

## API to Widget Mapping Summary
- /api/snowflake/cost-summary -> FinOps KPI cards
- /api/snowflake/cost-by-pipeline -> Cost by Service Type
- /api/snowflake/cost-by-duration -> Daily Cost Trend
- /api/snowflake/warehouse-cost-efficiency -> Warehouse Cost Efficiency chart and table
- /api/snowflake/top-costly-jobs -> Top Costly Queries / Jobs
- /api/snowflake/storage-growth -> Stage Storage Trend and Storage Growth Trend
- /api/snowflake/platform-summary -> Platform KPI cards
- /api/snowflake/warehouse-heatmap -> Warehouse Usage Heatmap
- /api/snowflake/query-volume-trend -> Query Volume and Performance
- /api/snowflake/top-slow-queries -> Top Slow Queries
- /api/snowflake/task-reliability -> Task Reliability
- /api/snowflake/login-failures -> Login Failures Trend
