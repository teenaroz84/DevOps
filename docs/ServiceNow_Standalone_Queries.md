# ServiceNow Standalone Queries

Schema: `edoops`

Tables:
- `edoops.service_now_inc`
- `edoops.sla_glossary`
- `edoops.service_now_chg`

Replace these placeholders before running:
- `{{platform_name}}`: platform value from `sninc_applkp_pltf_nm` or `snchg_pltf_nm`
- `{{days}}`: lookback window, for example `7`
- `{{priority_list}}`: one or more short priorities, for example `'P1','P2'`

If you do not want platform filtering, remove the platform predicate line entirely.

## Open Incidents by Priority

Used by: `/api/servicenow/incidents`

```sql
select sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
from (
  select snc.sninc_inc_num,
         snc.sninc_priority,
         snc.sninc_applkp_pltf_nm
  from (
    SELECT sninc_inc_num,
           sninc_priority,
           sninc_applkp_pltf_nm,
           sninc_state,
           sninc_last_updt_dttm,
           ROW_NUMBER() over(
             partition by sninc_inc_num
             order by sninc_last_updt_dttm desc
           ) as latest_rec
    FROM edoops.service_now_inc
  ) sn
  WHERE sn.latest_rec = 1
    AND sn.sninc_applkp_pltf_nm IS NOT NULL
    AND sn.sninc_applkp_pltf_nm = '{{platform_name}}'
    AND COALESCE(LOWER(TRIM(sn.sninc_state)), '') IN ('new','in progress','on hold')
) snc
JOIN edoops.sla_glossary sg ON snc.sninc_priority = sg.snow_priority
GROUP BY sg.short_priority
ORDER BY CASE sg.short_priority
  WHEN 'P1' THEN 1
  WHEN 'P2' THEN 2
  WHEN 'P3' THEN 3
  WHEN 'P4' THEN 4
  WHEN 'P5' THEN 5
  ELSE 99
END, sg.short_priority;
```

## Missed Incidents by Priority

Used by: `/api/servicenow/missed-incidents`

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int AS incident_count,
       COUNT(CASE WHEN sla_breached THEN 1 END)::int AS breached_count,
       MAX(sg.response_sla) AS response_sla,
       MAX(sg.resolution_sla) AS resolution_sla,
       MAX(sg.details_url) AS details_url
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_priority,
         sn.sninc_applkp_pltf_nm,
         CASE
           WHEN EXTRACT(EPOCH FROM (NOW() - sn.sninc_opened_at::timestamp)) / 3600 >
                SUBSTRING(sg.resolution_sla, 1, POSITION(' ' IN sg.resolution_sla) - 1)::int *
                CASE WHEN sg.resolution_sla ILIKE '%day%' THEN 24
                     WHEN sg.resolution_sla ILIKE '%hr%' THEN 1
                     ELSE 1 END
           THEN true
           ELSE false
         END AS sla_breached
  FROM edoops.service_now_inc sn
  JOIN edoops.sla_glossary sg
    ON sn.sninc_priority = sg.snow_priority
  WHERE sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '{{days}} days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) sn
JOIN edoops.sla_glossary sg
  ON sn.sninc_priority = sg.snow_priority
WHERE sg.short_priority IN ('P1', 'P2', 'P3', 'P4', 'P5')
  AND sn.sninc_applkp_pltf_nm IS NOT NULL
  AND sn.sninc_applkp_pltf_nm = '{{platform_name}}'
GROUP BY sg.short_priority, sg.response_sla, sg.resolution_sla, sg.details_url
ORDER BY incident_count DESC,
  CASE sg.short_priority
    WHEN 'P1' THEN 1
    WHEN 'P2' THEN 2
    WHEN 'P3' THEN 3
    WHEN 'P4' THEN 4
    ELSE 99
  END, sg.short_priority;
```

## Incident List

Used by: `/api/servicenow/incident-list`

```sql
SELECT latest.sninc_inc_num,
       sg.short_priority AS priority_field,
       latest.sninc_state,
       latest.sninc_opened_at,
       latest.sninc_last_updt_dttm,
       latest.sninc_capability,
       latest.sninc_short_desc,
       latest.sninc_assignment_grp
FROM (
  select * from (
    SELECT sninc_inc_num,
           sninc_priority,
           sninc_state,
           sninc_capability,
           sninc_short_desc,
           sninc_opened_at,
           sninc_assignment_grp,
           sninc_applkp_pltf_nm,
           sninc_closed_at,
           sninc_resolved_at,
           sninc_last_updt_dttm,
           ROW_NUMBER() over(
             partition by sninc_inc_num
             order by sninc_last_updt_dttm desc
           ) as latest_rec
    FROM edoops.service_now_inc
  ) sn
  WHERE sn.latest_rec = 1
    AND sn.sninc_applkp_pltf_nm IS NOT NULL
    AND (
      COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
      OR sn.sninc_closed_at::timestamp >= NOW() - INTERVAL '{{days}} days'
      OR (COALESCE(sn.sninc_resolved_at, sn.sninc_last_updt_dttm)::timestamp >= NOW() - INTERVAL '{{days}} days')
    )
  ORDER BY sn.sninc_opened_at, sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
JOIN edoops.sla_glossary sg ON latest.sninc_priority = sg.snow_priority
WHERE latest.sninc_applkp_pltf_nm = '{{platform_name}}';
```

## Emergency Changes

Used by: `/api/servicenow/emergency-changes`

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM edoops.service_now_chg sn
JOIN edoops.sla_glossary sg
  ON sn.snchg_priority = sg.snow_priority
WHERE sg.short_priority IN ('P1','P2','P3')
  AND sn.snchg_pltf_nm = '{{platform_name}}'
GROUP BY sg.short_priority
ORDER BY sg.short_priority;
```

## Incident Detail by Priority

Used by: `/api/servicenow/incident-detail`

```sql
SELECT sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp, response_sla, resolution_sla,
       sninc_opened_at, sninc_last_updt_dttm,
       EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 AS elapsed_hours,
       CASE
         WHEN EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 >
              SUBSTRING(resolution_sla, 1, POSITION(' ' IN resolution_sla) - 1)::int *
              CASE WHEN resolution_sla ILIKE '%day%' THEN 24
                   WHEN resolution_sla ILIKE '%hr%' THEN 1
                   ELSE 1 END
         THEN true
         ELSE false
       END AS sla_breached
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_inc_num        AS sninc_inc_num,
         sg.short_priority       AS priority_field,
         sn.sninc_capability     AS sninc_capability,
         sn.sninc_short_desc     AS sninc_short_desc,
         sn.sninc_assignment_grp AS sninc_assignment_grp,
         sg.response_sla         AS response_sla,
         sg.resolution_sla       AS resolution_sla,
         sn.sninc_opened_at      AS sninc_opened_at,
         sn.sninc_last_updt_dttm AS sninc_last_updt_dttm,
         sn.sninc_applkp_pltf_nm
  FROM edoops.service_now_inc sn
  JOIN edoops.sla_glossary sg
    ON sn.sninc_priority = sg.snow_priority
  WHERE COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE priority_field IN ({{priority_list}})
  AND latest.sninc_applkp_pltf_nm = '{{platform_name}}';
```

## By Capability

Used by: `/api/servicenow/by-capability`

```sql
select sninc_capability AS capability,
       COUNT(*)::int AS incident_count
FROM (
  select sn.sninc_inc_num,
         sn.sninc_capability,
         sn.sninc_applkp_pltf_nm
  from (
    SELECT sninc_inc_num,
           sninc_capability,
           sninc_applkp_pltf_nm,
           sninc_opened_at,
           ROW_NUMBER() over(
             partition by sninc_inc_num
             order by sninc_last_updt_dttm desc
           ) as latest_rec
    FROM edoops.service_now_inc
  ) sn
  WHERE sn.latest_rec = 1
    AND sn.sninc_applkp_pltf_nm IS NOT NULL
    AND sn.sninc_applkp_pltf_nm = '{{platform_name}}'
    AND sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '{{days}} days'
    AND sn.sninc_capability IS NOT NULL
)
GROUP BY sninc_capability
ORDER BY incident_count DESC
LIMIT 10;
```

## By Assignment Group

Used by: `/api/servicenow/by-assignment-group`

```sql
select sninc_assignment_grp AS assignment_group,
       COUNT(*)::int AS incident_count
FROM (
  select sn.sninc_inc_num,
         sn.sninc_assignment_grp,
         sn.sninc_applkp_pltf_nm
  from (
    SELECT sninc_inc_num,
           sninc_assignment_grp,
           sninc_applkp_pltf_nm,
           sninc_opened_at,
           ROW_NUMBER() over(
             partition by sninc_inc_num
             order by sninc_last_updt_dttm desc
           ) as latest_rec
    FROM edoops.service_now_inc
  ) sn
  WHERE sn.latest_rec = 1
    AND sn.sninc_applkp_pltf_nm IS NOT NULL
    AND sn.sninc_applkp_pltf_nm = '{{platform_name}}'
    AND sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '{{days}} days'
    AND sn.sninc_assignment_grp IS NOT NULL
)
GROUP BY sninc_assignment_grp
ORDER BY incident_count DESC
LIMIT 10;
```

## Incident Trend

Used by: `/api/servicenow/incident-trend`

```sql
SELECT
  TO_CHAR(day, 'YYYY-MM-DD') AS day,
  SUM(CASE WHEN is_open THEN 1 ELSE 0 END)::int AS open_count,
  SUM(CASE WHEN NOT is_open THEN 1 ELSE 0 END)::int AS closed_count,
  SUM(CASE WHEN is_priority_1_2 THEN 1 ELSE 0 END)::int AS p1_p2_count,
  COUNT(*)::int AS total_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num, DATE(sn.sninc_last_updt_dttm::timestamp))
         DATE(sn.sninc_last_updt_dttm::timestamp) AS day,
         sg.short_priority IN ('P1', 'P2') AS is_priority_1_2,
         COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed','resolved','canceled') AS is_open
  FROM edoops.service_now_inc sn
  LEFT JOIN edoops.sla_glossary sg
    ON sn.sninc_priority = sg.snow_priority
  WHERE sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '{{days}} days'
    AND sn.sninc_applkp_pltf_nm = '{{platform_name}}'
  ORDER BY sn.sninc_inc_num, DATE(sn.sninc_last_updt_dttm::timestamp), sn.sninc_last_updt_dttm DESC
) latest_per_day
GROUP BY day
ORDER BY day;
```

## Platform List

Used by: `/api/servicenow/platforms`

```sql
SELECT DISTINCT sn.sninc_applkp_pltf_nm AS platform,
       BOOL_OR(sg.short_priority IN ('P1','P2')) AS has_critical
FROM edoops.service_now_inc sn
LEFT JOIN edoops.sla_glossary sg
  ON sn.sninc_priority = sg.snow_priority
WHERE sn.sninc_applkp_pltf_nm IS NOT NULL
GROUP BY sn.sninc_applkp_pltf_nm
ORDER BY sn.sninc_applkp_pltf_nm;
```
