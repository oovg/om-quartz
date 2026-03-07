# Scripts

## build-chat-index.mjs

Builds the RAG index for the chat: reads markdown from the **content** directory (om-outer-mind submodule), chunks by heading, embeds with Voyage AI (voyage-4-lite), and upserts into Supabase **vault_chunks**.

**Prerequisites:** `content/` populated (`git submodule update --init --recursive`), and env: `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Run:** From repo root, `npm run build:chat-index` or `node scripts/build-chat-index.mjs`.

Full instructions are in [chat/SPEC.md](../chat/SPEC.md) under **“Running the index build”**.
