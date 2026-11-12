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
| `POST` | `/companies/{company_id}/knowledge` | Create a fact; returns `201` |
| `PATCH` | `/companies/{company_id}/knowledge/{fact_id}` | Update a fact |
| `DELETE` | `/companies/{company_id}/knowledge/{fact_id}` | Delete a fact; returns `204` |

`KnowledgeCreate` accepts `category_id`, `source_url`, and `title`, with
optional `description`. Sources are created or reused for the company and URL.
New facts start with `verification_status: "pending"`. Updating a fact also
resets its verification status to pending; `description: null` clears it.

Unknown company or fact IDs return `404`; an unknown category ID returns `422`.
Website crawling/ingestion jobs are not part of this API phase.
