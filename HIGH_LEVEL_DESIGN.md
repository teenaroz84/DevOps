# High-Level Design (HLD) - DataOps Application

## 1. What This App Is (In Simple Terms)
This application is a central control room for DataOps teams.

It helps users:
- See the health of data platforms (DMF, ESP, ServiceNow, Talend, Snowflake)
- Track incidents, failures, costs, and job runs
- Ask AI agents questions in plain English for each platform
- Switch between live data and mock data for demos/testing

Think of it as a "single dashboard + assistant" for data operations.

---

## 2. Big Picture Architecture
The system has two main parts:

1. **UI (Frontend)**
- Built with React + TypeScript
- Runs in browser
- Shows dashboards, charts, tables, and chat panels

2. **Server (Backend)**
- Built with Node.js + Express + TypeScript
- Exposes API endpoints for dashboards and chat
- Reads from PostgreSQL-backed datasets and DynamoDB session storage (for chat history)

At runtime:
- Browser calls API endpoints
- Server fetches data from DB sources (or mock data paths where configured)
- Browser renders widgets and charts

---

## 3. UI Design (Frontend)

## 3.1 Main UI Areas
The frontend has three key experiences:

1. **Executive Dashboard**
- Main screen with source tabs: Overview, ServiceNow, ESP, DMF, Talend, Snowflake
- Each source has focused widgets

2. **Agent Chat Experience**
- Floating draggable chat panel from dashboards
- Full-screen chat pages from left navigation for each agent
- "Back to Dashboard" returns to the relevant dashboard tab

3. **Navigation + Preferences**
- Left sidebar for dashboards and agent menu items
- Preferences and layout persistence in local storage

## 3.2 Frontend Structure (Important Files)
- `client/src/App.tsx`
  - Root app orchestration
  - Handles active menu, fullscreen chat routing, and dashboard tab return behavior
- `client/src/components/layout/Navigation.tsx`
  - Sidebar and menu rendering
- `client/src/components/dashboard/ExecutiveDashboard.tsx`
  - Top-level executive dashboard shell and source tabs
- `client/src/components/dashboard/*`
  - Per-domain dashboard widgets (DMF, ESP, ServiceNow, Talend, Snowflake)
- `client/src/components/chat/ChatPanel.tsx`
  - Floating + fullscreen chat UI
  - Session restore and save behavior
- `client/src/config/agentConfig.ts`
  - Agent catalog (name, color, endpoint, menu labels, quick actions)

## 3.3 State and UX Rules
- **Dashboard selection state** is managed centrally so the UI can return users to the correct context.
- **Chat panel state** supports:
  - Open/close per agent
  - Full-screen mode from menu
  - Draggable floating panel (desktop)
- **Session history**:
  - Fast initial load from browser local storage
  - Then hydrated/synced via backend session API

---

## 4. Server Design (Backend)

## 4.1 Backend Responsibilities
The server does four main jobs:

1. Serve API endpoints for dashboard widgets
2. Aggregate and shape data for UI-friendly responses
3. Handle chat request/response endpointing
4. Persist/retrieve chat session history

## 4.2 Backend Entry and Route Modules
- `server/src/index.ts`
  - Express app setup, CORS, middleware, route mounting
- Route modules under `server/src/routes/`
  - `esp.ts`
  - `servicenowDb.ts`
  - `dmfDb.ts`
  - `talendDb.ts`
  - `postgresDb.ts`
  - `session.ts`

## 4.3 API Style
- REST-style JSON endpoints under `/api/...`
- Some endpoints stream NDJSON for faster progressive loading (ESP platform summary)
- Most routes support filtering via query params (platform, search, days, limit, offset)

## 4.4 Session Storage
- Chat sessions are persisted through `/api/sessions/:sessionId/:agentId`
- Session schema aligns with deployed runtime expectations:
  - `session_id` + `agent_id` keys
  - serialized message history + timestamps/TTL

---

## 5. Data and Query Design

## 5.1 Data Sources
Main operational data comes from PostgreSQL tables in the `edoops` schema.

Examples:
- ESP job and dependency data
- ServiceNow incidents/changes
- DMF run and trend data
- Talend execution metrics

## 5.2 Query Strategy
The app is designed for responsiveness:
- Heavy dashboards use server-side aggregation
- Expensive lists are paginated (e.g., ESP job list, applibs)
- For large datasets, API separates "summary" and "details" to avoid blocking UI

## 5.3 Mock vs Live Mode
- Mock mode allows demos and development without depending on live systems
- Live mode queries backend routes directly
- Sidebar toggle lets users switch quickly

---

## 6. Chat and Agent Design

## 6.1 Agent Model
Each domain has an agent configuration:
- Knowledge
- ESP
- DMF
- ServiceNow
- Talend
- Snowflake

Each agent defines:
- Display name and color
- API endpoint
- Welcome message
- Quick action prompts

## 6.2 Chat UX Patterns
- Full-screen chats from menu (primary assistant mode)
- Floating panel chats from dashboard widgets (contextual mode)
- Draggable panel on desktop for better side-by-side use

---

## 7. Security and Access (Current Design)
- CORS controls are enabled in server middleware
- API input checks exist on important endpoints (required params, bounds)
- No direct DB credentials in frontend
- Backend acts as controlled gateway between UI and data stores

Note: Enterprise-grade auth/authorization can be layered in later if required.

---

## 8. Performance and Reliability

Current performance patterns:
- Use of efficient SQL patterns (dedup + aggregation)
- Server-side filtering and pagination to reduce payload size
- Progressive loading for large summary sets
- Graceful handling when remote/session stores are temporarily unavailable

Expected UX result:
- Faster first paint on dashboards
- Widgets load in priority order
- Large tables avoid freezing browser

---

## 9. Deployment View

## 9.1 Local Development
- Frontend on Vite dev server
- Backend on Express dev server
- Combined startup via root scripts (`npm run dev`)

## 9.2 Cloud/Serverless Artifacts
Repository also includes AWS-oriented artifacts:
- `template.yaml`
- `lambdas/*`

This supports packaging APIs/functions for serverless deployment paths where needed.

---

## 10. Typical End-to-End User Flow

Example (ServiceNow):
1. User opens Executive Dashboard
2. Clicks ServiceNow tab
3. UI calls `/api/servicenow/...` endpoints
4. Server runs SQL and returns open-incident-focused data
5. User opens ServiceNow agent chat
6. User asks natural-language question
7. Chat response appears and session is saved

---

## 11. Glossary (Layman Friendly)
- **Frontend/UI**: What users see and click in browser
- **Backend/Server**: The middle layer that fetches and prepares data
- **API**: A URL endpoint the UI calls to get data
- **Route**: A specific API path (like `/api/esp/platform-summary`)
- **Pagination**: Loading data in chunks instead of all at once
- **Mock Data**: Fake sample data used for demos/testing
- **Live Data**: Real operational data from connected systems
- **NDJSON**: A streaming JSON format that sends rows gradually

---

## 12. Summary
This app is designed as a practical, user-friendly DataOps command center:
- Clear dashboards for each data domain
- AI assistants for faster troubleshooting and analysis
- Server-side query and API design focused on speed and clarity
- Architecture that supports both local development and cloud-style deployment

If needed, this HLD can be expanded into:
- Detailed sequence diagrams
- Data dictionary per endpoint
- Non-functional requirements (SLOs, scaling targets, security controls)
