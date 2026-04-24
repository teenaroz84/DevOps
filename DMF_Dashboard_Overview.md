# DMF Dashboard Overview

The DMF (Data Movement Framework) Dashboard provides visibility into pipeline job execution, data lineage, run analytics, and historical trends. It is organized into three tabs: **Lineage**, **Analytics**, and **Trends**.

---

## Global Controls

**Duration Selector**

Appears at the top of the dashboard and applies to all three tabs. Controls the date window used for all data queries.

Options:
- Last 1 Month
- Last 3 Months
- Last 6 Months
- Custom (enter a From and To date)

**Ask DMF Agent**

Opens the AI chat panel pre-scoped to the DMF agent for natural language queries about pipeline runs, failures, and lineage.

---

## Lineage Tab

This tab provides job-level data lineage. It shows how data moves from source systems through the pipeline to target destinations, with filtering to drill into specific sources and datasets.

### Filters

A filter bar at the top of the tab controls what data is displayed in the charts and job table. Changes are staged and only applied when the **Apply Filters** button is clicked.

- **Source**: Single-select. Narrows all charts and the job table to a specific source system code. Selecting a source is required to load the Job Details table.
- **Dataset**: Multi-select. Further filters jobs by dataset name within the selected source.
- **Process Type**: Multi-select. Filters by pipeline stage code.
  - ING – Ingestion
  - ENR – Enrichment
  - DIS – Distribution
  - INT – Integration
- **Status**: Multi-select. Filters by job run outcome (success / failed).

**Clear Filters** resets all active filters immediately.

### KPI Cards

Displayed below the filter bar. Summarise the current filtered or unfiltered view.

- **Sources**: Total number of distinct source system codes in the selected date range.
- **Process Types**: Number of process type codes that have at least one job in the range.
- **Success Rate**: Percentage of jobs that completed successfully out of total jobs.
- **Filtered Jobs** (shown only when a filter is active): Total job count matching the current filter set.

### 1. Job Status Distribution

A donut chart showing the split between successful and failed jobs.

Labels:
- Success: Jobs that completed without errors.
- Failed: Jobs that ended in an error state.
- Centre label: Total job count.

### 2. Process Type Breakdown

A donut chart showing how jobs are distributed across the four pipeline stage types.

Labels:
- ING (blue): Ingestion jobs.
- ENR (orange): Enrichment jobs.
- DIS (green): Distribution jobs.
- INT (purple): Integration jobs.
- Centre label: Total job count.

### 3. Jobs by Source / Jobs by Dataset

A bar chart. The content switches based on filter state.

- **Unfiltered**: Shows job counts for the top 10 source system codes. Helps identify which sources generate the most pipeline activity.
- **Filtered (source selected)**: Switches to Jobs by Dataset for the selected source, showing which datasets are most active.

Labels:
- X-axis: Source code or dataset name.
- Y-axis / bar height: Number of jobs.

### 4. Jobs by Target Name

A bar chart showing the top destinations that jobs write to. Useful for understanding data delivery load across target systems.

Labels:
- X-axis: Target name (truncated to 14 characters).
- Y-axis / bar height: Number of jobs.

### 5. Job Details Table

A paginated table showing individual job runs. Only loads when a Source filter is applied.

Columns:
- **Run ID**: Unique identifier for the pipeline run.
- **Process Date**: The logical processing date of the job.
- **Source**: Source system code.
- **Dataset Name**: Name of the dataset being processed.
- **Process Type**: Pipeline stage (ING / ENR / DIS / INT).
- **Source Name**: Full source system name.
- **Target Name**: Destination system or table.
- **Run Start Time**: Timestamp when the job started.
- **Run End Time**: Timestamp when the job ended.
- **Status**: Green dot = success, Red dot = failed.

Pagination: 100 rows per page. Page controls appear when total results exceed 100.

---

## Analytics Tab

This tab provides aggregate analysis of pipeline runs — status distributions, source and target breakdowns, step-level failure counts, and execution time profiling. All charts respond to the Analytics filter bar.

### Filters

- **Source Type**: Single-select. Filters all charts to a specific source system type.
- **Target Type**: Multi-select. Filters to specific destination types.
- **Step Name**: Multi-select. Filters to specific pipeline step names where failures occurred.
- **Run Status**: Multi-select. Filters to specific run outcome statuses (success, failed, etc.).

### KPI Cards

- **Total Records**: Total pipeline records in the filtered view.
- **Success**: Count of successful records with success rate percentage shown as trend.
- **Failed**: Count of failed records.
- **Source Types**: Number of distinct source types in the view.
- **Target Types**: Number of distinct target types in the view.
- **Step Failures**: Total failure count across all step names.

### 1. Status Summary

A donut chart showing the overall distribution of run statuses across all pipeline records.

Labels:
- Each slice: A run status (success, failed, etc.) with its count.
- Centre label: Total record count.

### 2. Count of Source Type

A bar chart showing how many records belong to each source system type. Identifies which source types are generating the most pipeline activity.

Labels:
- X-axis: Source type code.
- Y-axis: Record count.

### 3. Count of Target Type

A bar chart showing record counts grouped by destination/target type.

Labels:
- X-axis: Target type code.
- Y-axis: Record count.

### 4. Step Failures

A bar chart showing failure counts broken down by pipeline step name. Identifies which processing steps are most error-prone.

Labels:
- X-axis: Step name.
- Y-axis: Failure count.

### 5. Failures by Source Name

A horizontal metric bar list ranking source systems by their failure count. Helps prioritise which source integrations need investigation.

Labels:
- Row label: Source system name.
- Bar length and value: Number of failures.

### 6. Datasets by Execution Time (Avg)

A horizontal metric bar list ranking datasets by their average execution time in milliseconds. Colour-coded by severity.

Labels:
- Row label: Dataset name.
- Bar and value: Average execution time in ms.
- Green: Fast (below 40% of max).
- Orange: Moderate (40–70% of max).
- Red: Slow (above 70% of max); prioritise for optimisation.

---

## Trends Tab

This tab shows time-series charts of pipeline activity over the selected date range. All four charts display monthly data points and update when the Duration selector changes.

### 1. Status Trend

A multi-line chart tracking job outcomes month over month. Shows whether pipeline health is improving or degrading over time.

Labels:
- X-axis: Month.
- Lines: Success (green), Failed (red), In Progress (orange), Partial Load (purple).
- Y-axis: Job count.

### 2. Rows Trend

A multi-line chart tracking data volume processed per month. Useful for spotting ingestion anomalies or drops in data delivery.

Labels:
- X-axis: Month.
- Lines: Rows Loaded (blue), Rows Parsed (green), Rows Rejected (red).
- Y-axis: Row count.

### 3. Jobs Trend

A multi-line chart showing job counts per process type over time. Identifies whether a particular pipeline stage is growing disproportionately.

Labels:
- X-axis: Month.
- Lines: ING – Ingestion (blue), ENR – Enrichment (orange), DIS – Distribution (green), INT – Integration (purple).
- Y-axis: Job count.

### 4. Step Failure Trend

A single-line chart tracking total step failure count per period. A rising trend indicates systemic pipeline instability.

Labels:
- X-axis: Period.
- Line: Failures (red).
- Y-axis: Failure count.


---

## Tab 1 — Lineage

**Purpose:** Track individual job runs for a specific data source. Shows where data flows from (source) and where it lands (target), along with process type and run outcome.

### How it works

1. On load the tab fetches two things in parallel:
   - **Lineage meta** (`/api/dmf/lineage/meta`) — the full list of available source codes, dataset names, source names, and target names.
   - **Lineage counts** (`/api/dmf/lineage/counts`) — aggregate counts grouped by status, process type, source code, and target name across all sources.
2. Job-level rows are **not** loaded upfront. They are fetched on-demand via `/api/dmf/lineage/jobs?src_cd=<value>` only when the user selects a specific Source from the filter bar.

### Filters

| Filter | Type | Behaviour |
|---|---|---|
| **Source** | Single-select | Triggers a network request to load jobs for that source. Dataset/Process Type/Status filters are disabled until a source is selected. |
| **Dataset** | Multi-select | Client-side filter applied to the loaded jobs. |
| **Process Type** | Multi-select | Options: `ING` (Ingestion), `ENR` (Enrichment), `DIS` (Distribution), `INT` (Integration). Client-side. |
| **Status** | Multi-select | `success` / `failed`. Client-side. |

When no source is selected, all charts and KPIs show aggregate data across all sources. When a source is selected, everything switches to filtered job-level data.

### KPIs

| Card | Value shown |
|---|---|
| Sources | Total distinct source codes in the system |
| Datasets | Total distinct dataset names |
| Target Names | Total distinct target names |
| Total Jobs / Jobs (source) | All jobs when unfiltered; filtered job count when a source is selected |
| Success Rate | `success jobs / total jobs × 100%` |

### Charts

| Chart | Description |
|---|---|
| **Job Status Distribution** | Donut — success vs. failed counts |
| **Process Type Breakdown** | Donut — ING / ENR / DIS / INT counts |
| **Jobs by Source** (unfiltered) | Bar chart — top 10 sources by job count |
| **Jobs by Dataset** (filtered) | Bar chart — top 10 datasets for the selected source |
| **Jobs by Target Name** | Bar chart — top 10 target names |
| **Job Details** | Full data table — process date, source, dataset, process type, source name, target name, run start/end times, status indicator |

---

## Tab 2 — Analytics

**Purpose:** Cross-source aggregate analysis. Instead of drilling into a single source, this tab shows patterns across all sources filtered by type, step, and run status.

### How it works

1. On first visit the tab loads analytics metadata (`/api/dmf/analytics/meta`) — distinct source types, target types, step names, and run statuses — to populate the filter dropdowns.
2. Every time a filter changes, the analytics endpoint is called (`/api/dmf/analytics?src_typ=&tgt_typ=&step_nm=&run_status=`) and all charts refresh.
3. In **mock mode**, filtering is done client-side using proportional scaling for the Status Summary and direct array filtering for the other charts.

### Filters

| Filter | Type |
|---|---|
| **Source Type** | Single-select |
| **Target Type** | Multi-select |
| **Step Name** | Multi-select |
| **Run Status** | Multi-select |

All filters work together — changing any one of them triggers a full data refresh.

### KPIs

| Card | Value shown |
|---|---|
| Total Records | Sum of all status summary counts |
| Success | Count of successful records + success % |
| Failed | Count of failed records |
| Source Types | Number of distinct source types in the filtered result |
| Target Types | Number of distinct target types in the filtered result |
| Step Failures | Total failure count across all steps |

### Charts

| Chart | Description |
|---|---|
| **Status Summary** | Donut — run status distribution (success, failed, in-progress, etc.) |
| **Count of Source Type** | Vertical bar — record count per source type |
| **Count of Target Type** | Vertical bar — record count per target type |
| **Step Failures** | Vertical bar — failure count per pipeline step |
| **Failures by Source Name** | Horizontal bar list — top failing source names |
| **Datasets by Execution Time (Avg)** | Horizontal bar list — average execution time in ms per dataset; colour-coded green → amber → red by relative execution time |

---

## Tab 3 — Trends

**Purpose:** See how pipeline health and volume have changed over time. All data is monthly aggregate, loaded once on first visit to the tab.

### Charts

| Chart | Description |
|---|---|
| **Status Trend** | Line chart — monthly counts for Success, Failed, In Progress, Partial Load |
| **Rows Trend** | Line chart — monthly totals for Rows Loaded, Rows Parsed, Rows Rejected |
| **Jobs Trend** | Line chart — monthly job counts broken down by process type: ING, ENR, DIS, INT |
| **Step Failure Trend** | Line chart — total step failures per period |

---

## Agent Integration

An **Ask DMF Agent** button is available in the header bar (when `onOpenAgent` is provided). Clicking it opens the AI chat panel pre-configured with the DMF agent context, allowing natural-language queries about pipeline status, failures, and data lineage.

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Jobs are lazy-loaded per source | The full job table can be very large; loading only one source at a time keeps the UI fast |
| Analytics filters hit the server | Too many combinations to pre-compute client-side; server applies SQL `WHERE` clauses |
| Lineage sub-filters are client-side | Once a source's jobs are loaded there are few enough rows to filter in the browser |
| Status Summary uses proportional scaling in mock mode | Mock data is static; scaling by the combined filter ratio approximates what the server would return |
| Tabs are lazy-loaded | Each tab only fetches data the first time it's visited, then caches until the mock toggle changes |
