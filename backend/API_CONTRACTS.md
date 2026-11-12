# Backend API Contract Notes

Base path: `/api/v1`

## Authentication and company access

- `POST /auth/register` accepts `email` and `password`; passwords are stored as hashes.
- `POST /auth/login` accepts the same credentials and returns a bearer token.
- `GET /auth/me` requires that bearer token.
- Company-scoped routes require membership in the requested company. Company creation
  creates an `owner` membership for the authenticated user.

Set `JWT_SECRET_KEY` to a secret of at least 32 characters. Token lifetime is
configured by `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 30).

## Company knowledge

- Create a source with `POST /companies/{company_id}/sources`, using `source_url`.
- Create a knowledge fact with `POST /companies/{company_id}/knowledge`, using the
  source's `source_id`, `category_id`, `title`, and optional `description`.
- Knowledge list results include `company_id`, `total`, and `items`; category and
  source lists include `total` and `items`.
- Knowledge can be filtered by `category_id` and `verification_status`.

## Marketing and leads

- Marketing content create requests include `company_id` and an explicit
  `generation_type` (`ai` or `manual`).
- Lead and source create requests include `company_id`.
- The API derives qualification `date_id` server-side.
- Paginated list endpoints return `total` and `items`.

## Not included in this contract

RAG search, agent execution, social OAuth, and social publishing need services or
storage that are not currently implemented in the backend.
