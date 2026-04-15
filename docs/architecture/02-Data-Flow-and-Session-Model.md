# Data Flow and Session Model

## Dashboard Data Flow

1. User selects a dashboard tab or filter.
2. Frontend calls a domain endpoint under /api.
3. Backend validates params and executes SQL.
4. Backend returns transformed JSON for widgets/tables/charts.
5. Frontend updates visual components.

## ESP Pagination Example

ESP platform job list uses offset-based pagination:

- Endpoint pattern: /api/esp/platform-job-list/:platformId?limit=N&offset=N
- limit controls page size
- offset controls how many rows to skip
- hasMore indicates whether additional fetches are available

## Chat Session Data Flow

1. Frontend determines session ID from sessionStorage (dataops-session-id).
2. Frontend opens an agent chat panel.
3. Frontend requests history via GET /api/sessions/:sessionId/:agentId.
4. Backend loads most recent matching records from DynamoDB.
5. Frontend renders hydrated message history.
6. On each message change, frontend sends POST to save updated history.

## Session Identity Strategy

Current implementation uses:

- One session ID per browser tab
- One logical chat stream per agent inside that session

This means a single tab can keep separate history per agent while sharing one session identifier.

## DynamoDB Session Storage Strategy

The session route supports dynamic key schemas by inspecting table metadata.

### Write Behavior

- For agent_id sort-key schemas, one item per session+agent is updated.
- For timestamp sort-key schemas (for example session_id_timestamp), writes create versioned rows.
- Sort key generation for timestamp schemas includes agent prefix to support fast agent-specific lookup.

### Read Behavior

- Reads by exact key when sort key is agent_id.
- For timestamp schemas, backend resolves latest item for the requested agent.

### Delete Behavior

- Deletes exact key for agent_id schemas.
- For timestamp schemas, deletes latest matching item for requested agent.

## Failure and Recovery Notes

- If DynamoDB write fails, API returns persisted false with diagnostics.
- Diagnostic endpoints help verify table, key schema, and sample item shape.
- Frontend logs session save failures to browser console for troubleshooting.
