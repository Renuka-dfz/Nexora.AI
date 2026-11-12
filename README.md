# Nexora.AI

**Company-aware multi-agent AI platform for marketing automation, business intelligence, and lead qualification.**

> **Project status:** MVP development · **Team:** 3 developers · **Schedule:** 4 development weeks + 1 testing/UAT week · **Architecture:** Modular, single-tenant, local-first with Docker Compose.

## 1. Goals and MVP Scope

Nexora.AI turns authorized company website knowledge into grounded marketing content, routes drafts through human review, supports approved publishing, tracks social performance, and provides basic lead qualification.

**Primary MVP flow**

```text
Company onboarding → Website ingestion → Company knowledge (RAG)
→ Market research → Marketing Agent → Draft → Human approval
→ Scheduling/publishing → Analytics

Lead capture → Intent detection → Lead scoring → Follow-up recommendation
```

**Build priority:** Marketing and social media growth first; basic lead qualification second. Advanced autonomous lead conversion, multi-tenancy, and complex attribution are post-MVP.

## 2. Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| Data | PostgreSQL, pgvector |
| Background tasks / events | Redis, Celery, WebSockets |
| AI orchestration | LangGraph, LangChain |
| Local model | Ollama; Qwen3.5 4B (initial target, subject to local validation) |
| Company knowledge / RAG | Crawl4AI, Sentence Transformers, hybrid retrieval, RRF, Cross-Encoder reranking |
| Market research | Tavily |
| Observability / evaluation | Structured logging, Langfuse, DeepEval |
| External integrations | Official LinkedIn and Instagram APIs, OAuth; Gmail / Microsoft Graph as needed |
| Local infrastructure | Docker Compose |

## 3. Team Ownership

| Member | Role | Primary ownership | Key coordination |
| --- | --- | --- | --- |
| **Member 1** | Backend & Database | FastAPI, PostgreSQL, auth, business APIs, integrations, migrations, workers, security | Owns public API contracts and persistence; coordinates with AI and frontend |
| **Member 2** | AI Agents & Orchestration | LangGraph, Ollama, ingestion/extraction, RAG, Marketing Agent, Lead Agent, evaluation | Defines agent input/output contracts with Member 1 |
| **Member 3** | Frontend & Integrations UI | React app, auth/onboarding UI, Content Studio, social connection UI, analytics and leads interfaces | Integrates against documented backend APIs, not direct agent/database access |

**Shared ownership:** Architecture decisions, API contract review, security, testing, integration, code review, and final UAT.

## 4. Repository Structure

```text
Nexora.AI/
├── backend/
│   ├── alembic/                   # DB migrations
│   ├── app/
│   │   ├── agents/
│   │   │   ├── lead_agent/
│   │   │   │   ├── nodes/
│   │   │   │   ├── prompts/
│   │   │   │   ├── tools/
│   │   │   │   ├── graph.py
│   │   │   │   └── state.py
│   │   │   └── marketing_agent/
│   │   │       ├── nodes/
│   │   │       ├── prompts/
│   │   │       ├── tools/
│   │   │       ├── graph.py
│   │   │       └── state.py
│   │   ├── core/                  # Config, DB, auth/security, logging
│   │   ├── modules/               # Business domains and public APIs
│   │   │   ├── analytics/
│   │   │   ├── approvals/
│   │   │   ├── attribution/
│   │   │   ├── audit/
│   │   │   ├── company_knowledge/
│   │   │   ├── identity/
│   │   │   ├── integrations/
│   │   │   ├── lead_management/
│   │   │   ├── marketing/
│   │   │   └── notifications/
│   │   ├── rag/
│   │   │   ├── chunking/
│   │   │   ├── embeddings/
│   │   │   ├── ingestion/
│   │   │   ├── reranking/
│   │   │   └── retrieval/
│   │   ├── shared/
│   │   ├── websocket/
│   │   ├── workers/
│   │   └── main.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       │   ├── analytics/
│       │   ├── authentication/
│       │   ├── company-knowledge/
│       │   ├── dashboard/
│       │   ├── integrations/
│       │   ├── lead-management/
│       │   ├── marketing/
│       │   └── settings/
│       ├── hooks/
│       ├── services/              # Typed HTTP/API clients
│       ├── types/
│       └── utils/
├── docs/                          # Contracts, architecture, decisions, UAT
├── storage/                       # Local-only runtime data (do not commit)
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

> Git does not track empty directories. Use `.gitkeep` only when a placeholder directory needs to be preserved in the repository. Actual Python modules can use `__init__.py` as appropriate.

## 5. Five-Week Development Plan

| Week | Member 1 — Backend & Database | Member 2 — AI Agents & Orchestration | Member 3 — Frontend & Integrations | Expected deliverables |
| --- | --- | --- | --- | --- |
| **1 — Foundation** | FastAPI setup; PostgreSQL, SQLAlchemy, Alembic; initial schema; JWT authentication; API contracts | LangGraph and Ollama setup; agent state and tool design; shared Pydantic schemas; model integration and basic fallback design | React + TypeScript, Tailwind, shadcn/ui; login/registration, dashboard shell, navigation, typed API client | Auth working; frontend ↔ backend, backend ↔ database/AI runtime validated; contracts agreed |
| **2 — Company Intelligence** | Company onboarding/profile APIs; website ingestion endpoints; background jobs; validation; pgvector storage; status tracking | Crawl4AI extraction; document cleaning; semantic chunking; embeddings; hybrid retrieval, reranking; Company Knowledge workflow | Onboarding UI; website submission; company profile; ingestion status; knowledge-base viewer | Website ingestion → storage → retrieval → UI working end to end |
| **3 — AI Agent Development** | Content/campaign APIs; draft and approval states; lead capture and CRUD; relationships and AI integration | **Marketing Agent first:** Tavily research, RAG-grounded content, validation; then basic Lead Agent intent and scoring | Content Studio, edit/preview/approval; lead list/detail screens; initial analytics | Company-specific drafts saved and reviewed; basic lead qualification results stored/displayed |
| **4 — Social Integration & Completion** | Official LinkedIn/Instagram OAuth integration; secure tokens; publish/schedule APIs; Celery/Redis; analytics ingestion; logging/retries | Complete LangGraph workflows; checkpoint/recovery; fallback and evaluations; integration hardening | Social connection screens; publishing calendar; approvals; analytics and leads dashboards; end-to-end UI integration | Approved content → publishing → analytics demonstrated; lead flow integrated |
| **5 — UAT & Testing** | Auth/permissions, API, database, security, migrations, deployment checks; bug fixes | RAG relevance, grounding/hallucination, agent recovery, checkpoint/fallback, lead scoring tests; bug fixes | Functional, responsive, accessibility, publishing-flow and integration tests; UI fixes | Regression tests, UAT evidence, critical-defect fixes, documentation, sign-off |

**Important schedule risks:** Begin LinkedIn/Instagram app setup, permissions review, and OAuth feasibility checks in **Week 1**, even though implementation is scheduled for Week 4. External approvals can delay live publishing. If access is blocked, demonstrate the approval/scheduling path with a **clearly labeled mock publisher**; never present simulated publishing as a live success.

**Testing is continuous:** Unit, API contract, and integration checks start in Week 1; Week 5 is reserved primarily for consolidated UAT and release readiness.

## 6. Team Development Flow

### Before starting each feature

1. Agree on the task, acceptance criteria, owner, and dependencies.
2. Define/update request and response schemas in `docs/API_CONTRACTS.md`.
3. Agree on endpoint paths, authentication, error responses, job status values, and whether work is synchronous or asynchronous.
4. Member 1 implements the API/persistence boundary; Member 2 implements AI behind it; Member 3 integrates through the API.
5. Test the integration before marking the task complete.

### Daily coordination

At each short standup, everyone reports **Done / Doing / Blocked / Next**. Flag shared-schema changes and blockers immediately. Demonstrate an integrated vertical slice at the end of each week.

### Integration rules

- **Frontend → Backend API → services/agents → PostgreSQL/Redis/Ollama**; frontend must not connect directly to the database or agent runtime.
- Backend is the source of truth for persisted records, workflow status, access control, and public API behavior.
- Agents return validated, structured output; backend validates again before saving or exposing it.
- Long-running crawl, generation, and publishing jobs expose persisted status rather than blocking HTTP requests.
- External actions such as social publishing require recorded human approval and an audit trail.
- Never silently introduce breaking API or migration changes; coordinate them across all three members.

## 7. Git and Pull Request Workflow

**`main` is the reviewed integration branch.** Do not push ongoing development directly to `main`.

Suggested long-lived ownership branches (or use shorter task-specific branches):

| Branch | Owner |
| --- | --- |
| `feature/backend` | Member 1 |
| `feature/ai-agents` | Member 2 |
| `feature/frontend` | Member 3 |

**Clone once:**

```powershell
git clone https://github.com/Renuka-dfz/Nexora.AI.git
Set-Location Nexora.AI
```

**Create a task branch from updated `main`:**

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/auth-api
```

**Work, review, merge:**

```powershell
git status
git add <path-to-changed-files>
git commit -m "feat: implement authentication API"
git push -u origin feature/auth-api
```

Open a GitHub Pull Request targeting `main`. Request review from another member; run relevant tests and resolve conflicts before merging. Sync with `main` before starting a new task.

**Commit conventions:** `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.

**Do not commit:** `.env`, tokens, private keys, customer data, virtual environments, `node_modules`, local storage, or other generated files. Keep safe placeholders in `.env.example`.

## 8. API and State Contract Principles

Use versioned endpoints such as `/api/v1/...` and Pydantic schemas. Final request/response fields are agreed by the team, not assumed from this example.

Implemented company onboarding and company knowledge endpoints are documented in [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md).

**Illustrative contract (not yet implemented):**

```http
POST /api/v1/marketing/generate
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "company_id": "company-uuid",
  "platform": "linkedin",
  "topic": "Business automation"
}
```

For asynchronous generation, prefer a `202 Accepted` response with a `job_id` and status endpoint. Store the resulting content separately with approval states such as `draft → pending_review → approved/rejected → scheduled → published/failed`; the team should finalize transitions and retry semantics before implementation.

Use consistent error envelopes, correlation IDs, and typed input/output schemas across frontend, backend, and agent boundaries.

## 9. Local Development (Windows PowerShell)

### Prerequisites

- Git, Python, Node.js/npm, Docker Desktop, Ollama
- Access to required API credentials and approved social developer applications
- Enough local resources to run the selected Ollama model

### Configure environment

```powershell
Copy-Item .env.example .env
```

Fill the documented environment variables locally. Never put real credentials in `.env.example` or Git history.

### Start infrastructure

```powershell
docker compose up -d
docker compose ps
```

> These commands work once the corresponding services are defined and configured in `docker-compose.yml`. Check that PostgreSQL, Redis, and other intended containers are present before assuming they are running.

### Backend

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Run migrations once Alembic models and configuration are ready:

```powershell
alembic upgrade head
```

### Frontend

From the repository root, once the Vite app and `frontend/package.json` have been initialized:

```powershell
Set-Location frontend
npm install
npm run dev
```

### Ollama

Install and launch Ollama according to its supported local setup, then download the **team-validated** model tag. Confirm the exact model identifier and runtime compatibility before adding it to shared environment configuration.

> **Current state:** The repository includes initial backend files and folders. Not every service, migration, model, or frontend script in this README is necessarily implemented yet. Treat these commands as the target developer workflow and update this section as components become runnable.

## 10. Quality, Security, and Release Rules

- Follow modular boundaries; avoid unnecessary frameworks and duplicate modules.
- Validate all inputs and AI outputs. Use type hints, Pydantic, and TypeScript contracts.
- Protect secrets, OAuth tokens, user data, and company knowledge. Scope data access to authenticated company context.
- Crawl **only authorized sites** and respect robots, rate limits, permissions, and source restrictions.
- Use official social platform APIs and least-privilege OAuth permissions; encrypt stored credentials where appropriate.
- Make background tasks retry-safe and publishing idempotent to reduce duplicate posts.
- Record audit events for authentication-sensitive changes, approvals, publishing, and important AI actions.
- Add unit/integration tests as features are implemented. Evaluate RAG relevance and generated-content grounding with representative company scenarios.
- Maintain migration history in Alembic; never silently rewrite shared database migrations after they are applied.

### Definition of Done

A feature is done only when it:

1. Meets agreed acceptance criteria.
2. Uses approved API and database contracts.
3. Has appropriate validation, error handling, logging, and tests.
4. Has no committed secrets and follows security rules.
5. Has been integrated and demonstrated locally.
6. Has been reviewed and merged into `main`.

## 11. MVP Acceptance Checklist

- [ ] Users can authenticate and onboard a company.
- [ ] Authorized company website content can be ingested, stored, and retrieved.
- [ ] Marketing Agent produces company-aware, reviewable draft content.
- [ ] Drafts can be edited, approved/rejected, and audited.
- [ ] Approved content can be scheduled/published through available official integrations; unsupported access paths are clearly reported.
- [ ] Basic social engagement metrics can be retrieved and displayed where API access permits.
- [ ] Leads can be captured, given basic intent/score results, and reviewed.
- [ ] Critical security, API, RAG, and end-to-end tests pass.
- [ ] UAT issues and release notes are documented and signed off.

## 12. Documentation to Maintain

| Document | Purpose | Owner |
| --- | --- | --- |
| `README.md` | Project overview, setup, collaboration, roadmap | All members |
| `docs/API_CONTRACTS.md` | Endpoints, schemas, errors, async job states | Member 1 with Members 2 & 3 |
| `docs/ARCHITECTURE.md` | Modules, architecture decisions, data flow | All members |
| `docs/TASK_TRACKER.md` | Weekly tasks, owners, progress, blockers | All members |
| `docs/UAT_CHECKLIST.md` | Acceptance scenarios and results | All members in Week 5 |

---

**Guiding principle:** Deliver working, secure, company-aware marketing workflows first; keep integration contracts stable and verify progress as one team every week.
