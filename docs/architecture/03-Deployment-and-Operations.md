# Deployment and Operations

## Local Development

### Start Commands

- npm run dev: starts client and server
- npm run dev:server: starts Express server
- npm run dev:client: starts Vite frontend

### Default URLs

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Serverless Deployment Path

Repository includes AWS deployment artifacts:

- template.yaml (SAM template)
- lambdas/* (Lambda handlers)
- deploy.sh (build and deployment helper)

## Session Persistence Configuration

### Key Environment Variables

- SESSIONS_TABLE: DynamoDB table name used by session route
- AWS_REGION: region for DynamoDB client
- DEBUG_SESSIONS: set to 1 for verbose session logs
- Optional key overrides:
  - SESSIONS_PARTITION_KEY or SESSIONS_PK
  - SESSIONS_SORT_KEY or SESSIONS_SK

## Diagnostic Endpoints

Session diagnostics are available under:

- GET /api/sessions/diagnostic/health
- GET /api/sessions/diagnostic/dynamodb
- GET /api/sessions/diagnostic/sample-item

Use these to validate:

- Active table name
- Region and credentials visibility
- Key schema interpretation
- Read connectivity and sample item shape

## Operational Risks and Mitigations

### Risk: Wrong table name configured

- Symptom: persisted false or resource-not-found errors
- Mitigation: set correct SESSIONS_TABLE and verify via diagnostic health endpoint

### Risk: Key schema mismatch

- Symptom: key element does not match schema
- Mitigation: keep key auto-detection enabled and verify schema from diagnostic response

### Risk: Session history appears empty after switching agents

- Symptom: agent history not restored consistently
- Mitigation: use agent-aware sort-key strategy and latest-agent-item lookup logic

## Recommended Production Hardening

- Add authentication and derive user identity server-side
- Move from tab-scoped session IDs to user-scoped session bootstrap endpoint
- Add structured logging and request correlation IDs
- Add API-level metrics and alerting for session persistence failures
- Add integration tests for multi-agent session switching scenarios
