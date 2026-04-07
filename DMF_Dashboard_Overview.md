# DMF Dashboard — Overview

The DMF (Data Management Framework) dashboard monitors pipeline job execution across three tabs: **Lineage**, **Analytics**, and **Trends**. All data comes from PostgreSQL (`edoops` schema), with full mock-data support for local development.

---

## Data Source

| Table | Description |
|---|---|
| `edoops.DMF_RUN_MASTER` | One row per pipeline run — source code, target, process type, status, timestamps |
| `edoops.DMF_RUN_STEP_DETAIL` | Per-step detail rows — rows loaded, parsed, rejected, step name, step status |

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
