# Talend Standalone Queries

Schema: `edoops`

Table:
- `edoops.talend_logs_dashboard`

Replace these placeholders before running:
- `{{days}}`: lookback window from `1` to `15`

## Summary Status Breakdown

Used by: `/api/talend/summary`

```sql
SELECT execution_status, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE execution_status IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '{{days}} days'
GROUP BY execution_status
ORDER BY cnt DESC;
```

## Summary Workspace Breakdown

Used by: `/api/talend/summary`

```sql
SELECT workspace_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE workspace_name IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '{{days}} days'
GROUP BY workspace_name
ORDER BY cnt DESC;
```

## Summary Remote Engine Breakdown

Used by: `/api/talend/summary`

```sql
SELECT remote_engine_name, COUNT(*)::int AS cnt
FROM edoops.talend_logs_dashboard
WHERE remote_engine_name IS NOT NULL
  AND start_timestamp >= NOW() - INTERVAL '{{days}} days'
GROUP BY remote_engine_name
ORDER BY cnt DESC;
```

## Level Counts

Used by: `/api/talend/level-counts`

```sql
SELECT SUM(COALESCE(fatal_count, 0))::int AS fatal,
       SUM(COALESCE(error_count, 0))::int AS error,
       SUM(COALESCE(warn_count, 0))::int AS warn
FROM edoops.talend_logs_dashboard
WHERE start_timestamp >= NOW() - INTERVAL '{{days}} days';
```

## Recent Tasks

Used by: `/api/talend/recent-tasks`

```sql
SELECT DISTINCT ON (task_execution_id)
  task_execution_id,
  task_id,
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
  AND start_timestamp >= NOW() - INTERVAL '{{days}} days'
ORDER BY task_execution_id, start_timestamp DESC NULLS LAST;
```

## Recent Errors

Used by: `/api/talend/recent-errors`

```sql
SELECT start_timestamp,
       task_name,
       task_id,
       task_execution_id,
       execution_status,
       workspace_name,
       remote_engine_name,
       artifact_name,
       err_message_desc,
       COALESCE(fatal_count, 0)::int AS fatal_count,
       COALESCE(error_count, 0)::int AS error_count,
       COALESCE(warn_count, 0)::int AS warn_count,
       CASE
         WHEN COALESCE(fatal_count, 0) > 0 THEN 'FATAL'
         WHEN COALESCE(error_count, 0) > 0 THEN 'ERROR'
         WHEN COALESCE(warn_count, 0) > 0 THEN 'WARN'
         ELSE 'INFO'
       END AS derived_level
FROM edoops.talend_logs_dashboard
WHERE execution_status NOT IN ('EXECUTION_SUCCESS', 'SUCCESS')
  AND start_timestamp >= NOW() - INTERVAL '{{days}} days'
ORDER BY start_timestamp DESC NULLS LAST;
```
