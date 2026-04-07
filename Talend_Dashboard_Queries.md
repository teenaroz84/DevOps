# Talend Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/talendDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `talend_logs` | `edoops` | One row per log entry — task execution details, log level, message, timestamps |

**Key columns:**

| Column | Description |
|---|---|
| `task_execution_id` | Unique identifier per execution |
| `task_name` | Name of the Talend task/job |
| `execution_status` | e.g. `EXECUTION_SUCCESS`, `EXECUTION_FAILED`, `EXECUTION_RUNNING` |
| `workspace_name` | Talend workspace the task belongs to |
| `environment_name` | Target environment |
| `remote_engine_name` | Remote engine used for execution |
| `artifact_name` / `artifact_version` | Deployed artifact details |
| `run_type` | Trigger type (manual, scheduled, etc.) |
| `count_of_attempts` | Retry count |
| `execution_timestamp` | When the execution completed |
| `trigger_timestamp` | When the execution was triggered |
| `level_text` | Log level: `FATAL`, `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |
| `message_text` | Log message body |
| `class_text` | Java class that emitted the log |
| `thread` | Thread name |

---

## 1. Summary / Overview

### GET `/api/talend/summary`
KPI widgets: status breakdown donut, top workspaces, top remote engines.  
Runs 3 queries in parallel via `Promise.all`.

**Execution status breakdown:**
```sql
SELECT execution_status, COUNT(*)::int AS cnt
FROM edoops.talend_logs
WHERE execution_status IS NOT NULL
GROUP BY execution_status
ORDER BY cnt DESC
LIMIT 20
```

**Top 10 workspaces by activity:**
```sql
SELECT workspace_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs
WHERE workspace_name IS NOT NULL
GROUP BY workspace_name
ORDER BY cnt DESC
LIMIT 10
```

**Top 10 remote engines by activity:**
```sql
SELECT remote_engine_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs
WHERE remote_engine_name IS NOT NULL
GROUP BY remote_engine_name
ORDER BY cnt DESC
LIMIT 10
```

---

## 2. Log Level Distribution

### GET `/api/talend/level-counts`
Bar/donut chart — log entry counts grouped by severity level.

```sql
SELECT level_text, COUNT(*)::int AS cnt
FROM edoops.talend_logs
WHERE level_text IS NOT NULL
GROUP BY level_text
ORDER BY cnt DESC
LIMIT 20
```

**Color mapping:**

| Level | Color |
|---|---|
| FATAL | `#c62828` |
| ERROR | `#e53935` |
| WARN | `#f57c00` |
| INFO | `#1565c0` |
| DEBUG | `#78909c` |
| TRACE | `#9e9e9e` |

---

## 3. Recent Task Executions Table

### GET `/api/talend/recent-tasks`
Latest 50 unique task executions — de-duplicated by `task_execution_id`, ordered by most recent `execution_timestamp`.

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
  execution_timestamp,
  trigger_timestamp
FROM edoops.talend_logs
WHERE task_execution_id IS NOT NULL
ORDER BY task_execution_id, execution_timestamp DESC NULLS LAST
LIMIT 50
```

> `DISTINCT ON` PostgreSQL extension ensures one row per `task_execution_id`, selecting the latest log entry for that execution.

---

## 4. Recent Errors Table

### GET `/api/talend/recent-errors`
Latest 50 `FATAL` or `ERROR` log entries with truncated message text.

```sql
SELECT
  execution_timestamp,
  task_name,
  level_text,
  workspace_name,
  remote_engine_name,
  artifact_name,
  LEFT(message_text, 300) AS message_text,
  class_text,
  thread
FROM edoops.talend_logs
WHERE level_text IN ('FATAL', 'ERROR')
  AND message_text IS NOT NULL
ORDER BY execution_timestamp DESC NULLS LAST
LIMIT 50
```

> `message_text` is truncated to 300 characters via `LEFT()` to keep payloads manageable.

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Error handling**: `safeQuery()` helper swallows query errors and returns a fallback `[]`
- **De-duplication**: `recent-tasks` uses PostgreSQL `DISTINCT ON` to return one row per execution
- **Message truncation**: Error messages capped at 300 characters in the query itself
- **Row limits**: All queries cap at 20–50 rows to keep network payloads small
- **Status color mapping**: Resolved server-side; `EXECUTION_SUCCESS` → `#2e7d32`, `EXECUTION_FAILED` → `#d32f2f`, `EXECUTION_RUNNING` → `#f57c00`
