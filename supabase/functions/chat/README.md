# Chat Edge Function

Handles `POST /chat` with `{ message, history }`; runs RAG (Voyage query embedding + pgvector similarity search) and calls Claude Haiku 4.5 (Anthropic); returns `{ reply }`.

## Required secrets (Supabase)

Set in Dashboard → Project Settings → Edge Functions → secrets, or via CLI:

- **ANTHROPIC_API_KEY** — Anthropic API key for Claude (required).
- **VOYAGE_API_KEY** — Voyage AI API key for query embedding (required for RAG). If unset, the function still runs but sends no vault context to Claude.
- **ALLOWED_ORIGIN** (optional) — Quartz site origin for CORS (e.g. `https://yourorg.github.io`). When set, only this origin is allowed; when unset, the function reflects the request `Origin` header (or `*` when absent).

**SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** are provided automatically by Supabase at runtime; do not set them in secrets.

## Database (pgvector)

Run the migration so the function can do similarity search:

```bash
npx supabase db push
```

Or from repo root: `npm run supabase:db-push`.

This creates the `vault_chunks` table and the `match_vault_chunks` RPC (see `supabase/migrations/`). Populate `vault_chunks` with an index-build job (chunk om-outer-mind, embed with Voyage, insert rows). Until the table has data, the function will answer without vault context.

## Local development

From repo root:

```bash
npx supabase functions serve chat
```

Or: `npm run supabase:functions-serve`. Set env for local: `ANTHROPIC_API_KEY`, and optionally `VOYAGE_API_KEY`, `ALLOWED_ORIGIN`. The function will be at `http://localhost:54321/functions/v1/chat`.
