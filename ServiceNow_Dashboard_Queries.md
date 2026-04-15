# ServiceNow Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/servicenowDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `service_now_inc` | `edoops` | Incident records — priority, state, capability, description, assignment group, platform, timestamps |
| `service_now_chg` | `edoops` | Change records — priority, platform |
| `sla_glossary` | `edoops` | Maps raw `snow_priority` values to short labels (P1–P5) plus SLA targets and breach URL |

**Column prefix on `service_now_inc`:** `sninc_`  
**Column prefix on `service_now_chg`:** `snchg_`

**Key `service_now_inc` columns used:**

| Column | Description |
|---|---|
| `sninc_inc_num` | Incident number |
| `sninc_priority` | Raw priority value — joined to `sla_glossary.snow_priority` |
| `sninc_state` | Current state — used by `OPEN_INCIDENT_FILTER` |
| `sninc_applkp_pltf_nm` | Platform name — optional filter param |
| `sninc_capability` | Capability/team area |
| `sninc_short_desc` | Short description |
| `sninc_assignment_grp` | Assignment group |
| `sninc_opened_at` | Creation timestamp — used for elapsed-time SLA breach calc |
| `sninc_last_updt_dttm` | Last updated timestamp — used for rolling `days` window |

**`sla_glossary` columns:**

| Column | Description |
|---|---|
| `snow_priority` | Raw priority — joins to `sninc_priority` / `snchg_priority` |
| `short_priority` | Normalised label: `P1`–`P5` |
| `response_sla` | Response SLA target string (e.g. `"1 hr"`) |
| `resolution_sla` | Resolution SLA target string (e.g. `"4 hrs"`, `"1 day"`) |
| `details_url` | URL to SLA policy documentation |

---

## Query Helpers

### `OPEN_INCIDENT_FILTER`
Applied to every `service_now_inc` query. Excludes incidents whose state indicates closure:

```sql
COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
  ('closed', 'resolved', 'cancelled', 'canceled', 'complete', 'completed')
```

### `parseDays(?days=N)`
All incident endpoints accept an optional `?days=N` query parameter (default `7`, clamped `1`–`15`).  
The date window clause appended to every incident query:

```sql
AND sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
```

### SLA breach calculation
Used inside `missed-incidents` and `incident-detail` — compares elapsed hours since creation against the numeric portion of `resolution_sla`:

```sql
CASE
  WHEN EXTRACT(EPOCH FROM (NOW() - sn.sninc_opened_at::timestamp)) / 3600 >
       SUBSTRING(sg.resolution_sla, 1, POSITION(' ' IN sg.resolution_sla) - 1)::int *
       CASE WHEN sg.resolution_sla ILIKE '%day%' THEN 24
            WHEN sg.resolution_sla ILIKE '%hr%'  THEN 1
            ELSE 1 END
  THEN true
  ELSE false
END AS sla_breached
```

---

## 1. Open Incidents by Priority

### GET `/api/servicenow/incidents?platform=<value>&days=<n>`
Open incident count grouped by priority — KPI cards / bar chart.  
`platform` is optional; omitting it returns all platforms.

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_priority,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) sn
JOIN   edoops.sla_glossary sg ON sn.sninc_priority = sg.snow_priority
WHERE  1=1
  [AND sn.sninc_applkp_pltf_nm = $1]   -- only when ?platform= is supplied
GROUP BY sg.short_priority
ORDER BY CASE sg.short_priority
           WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
           WHEN 'P4' THEN 4 WHEN 'P5' THEN 5 ELSE 99
         END, sg.short_priority
```

**Response:** `[{ priority_field, incident_count }]`

---

## 2. Top Incidents by SLA

### GET `/api/servicenow/missed-incidents?platform=<value>&days=<n>`
Open incident counts for all priorities (P1–P5) with SLA metadata and breach flag — "Top Incidents by SLA" widget.

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count,
       COUNT(CASE WHEN sla_breached THEN 1 END)::int AS breached_count,
       MAX(sg.response_sla)   AS response_sla,
       MAX(sg.resolution_sla) AS resolution_sla,
       MAX(sg.details_url)    AS details_url
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
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) sn
JOIN   edoops.sla_glossary sg ON sn.sninc_priority = sg.snow_priority
WHERE  sg.short_priority IN ('P1','P2','P3','P4','P5')
  [AND sn.sninc_applkp_pltf_nm = $1]   -- only when ?platform= is supplied
GROUP BY sg.short_priority, sg.response_sla, sg.resolution_sla, sg.details_url
ORDER BY incident_count DESC,
         CASE sg.short_priority
           WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3
           WHEN 'P4' THEN 4 ELSE 99
         END, sg.short_priority
```

**Response:** `[{ priority_field, incident_count, breached_count, response_sla, resolution_sla, details_url }]`

---

## 3. Emergency Changes

### GET `/api/servicenow/emergency-changes?platform=<value>`
Open Emergency Change counts by priority — uses `service_now_chg`.  
Does **not** use the `days` window (no date column on change records).

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM   edoops.service_now_chg sn
JOIN   edoops.sla_glossary    sg
  ON   sn.snchg_priority = sg.snow_priority
WHERE  sg.short_priority IN ('P1','P2','P3')
  [AND sn.snchg_pltf_nm = $1]   -- only when ?platform= is supplied
GROUP BY sg.short_priority
ORDER BY sg.short_priority
```

**Response:** `[{ priority_field, incident_count }]`

---

## 4. Incident List (Table Widget)

### GET `/api/servicenow/incident-list?platform=<value>&days=<n>`
All open incident records (de-duplicated) — flat table widget.

```sql
SELECT sninc_inc_num, priority_field, sninc_capability,
       sninc_short_desc, sninc_assignment_grp
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_inc_num,
         sg.short_priority       AS priority_field,
         sn.sninc_capability,
         sn.sninc_short_desc,
         sn.sninc_assignment_grp,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  JOIN   edoops.sla_glossary    sg ON sn.sninc_priority = sg.snow_priority
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  1=1
  [AND latest.sninc_applkp_pltf_nm = $1]   -- only when ?platform= is supplied
```

**Response:** `[{ sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp }]`

---

## 5. Incident Detail (Drill-Down Modal)

### GET `/api/servicenow/incident-detail?priority=<P1|P2|P3|P4>&platform=<value>&days=<n>`
Full incident records for a given priority with SLA targets, elapsed time, and breach status.  
`priority` is optional (defaults to all of P1–P4); `platform` is optional.

```sql
SELECT sninc_inc_num, priority_field, sninc_capability, sninc_short_desc,
       sninc_assignment_grp, response_sla, resolution_sla,
       sninc_opened_at, sninc_last_updt_dttm,
       EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 AS elapsed_hours,
       CASE
         WHEN EXTRACT(EPOCH FROM (NOW() - sninc_opened_at::timestamp)) / 3600 >
              SUBSTRING(resolution_sla, 1, POSITION(' ' IN resolution_sla) - 1)::int *
              CASE WHEN resolution_sla ILIKE '%day%' THEN 24
                   WHEN resolution_sla ILIKE '%hr%'  THEN 1 ELSE 1 END
         THEN true ELSE false
       END AS sla_breached
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_inc_num,
         sg.short_priority       AS priority_field,
         sn.sninc_capability,
         sn.sninc_short_desc,
         sn.sninc_assignment_grp,
         sg.response_sla,
         sg.resolution_sla,
         sn.sninc_opened_at,
         sn.sninc_last_updt_dttm,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  JOIN   edoops.sla_glossary    sg ON sn.sninc_priority = sg.snow_priority
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  priority_field = ANY($1)
  [AND latest.sninc_applkp_pltf_nm = $2]   -- only when ?platform= is supplied
```

**Parameters:**
- `$1` = `string[]` — e.g. `['P1']` or `['P1','P2','P3','P4']`
- `$2` = platform name string (only present when `?platform=` is supplied)

**Response:** `[{ sninc_inc_num, priority_field, sninc_capability, sninc_short_desc, sninc_assignment_grp, response_sla, resolution_sla, sninc_opened_at, sninc_last_updt_dttm, elapsed_hours, sla_breached }]`

---

## 6. Incidents by Capability

### GET `/api/servicenow/by-capability?platform=<value>&days=<n>`
Open incident counts grouped by capability — top 10, bar chart.

```sql
SELECT sninc_capability AS capability,
       COUNT(*)::int    AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_capability,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  sninc_capability IS NOT NULL
  [AND latest.sninc_applkp_pltf_nm = $1]   -- only when ?platform= is supplied
GROUP BY sninc_capability
ORDER BY incident_count DESC
LIMIT 10
```

**Response:** `[{ capability, incident_count }]`

---

## 7. Incidents by Assignment Group

### GET `/api/servicenow/by-assignment-group?platform=<value>&days=<n>`
Open incident counts grouped by assignment group — top 10, bar chart.

```sql
SELECT sninc_assignment_grp AS assignment_group,
       COUNT(*)::int        AS incident_count
FROM (
  SELECT DISTINCT ON (sn.sninc_inc_num)
         sn.sninc_assignment_grp,
         sn.sninc_applkp_pltf_nm
  FROM   edoops.service_now_inc sn
  WHERE  COALESCE(LOWER(TRIM(sn.sninc_state)), '') NOT IN
           ('closed','resolved','cancelled','canceled','complete','completed')
    AND  sn.sninc_last_updt_dttm::timestamp >= NOW() - INTERVAL '<N> days'
  ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC
) latest
WHERE  sninc_assignment_grp IS NOT NULL
  [AND latest.sninc_applkp_pltf_nm = $1]   -- only when ?platform= is supplied
GROUP BY sninc_assignment_grp
ORDER BY incident_count DESC
LIMIT 10
```

**Response:** `[{ assignment_group, incident_count }]`

---

## 8. Platform List

### GET `/api/servicenow/platforms?days=<n>`
All distinct non-null platform names with a flag indicating whether any active P1/P2 incidents exist for that platform.  
No open-incident filter applied — returns every platform that has ever had a record.

```sql
SELECT DISTINCT sn.sninc_applkp_pltf_nm AS platform,
       BOOL_OR(sg.short_priority IN ('P1','P2')) AS has_critical
FROM   edoops.service_now_inc sn
LEFT JOIN edoops.sla_glossary sg
  ON sn.sninc_priority = sg.snow_priority
WHERE  sn.sninc_applkp_pltf_nm IS NOT NULL
GROUP BY sn.sninc_applkp_pltf_nm
ORDER BY sn.sninc_applkp_pltf_nm
```

**Response:** `[{ platform, hasCritical }]`  
(`hasCritical` is `true` when `has_critical = true` in the DB result.)

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Platform filter**: All incident endpoints accept an optional `?platform=<name>` param. No value = all platforms. No hardcoded `LIKE 'BI%'` restriction.
- **Open-incident detection**: `OPEN_INCIDENT_FILTER` constant — excludes records where `sninc_state` is any variation of closed/resolved/cancelled/complete.
- **Date window**: `parseDays()` accepts `?days=1–15` (default 7). Applied as `sninc_last_updt_dttm >= NOW() - INTERVAL '<N> days'`.
- **Deduplication**: All incident queries use `DISTINCT ON (sn.sninc_inc_num) ... ORDER BY sn.sninc_inc_num, sn.sninc_last_updt_dttm DESC` to keep only the latest row per incident number.
- **Priority mapping**: `sla_glossary` translates raw `sninc_priority` / `snchg_priority` into standardised labels P1–P5.
- **SLA breach**: Computed at query time — `elapsed_hours` = `EXTRACT(EPOCH FROM (NOW() - sninc_opened_at)) / 3600`; compared against the numeric prefix of `resolution_sla` scaled by a unit multiplier (hrs vs days).
- **Parameterisation**: `incident-detail` uses `ANY($1)` with a text array for the priority list. Platform params use positional `$N` to prevent SQL injection.
