# Talend Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/talendDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `talend_logs_dashboard` | `edoops` | One row per Talend task execution log entry — pre-aggregated log counts, task metadata, timestamps |

**Key columns:**

| Column | Description |
|---|---|
| `task_execution_id` | Unique identifier per execution |
| `task_name` | Name of the Talend task/job |
| `execution_status` | e.g. `EXECUTION_SUCCESS`, `EXECUTION_FAILED`, `EXECUTION_RUNNING` |
| `workspace_name` | Talend workspace the task belongs to |
| `environment_name` | Target environment |
| `remote_engine_name` | Remote engine used for execution |
| `artifact_name` | Deployed artifact name |
| `artifact_version` | Deployed artifact version |
| `run_type` | Trigger type (manual, scheduled, etc.) |
| `count_of_attempts` | Retry count |
| `start_timestamp` | When the execution started |
| `trigger_timestamp` | When the execution was triggered |
| `fatal_count` | Pre-aggregated count of FATAL log lines for this execution |
| `error_count` | Pre-aggregated count of ERROR log lines |
| `warn_count` | Pre-aggregated count of WARN log lines |
| `err_message_desc` | Error message description |

> Note: Log level data is stored as pre-aggregated count columns (`fatal_count`, `error_count`, `warn_count`) — not as individual per-row log entries with a `level_text` field.

---

## Query Helper

### `daysClause(?days=N)`
All endpoints accept `?days=N` (default `7`, clamped `1`–`15`). Returns a SQL fragment that filters on `start_timestamp`:

```sql
AND start_timestamp >= NOW() - INTERVAL '<N> days'
```

---

## 1. Summary / Overview

### GET `/api/talend/summary?days=<n>`
KPI widgets: status breakdown donut, top workspaces, top remote engines.  
Runs 3 queries in parallel via `Promise.all`.

**Execution status breakdown:**
```sql
SELECT execution_status, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE execution_status IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
GROUP BY execution_status
ORDER BY cnt DESC
```

**Top workspaces by activity:**
```sql
SELECT workspace_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE workspace_name IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
GROUP BY workspace_name
ORDER BY cnt DESC
```

**Top remote engines by activity:**
```sql
SELECT remote_engine_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE remote_engine_name IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
GROUP BY remote_engine_name
ORDER BY cnt DESC
```

**Response:**
```json
{
  "statusBreakdown": [{ "status", "count", "color" }],
  "workspaces": [{ "name", "count" }],
  "engines": [{ "name", "count" }]
}
```

**Status color mapping:**

| Status | Color |
|---|---|
| `EXECUTION_SUCCESS` / `SUCCESS` | `#2e7d32` |
| `EXECUTION_FAILED` / `FAILED` | `#d32f2f` |
| `EXECUTION_RUNNING` / `RUNNING` | `#f57c00` |
| (other) | `#78909c` |

---

## 2. Log Level Distribution

### GET `/api/talend/level-counts?days=<n>`
Bar/donut chart — FATAL / ERROR / WARN totals derived from pre-aggregated count columns.

```sql
SELECT
  SUM(COALESCE(fatal_count, 0))::int AS fatal,
  SUM(COALESCE(error_count, 0))::int AS error,
  SUM(COALESCE(warn_count,  0))::int AS warn
FROM edoops.talend_logs_dashboard
WHERE 1=1
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
```

**Response:** `[{ level, count, color }]`

| Level | Color |
|---|---|
| FATAL | `#c62828` |
| ERROR | `#e53935` |
| WARN | `#f57c00` |

> INFO and DEBUG are **not** tracked — the table only stores `fatal_count`, `error_count`, and `warn_count`.

---

## 3. Recent Task Executions Table

### GET `/api/talend/recent-tasks?days=<n>`
Unique task executions — de-duplicated by `task_execution_id`, ordered by most recent `start_timestamp`.

```sql
SELECT DISTINCT ON (task_execution_id)
  task_execution_id,
  task_name,
  execution_status,
  workspace_name,
  environment_name,
  remote_engine_name,
  artifact_name,
  artifact_version,
  run_type,
  count_of_attempts,
  start_timestamp,
  trigger_timestamp
FROM edoops.talend_logs_dashboard
WHERE task_execution_id IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
ORDER BY task_execution_id, start_timestamp DESC NULLS LAST
```

> `DISTINCT ON` keeps only the latest row per `task_execution_id`. No row cap — all matching executions within the date window are returned.

---

## 4. Recent Errors Table

### GET `/api/talend/recent-errors?days=<n>`
Executions that had fatal / error / warn log counts > 0, ordered by most recent start.

```sql
SELECT
  start_timestamp,
  task_name,
  workspace_name,
  remote_engine_name,
  artifact_name,
  err_message_desc,
  COALESCE(fatal_count, 0)::int AS fatal_count,
  COALESCE(error_count, 0)::int AS error_count,
  COALESCE(warn_count,  0)::int AS warn_count,
  CASE
    WHEN COALESCE(fatal_count, 0) > 0 THEN 'FATAL'
    WHEN COALESCE(error_count, 0) > 0 THEN 'ERROR'
    WHEN COALESCE(warn_count,  0) > 0 THEN 'WARN'
    ELSE 'UNKNOWN'
  END AS derived_level
FROM edoops.talend_logs_dashboard
WHERE (
  COALESCE(fatal_count, 0) > 0 OR
  COALESCE(error_count, 0) > 0 OR
  COALESCE(warn_count,  0) > 0
)
  AND start_timestamp >= NOW() - INTERVAL '<N> days'
ORDER BY start_timestamp DESC NULLS LAST
```

> `derived_level` is a server-computed CASE expression — not a stored column. No message text truncation (no `message_text` / `class_text` / `thread` columns in this table).

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Table**: `edoops.talend_logs_dashboard` (not `edoops.talend_logs`)
- **Error handling**: `safeQuery()` helper swallows query errors and returns a fallback `[]`
- **Days filter**: Applied via `daysClause()` on `start_timestamp`; default 7 days, max 15
- **De-duplication**: `recent-tasks` uses `DISTINCT ON (task_execution_id)` to return one row per execution
- **Log counts**: Level data is pre-aggregated per row (`fatal_count`, `error_count`, `warn_count`) — no per-row log-line table
- **Status color mapping**: Resolved server-side in the summary response
