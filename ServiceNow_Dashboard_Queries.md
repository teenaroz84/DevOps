# ServiceNow Dashboard — Live Data Queries

All queries run against **PostgreSQL** via `getPgPool()` in `server/src/routes/servicenowDb.ts`.

## Tables Referenced

| Table | Schema | Description |
|---|---|---|
| `service_now_inc` | `edoops` | Incident records — priority, capability, description, assignment group |
| `service_now_chg` | `edoops` | Change records — priority, platform |
| `sla_glossary` | `edoops` | Maps raw `snow_priority` values to short labels (P1–P4) |

Column prefix on `service_now_inc`: `sninc_`  
Column prefix on `service_now_chg`: `snchg_`

All queries filter to `LIKE 'BI%'` platform records.

---

## 1. Priority Summary Cards

### GET `/api/servicenow/incidents`
Open P1/P2/P3 incident counts — displayed as KPI cards or bar chart.

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM   edoops.service_now_inc sn
JOIN   edoops.sla_glossary    sg
  ON   sn.sninc_priority = sg.snow_priority
WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
  AND  sg.short_priority IN ('P1','P2','P3')
GROUP BY sg.short_priority
ORDER BY sg.short_priority
```

---

### GET `/api/servicenow/missed-incidents`
Open P3/P4 incident counts — "missed SLA" bar chart.

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM   edoops.service_now_inc sn
JOIN   edoops.sla_glossary    sg
  ON   sn.sninc_priority = sg.snow_priority
WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
  AND  sg.short_priority IN ('P3','P4')
GROUP BY sg.short_priority
ORDER BY sg.short_priority
```

---

### GET `/api/servicenow/emergency-changes`
Open Emergency Change counts by priority.

```sql
SELECT sg.short_priority AS priority_field,
       COUNT(*)::int     AS incident_count
FROM   edoops.service_now_chg sn
JOIN   edoops.sla_glossary    sg
  ON   sn.snchg_priority = sg.snow_priority
WHERE  sn.snchg_pltf_nm LIKE 'BI%'
  AND  sg.short_priority IN ('P1','P2','P3')
GROUP BY sg.short_priority
ORDER BY sg.short_priority
```

---

## 2. Incident Detail Tables

### GET `/api/servicenow/incident-list`
Detailed P3/P4 incident records for the incidents table widget.

```sql
SELECT sn.sninc_inc_num        AS sninc_inc_num,
       sg.short_priority       AS priority_field,
       sn.sninc_capability     AS sninc_capability,
       sn.sninc_short_desc     AS sninc_short_desc,
       sn.sninc_assignment_grp AS sninc_assignment_grp
FROM   edoops.service_now_inc sn
JOIN   edoops.sla_glossary    sg
  ON   sn.sninc_priority = sg.snow_priority
WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
  AND  sg.short_priority IN ('P3','P4')
ORDER BY sg.short_priority, sn.sninc_inc_num
LIMIT 200
```

---

### GET `/api/servicenow/incident-detail?priority=<P1|P2|P3|P4>`
Full incident records for a given priority — used by drill-down modals.  
`priority` query param is optional; defaults to all priorities P1–P4.

```sql
SELECT sn.sninc_inc_num        AS sninc_inc_num,
       sg.short_priority       AS priority_field,
       sn.sninc_capability     AS sninc_capability,
       sn.sninc_short_desc     AS sninc_short_desc,
       sn.sninc_assignment_grp AS sninc_assignment_grp
FROM   edoops.service_now_inc sn
JOIN   edoops.sla_glossary    sg
  ON   sn.sninc_priority = sg.snow_priority
WHERE  sn.sninc_applkp_pltf_nm LIKE 'BI%'
  AND  sg.short_priority = ANY($1)
ORDER BY sg.short_priority, sn.sninc_inc_num
LIMIT 500
```

**Parameter:** `$1` = `string[]` — e.g. `['P1']` or `['P1','P2','P3','P4']`

---

## Implementation Notes

- **Connection**: `getPgPool()` from `server/src/db/postgres.ts`
- **Platform filter**: All queries are scoped to `sninc_applkp_pltf_nm LIKE 'BI%'` (BI platform incidents/changes only)
- **Priority mapping**: `sla_glossary` translates raw numeric/text `snow_priority` values into standardised short labels `P1`–`P4`
- **Row limits**: `incident-list` caps at 200 rows; `incident-detail` caps at 500 rows
- **Parameterisation**: `incident-detail` uses `ANY($1)` with a text array to safely accept multiple priority values
