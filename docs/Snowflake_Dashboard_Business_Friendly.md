# Snowflake Dashboard Business-Friendly Guide

This guide explains each Snowflake dashboard widget in simple language for business and operations stakeholders.

What is intentionally simplified:
- No full SQL blocks.
- Focus on what each widget means, how to read labels, and what decisions it supports.

## How to Read Dates and Time Windows
- Reference Date: The dashboard can be viewed as-of a specific date.
- Rolling windows: Many widgets use recent windows such as 1 day, 7 days, 14 days, or 30 days.
- Trends: Most trend charts aggregate by day.

## FinOps Tab

## KPI Cards
What this section shows:
- A quick financial health snapshot for Snowflake spend and remaining balance.
- Helps estimate runway and potential savings.

Labels explained:
- Cost Today: Spend for the selected reference day.
- Cost MTD: Total spend from month start through reference date.
- Avg Daily Burn (30d): Average daily spend over the last 30 days.
- Remaining Balance: Remaining contractual/credit balance currently available.
- Days Remaining: Estimated days until balance is consumed, based on current burn.
- Savings Opp (7d): Estimated optimization opportunity from recent inefficiencies.

Data sources:
- Daily usage currency
- Remaining balance snapshots
- Warehouse metering and rate sheets

## Cost by Service Type
What this section shows:
- Share of spend by Snowflake service category.
- Highlights the top cost contributors.

Labels explained:
- Service Type: Category of Snowflake consumption.
- Cost: Total spend for that category in the lookback window.

Decision support:
- Identify categories to target for optimization first.

## Daily Cost Trend
What this section shows:
- Day-by-day spending trend.
- Useful to spot spikes or sustained increases.

Labels explained:
- Date: Daily bucket.
- Cost: Spend for that date.

Decision support:
- Verify if optimization actions reduce spend over time.

## Warehouse Cost Efficiency
What this section shows:
- Per-warehouse efficiency by combining credits, query volume, and runtime.
- Designed to find high-cost, low-efficiency warehouses.

Table and chart labels explained:
- Query / Job: Warehouse name.
- Credits: Total credits consumed.
- Query Count: Number of queries executed.
- Avg Runtime: Average query runtime.
- Efficiency: Health indicator derived from credits per query.
  - Efficient: Good credit-per-query performance.
  - Needs Review: Moderate inefficiency.
  - Inefficient: High credits per query; prioritize investigation.

Decision support:
- Resize warehouses, tune workloads, and reduce unnecessary compute.

## Top Costly Queries / Jobs
What this section shows:
- Most expensive query patterns by runtime and associated credit usage.
- Helps prioritize expensive workloads for tuning.

Labels explained:
- Name: Query pattern identifier.
- Credits Used: Compute cost signal.
- Avg Runtime (ms): Performance signal.

Decision support:
- Focus optimization on queries that are both expensive and slow.

## Stage Storage Trend
What this section shows:
- Storage footprint trend over time.
- Indicates data growth and storage cost pressure.

Labels explained:
- Date: Daily bucket.
- Storage (TB): Stage storage volume in terabytes.

Decision support:
- Plan retention, lifecycle cleanup, and storage budget forecasting.

## Platform Intelligence Tab

## KPI Cards
What this section shows:
- Operational reliability snapshot for queries, tasks, and access events.

Labels explained:
- Queries Today: Total query volume in summary window.
- Query Success %: Share of successful query executions.
- Avg Query Time: Average query duration.
- Credits Used: Compute credits consumed in summary window.
- Failed Tasks: Number of task failures.
- Failed Logins: Number of unsuccessful login attempts.

Decision support:
- Monitor reliability, user experience, and operational risk.

## Warehouse Usage Heatmap
What this section shows:
- Hour-by-hour relative warehouse usage over the past week.
- Colors represent intensity (higher value means heavier relative usage).

Labels explained:
- Rows: Warehouses.
- Columns: Hour of day.
- Heat value: Relative utilization percentage.

Decision support:
- Find peak usage windows and rebalance schedules/workloads.

## Query Volume and Performance
What this section shows:
- Daily query volume alongside average query time.
- Helps correlate load changes with latency.

Labels explained:
- Date: Daily bucket.
- Queries: Daily query count.
- Avg Query Time (ms): Daily average duration.

Decision support:
- Detect load-driven degradation and validate scaling decisions.

## Top Slow Queries
What this section shows:
- Slowest query patterns with SLA signal and suggested action.
- Prioritizes where optimization effort should go first.

Columns explained:
- Pipeline: Query pattern identifier.
- Last Run: Most recent observed runtime timestamp.
- Error Type: Whether issue is failure-driven or latency-driven.
- SLA Status: Whether pattern appears compliant with performance thresholds.
- Suggested Fix: Heuristic recommendation for remediation.

Decision support:
- Create a focused remediation backlog for slow or unstable query patterns.

## Task Reliability
What this section shows:
- Daily task outcomes split into succeeded and failed.
- Tracks orchestration stability over time.

Labels explained:
- Date: Daily bucket.
- Total: Total task runs.
- Succeeded: Successful task runs.
- Failed: Failed task runs.

Decision support:
- Detect degradation in batch reliability and trigger RCA quickly.

## Login Failures Trend
What this section shows:
- Daily trend of failed logins.
- Early indicator of access issues or potential security concerns.

Labels explained:
- Date: Daily bucket.
- Failed Logins: Count of unsuccessful login events.

Decision support:
- Investigate abnormal spikes and coordinate with IAM/security teams.

## Alert Banner
What this section shows:
- Dashboard data loading status and health messages.
- Indicates whether core metrics and advanced analytics are fully loaded.

How to use it:
- If partial load message appears, treat deep analytics as in-progress.
- If failure message appears, validate backend availability and source freshness.

## Data Lineage (High Level)
Each widget is fed by one backend API endpoint that aggregates Snowflake operational tables.

Endpoint mapping:
- cost-summary -> FinOps KPI cards
- cost-by-pipeline -> Cost by Service Type
- cost-by-duration -> Daily Cost Trend
- warehouse-cost-efficiency -> Warehouse Cost Efficiency
- top-costly-jobs -> Top Costly Queries / Jobs
- storage-growth -> Stage Storage Trend and Storage Growth Trend
- platform-summary -> Platform KPI cards
- warehouse-heatmap -> Warehouse Usage Heatmap
- query-volume-trend -> Query Volume and Performance
- top-slow-queries -> Top Slow Queries
- task-reliability -> Task Reliability
- login-failures -> Login Failures Trend

## Recommended Business Review Cadence
- Daily: KPI cards, task reliability, failed logins, top slow queries.
- Weekly: Warehouse efficiency, service-type cost mix, query volume/performance.
- Monthly: Spend trend, storage growth, optimization opportunity tracking.
