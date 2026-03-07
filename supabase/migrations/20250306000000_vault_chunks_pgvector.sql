-- Enable pgvector for similarity search.
create extension if not exists vector with schema extensions;

-- Chunks from vault content (e.g. om-outer-mind). Filled by index-build job; read by chat Edge Function.
create table public.vault_chunks (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  text text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz default now()
);

comment on table public.vault_chunks is 'RAG chunks: path, text (markdown), and voyage-4-lite embedding (1024 dims).';

-- Optional index for faster cosine similarity search (requires pgvector 0.7+ with vector_cosine_ops).
-- If your Supabase pgvector supports it, run manually: create index vault_chunks_embedding_idx on public.vault_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
-- Without the index, match_vault_chunks uses a sequential scan; fine for PoC / moderate row counts.

-- RPC: return closest chunks to query_embedding (cosine distance). Used by the chat Edge Function.
-- search_path must include extensions so pgvector operator <=> is found.
create or replace function public.match_vault_chunks(
  query_embedding extensions.vector(1024),
  match_count int default 5
)
returns table (
  id uuid,
  path text,
  text text
)
language sql stable
set search_path = public, extensions
as $$
  select
    vc.id,
    vc.path,
    vc.text
  from public.vault_chunks vc
  order by vc.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

comment on function public.match_vault_chunks is 'Returns vault_chunks rows ordered by cosine similarity to query_embedding. match_count capped at 20.';
