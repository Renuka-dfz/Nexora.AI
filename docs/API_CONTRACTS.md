# API Contracts

Base path: `/api/v1`

All company-owned resources are scoped by `company_id`. Requests and responses
use JSON. Database records are returned through Pydantic response schemas.

## Companies

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/companies` | Create a company; returns `201` |
| `GET` | `/companies/{company_id}` | Get a company |
| `PATCH` | `/companies/{company_id}` | Update provided company fields |

`CompanyCreate` accepts `company_name` (required), `website_url`,
`company_overview`, `industry`, and `headquarters`. `CompanyUpdate` accepts any
non-empty subset of those fields.

## Company knowledge

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/companies/{company_id}/knowledge/categories` | List seeded categories |
| `GET` | `/companies/{company_id}/knowledge` | List facts; supports `category_id`, `limit` (1–100), and `offset` |
| `POST` | `/companies/{company_id}/knowledge` | Create a fact from an existing `source_id`; returns `201` |
| `PATCH` | `/companies/{company_id}/knowledge/{fact_id}` | Update a fact |
| `DELETE` | `/companies/{company_id}/knowledge/{fact_id}` | Delete a fact; returns `204` |

`KnowledgeCreate` accepts `category_id`, `source_id`, and `title`, with
optional `description`. Create the source separately through
`POST /companies/{company_id}/sources`.
New facts start with `verification_status: "pending"`. Updating a fact also
resets its verification status to pending; `description: null` clears it.

Unknown company or fact IDs return `404`; an unknown category ID returns `422`.
## Website crawling

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/companies/{company_id}/website-crawls` | Validate a website and queue a crawl; returns `202` with a job |
| `GET` | `/companies/{company_id}/website-crawls/{job_id}` | Get crawl status and progress |

Only company admins may start a crawl. The API checks HTTP(S) reachability,
robots.txt permissions, and sitemap availability before enqueueing. Requests to
private/local network destinations are rejected. Crawl jobs run through Celery
and Redis; clients poll the status endpoint for `queued`, `running`, `completed`,
or `failed`.

The pipeline stores discovered pages and extracted HTML/Markdown/metadata in
`crawled_page`. Classified content sections are written to the existing company
knowledge table and begin with pending verification. Applying the new Alembic
migration and running Redis plus a Celery worker are required.
