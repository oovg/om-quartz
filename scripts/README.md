# Scripts

## build-chat-index.mjs

Builds the RAG index for the chat: **replaces** the **vault_chunks** table with the current **content** directory—clears existing rows, then reads markdown from content (om-outer-mind submodule), chunks by heading, embeds with Voyage AI (voyage-4-lite), and inserts. So the index always matches content; run after removing or changing files so removed content is no longer indexed.

**Prerequisites:** `content/` populated (`git submodule update --init --recursive`), and env: `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Run:** From repo root, `npm run build:chat-index` or `node scripts/build-chat-index.mjs`.

Full instructions are in [chat/SPEC.md](../chat/SPEC.md) under **“Running the index build”**.
