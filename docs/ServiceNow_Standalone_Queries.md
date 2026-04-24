# ServiceNow Dashboard — Standalone Queries

Schema: `edoops` · PostgreSQL
Tables: `edoops.service_now_inc` (prefix `sninc_`), `edoops.sla_glossary`, `edoops.service_now_chg` (prefix `snchg_`)

Open states: `new`, `In Progress`, `On Hold`
Inactive states: `Closed`, `Resolved`, `Canceled`

Replace `7` with desired days. Uncomment the platform `AND` clause to filter by platform.

---

## 1. Open Incidents by Priority

Widget: KPI cards + donut chart showing currently open incidents grouped by priority.
Slider: Not affected. Always reflects live open state.

```sql
SELECT sg.short_priority AS priority,
       COUNT(*)::int     AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_priority
  FROM   edoops.service_now_inc sn
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
    -- AND sn.sninc_applkp_pltf_nm = 'PLATFORM_NAME'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) sn
JOIN edoops.sla_glossary sg ON sn.sninc_priority = sg.snow_priority
GROUP BY sg.short_priority
ORDER BY CASE sg.short_priority
           WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
           WHEN 'P4' THEN 4 WHEN 'P5' THEN 5 ELSE 99
         END;
```

---

## 2. Top Incidents by SLA

Widget: Bar chart with incident counts and SLA breach indicators per priority, for incidents opened in the last N days.
Slider: Controls opened-date window.

```sql
SELECT sg.short_priority                                    AS priority,
       COUNT(*)::int                                        AS incident_count,
       COUNT(CASE WHEN sla_breached THEN 1 END)::int        AS breached_count,
       MAX(sg.response_sla)                                 AS response_sla,
       MAX(sg.resolution_sla)                               AS resolution_sla
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_priority,
         sn.sninc_applkp_pltf_nm,
         CASE
           WHEN EXTRACT(EPOCH FROM (NOW() - sn.sninc_opened_at::timestamp)) / 3600 >
                SUBSTRING(sg.resolution_sla, 1, POSITION(' ' IN sg.resolution_sla) - 1)::int *
                CASE WHEN sg.resolution_sla ILIKE '%day%' THEN 24
                     WHEN sg.resolution_sla ILIKE '%hr%'  THEN 1 ELSE 1 END
           THEN true ELSE false
         END AS sla_breached
  FROM   edoops.service_now_inc sn
  JOIN   edoops.sla_glossary sg ON sn.sninc_priority = sg.snow_priority
  WHERE  sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '7 days'
    -- AND sn.sninc_applkp_pltf_nm = 'PLATFORM_NAME'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) sn
JOIN edoops.sla_glossary sg ON sn.sninc_priority = sg.snow_priority
WHERE sg.short_priority IN ('P1', 'P2', 'P3', 'P4', 'P5')
GROUP BY sg.short_priority, sg.response_sla, sg.resolution_sla
ORDER BY incident_count DESC;
```

---

## 3. All Incidents (Active During Period)

Widget: Searchable table of all incidents active at any point in the last N days.
Slider: Controls activity window. Includes open incidents (any age) + incidents closed or resolved within the window.

```sql
SELECT latest.sninc_inc_num,
       sg.short_priority       AS priority,
       latest.sninc_state,
       latest.sninc_capability,
       latest.sninc_short_desc,
       latest.sninc_assignment_grp
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_inc_num,
         sn.sninc_priority,
         sn.sninc_state,
         sn.sninc_capability,
         sn.sninc_short_desc,
         sn.sninc_assignment_grp,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE (
    COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN ('closed', 'resolved', 'canceled')
    OR sn.sninc_closed_at::timestamp >= NOW() - INTERVAL '7 days'
    OR COALESCE(sn.sninc_resolved_at, sn.sninc_last_updt_dttm)::timestamp >= NOW() - INTERVAL '7 days'
  )
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
JOIN edoops.sla_glossary sg ON latest.sninc_priority = sg.snow_priority
WHERE 1=1
  -- AND latest.sninc_applkp_pltf_nm = 'PLATFORM_NAME'
;
```

---

## 4. Incidents by Capability

Widget: Donut chart showing top 10 capabilities by incident count for incidents opened in the last N days.
Slider: Controls opened-date window.

```sql
SELECT sninc_capability AS capability,
       COUNT(*)::int    AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_capability,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE  sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '7 days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  sninc_capability IS NOT NULL
  -- AND sninc_applkp_pltf_nm = 'PLATFORM_NAME'
GROUP BY sninc_capability
ORDER BY incident_count DESC
LIMIT 10;
```

---

## 5. Incidents by Assignment Group

Widget: Donut chart showing top 10 assignment groups by incident count for incidents opened in the last N days.
Slider: Controls opened-date window.

```sql
SELECT sninc_assignment_grp AS assignment_group,
       COUNT(*)::int        AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_assignment_grp,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE  sn.sninc_opened_at::timestamp >= NOW() - INTERVAL '7 days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  sninc_assignment_grp IS NOT NULL
  -- AND sninc_applkp_pltf_nm = 'PLATFORM_NAME'
GROUP BY sninc_assignment_grp
ORDER BY incident_count DESC
LIMIT 10;
```

---

## 6. Incident Volume by Day

Widget: Bar + line trend chart showing daily open vs closed activity over the last N days.
Slider: Controls last-updated window. Uses sninc_last_updt_dttm to capture day-by-day state transitions.

```sql
SELECT day,
       SUM(CASE WHEN is_open     THEN 1 ELSE 0 END)::int AS open,
       SUM(CASE WHEN NOT is_open THEN 1 ELSE 0 END)::int AS closed,
       COUNT(*)::int                                      AS total
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num, DATE(sn.sninc_last_updt_dttm::timestamp))
         DATE(sn.sninc_last_updt_dttm::timestamp)                             AS day,
         COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed', 'resolved', 'canceled')                                 AS is_open
  FROM   edoops.service_now_inc sn
  WHERE  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '7 days'
    -- AND sn.sninc_applkp_pltf_nm = 'PLATFORM_NAME'
  ORDER BY sn.sninc_inc_num, DATE(sn.sninc_last_updt_dttm::timestamp), sn.sninc_last_updt_dttm DESC
) latest_per_day
GROUP BY day
ORDER BY day;
```

---

## 7. Emergency Changes

Widget: KPI cards showing open emergency change counts for P1/P2/P3.
Slider: Not affected. No date filter applied.

```sql
SELECT sg.short_priority AS priority,
       COUNT(*)::int     AS change_count
FROM   edoops.service_now_chg sn
JOIN   edoops.sla_glossary sg ON sn.snchg_priority = sg.snow_priority
WHERE  sg.short_priority IN ('P1', 'P2', 'P3')
  -- AND sn.snchg_pltf_nm = 'PLATFORM_NAME'
GROUP BY sg.short_priority
ORDER BY sg.short_priority;
```
