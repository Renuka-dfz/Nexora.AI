# Backend API Contract Notes

Base path: `/api/v1`

## Authentication and company access

- `POST /auth/register` accepts `email` and `password`; passwords are stored as hashes.
- `POST /auth/login` accepts the same credentials and returns a bearer token.
- `GET /auth/me` requires that bearer token.
- Company-scoped routes require the authenticated user's `company_id` to match.
  Company creation assigns the first user the `admin` role.

Set `JWT_SECRET_KEY` to a secret of at least 32 characters. Token lifetime is
configured by `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30).

## Company knowledge

- Create a source with `POST /companies/{company_id}/sources`, using `source_url`.
- Create a knowledge fact with `POST /companies/{company_id}/knowledge`, using the
  source's `source_id`, `category_id`, `title`, and optional `description`.
- Knowledge list results include `company_id`, `total`, and `items`; category and
  source lists include `total` and `items`.
- Knowledge can be filtered by `category_id` and `verification_status`.

## Website crawling

- `POST /companies/{company_id}/website-crawls` accepts `website_url` and is
  restricted to company admins.
- The API checks public HTTP(S) reachability, robots.txt permissions, and
  sitemap availability before enqueueing a crawl. Private and local network
  destinations are rejected.
- Accepted requests return `202` and a persisted `job_id`. Poll
  `GET /companies/{company_id}/website-crawls/{job_id}` for `queued`, `running`,
  `completed`, or `failed` status and page/section counts.
- Crawled page metadata is stored in `crawled_page`; classified sections are
  stored as `fact_company_intelligence` records and start with pending
  verification.
- Redis and a Celery worker must be running for crawl jobs to execute. The
  existing source, category, and knowledge APIs remain available.

## Marketing and leads

- Marketing content create requests include `company_id` and an explicit
  `generation_type` (`ai` or `manual`).
- Lead and source create requests include `company_id`.
- The API derives qualification `date_id` server-side.
- Paginated list endpoints return `total` and `items`.

## Not included in this contract

RAG search, agent execution, social OAuth, and social publishing need services or
storage that are not currently implemented in the backend.
