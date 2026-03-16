# Interactive Mind Chat - Specification

> **Working document for this repository.** Use the [Progress](#progress) section to track implementation status for the OM Quartz chat, and update checkboxes and notes as you change code or infrastructure. This file captures design decisions, chosen stack, and wiring details specific to this repo.

## Progress

### Iteration 1: Chat Modal (proof-of-concept)

| Task | Status | Notes |
|------|--------|-------|
| Chat package with Preact modal (UI + placeholder API) | ✅ Done | `chat/` with ChatModal |
| Quartz integration: Chat component, layout, root dependency | ✅ Done | Modal with blurred backdrop |
| Confirm stack: host, serverless, embedding, vector/index, LLM | ✅ Done | **PoC choice:** GitHub Pages + Supabase (Edge Functions + pgvector) + Voyage (voyage-4-lite) + Anthropic (Claude Haiku 4.5). Other options retained in §4.3. |
| Chat API endpoint (serverless) | ✅ Done | `supabase/functions/chat/` (Supabase Edge Function); deploy with `npx supabase functions deploy chat` or `npm run supabase:functions-deploy` |
| Define index scope for om-outer-mind | ✅ Done | PoC: all markdown in **content/** (om-outer-mind submodule). Path/tag filtering deferred. |
| RAG: embed om-outer-mind, vector store or static index | ✅ Done | Voyage AI (voyage-4-lite) + Supabase pgvector; migration, Edge Function RPC, index-build script `scripts/build-chat-index.mjs` |
| LLM integration | ✅ Done | Claude Haiku 4.5 (Anthropic) in Edge Function |
| Document: run locally, deploy, refresh index | ✅ Done | chat/README.md; scripts/README.md; §4.3 Supabase setup + "Running the index build" |
| Modal config via env only; enableSPA: false | ✅ Done | Chat reads process.env.CHAT_API_BASE_URL; launcher calls window.omChatOpen() |

## 1. Purpose & Scope

**Interactive Mind Chat** provides chat-based access to knowledge stored in The Open Machine's Obsidian vaults. It serves:

- **Visitors** — anyone reading the documentation site or asking general questions about OM
- **Subscribers** — people who follow or draw on OM resources (e.g. om-outer-mind, and when authorized om-inner-mind) whether they are prospective members or independent researchers
- **Members** — full access to OM resources (e.g. om-outer-mind and om-inner-mind)

The system answers questions using vault content. Implementation is planned in **iterations**:

- **Iteration 1 – Chat modal (proof-of-concept)**: modal on the Quartz site with chat backed by om-outer-mind.
- **Iteration 2+**: web application experience and deeper subscriber/member paths built on the same principles.

## 2. Vaults & Context

### 2.1 Vaults on GitHub

| Vault | Repo visibility | Read access | Write access | Use for context |
|-------|-----------------|------------|--------------|------------------|
| **om-inner-mind** | Private | OM members only | OM members only | Only `ai-ready: true` |
| **om-outer-mind** | Public | Anyone | OM members only | All content |

- **om-inner-mind:** Internal vault. A note is used for context only when it has a boolean frontmatter property `ai-ready` set to `true` (checkbox checked). Notes with `ai-ready` set to `false` or missing are excluded from context.
- **om-outer-mind:** External vault. All notes are used for context (no per-note filter).

### 2.2 Context Loading Strategy

Loading all vault content into context upfront is not feasible. The system must support **on-demand context**: the model (or retrieval layer) pulls in or searches the vaults when needed (e.g. via search, RAG, or targeted fetches) rather than loading entire vaults into every request. Design choices (indexing, embedding, retrieval) should align with this constraint.

## 3. Iteration Plan

### 3.1 Overview

| Iteration | Deliverable | Primary users | Vault(s) | Auth |
|-----------|-------------|---------------|----------|------|
| **1** | Chat modal (centered) on all Quartz site pages | Public (unauthenticated) | om-outer-mind only (design for multi-vault later) | None |
| **2+** | web application (this repo or separate) | Subscribers, members | om-outer-mind + om-inner-mind (scoped by role) | As needed |

- **Iteration 1** (proof-of-concept, chat modal, single vault) is specified in **Section 4**.
- **Iteration 2+** (web application, subscriber/member pathways, multi-vault) is outlined in **Section 5**.

## 4. Iteration 1 – Chat Modal (proof-of-concept)

### 4.1 Scope

- **In scope:** Chat modal, API endpoints, vector store or static index, LLM integration.
- **Out of scope:** Multi-vault support, user signup/login, multiple chats, persistent threads, editing or creating vault notes from the app, automated syncing with GitHub repositories, fine-grained per-note or per-folder permissions, billing/usage caps or quotas.

### 4.2 Summary

- **Where:** A **modal** **centered** on every page of the Obsidian Quartz site (markdown-generated static site). The chat is **hidden by default**; it opens from a **chat icon** placed next to the theme (Darkmode) and reader (book) icons in the page header controls. When open, a **backdrop** covers the site with **blur** (matches Quartz search overlay). The user can close the modal via a close control or by clicking the backdrop.
- **Who:** Anyone; no authentication. Free to use.
- **What:** Public FAQ — answers common questions about OM using **om-outer-mind** only. Design should assume multiple vaults (e.g. om-inner-mind) are a long-term goal so the architecture does not hard-code a single vault.
- **Constraints:** Use free tiers; do not assume high traffic. No auth requirements.

### 4.3 Technical Specification

#### Goals & Non-Goals

- **Goals:** Free to run; minimal ops; om-outer-mind context; path to add om-inner-mind later.
- **Non-goals:** Subscriber/member authentication, multi-vault context, persistent conversations.

#### Architecture Options

The modal is embedded in a static Quartz site. Backend and RAG/LLM cannot run on pure static hosting; at least one of: serverless API, BaaS, or third-party chat/embedding APIs is required.

| Approach | Description | Pros | Cons |
|----------|-------------|------|------|
| **Static site + serverless API** | Quartz on GitHub Pages (or similar); chat + RAG/embedding behind Vercel/Netlify/Cloudflare Functions | Free tiers; no server to maintain; scales with traffic | Cold starts; need to host embeddings/vector store and LLM elsewhere or via APIs |
| **Static site + BaaS** | Frontend static; chat, DB, and optional auth via Supabase (Edge Functions + pgvector or external vector API) | Free tier; one place for DB + serverless; can add auth later | Tied to Supabase; vector search may need extension or external API |
| **Static site + external RAG/LLM only** | Modal calls embedding + LLM APIs (e.g. Voyage + OpenAI/Anthropic); index built at deploy time and stored in repo or free storage | Minimal backend code; leverage free/low-cost API tiers | API keys must be in backend or proxy; index refresh = redeploy or cron |

**Chosen for PoC:** Static site on **GitHub Pages** + backend on **Supabase** (Edge Functions for the chat API + pgvector for retrieval). No separate API host is needed; Supabase Edge Functions serve the chat endpoint. Vector DB = Supabase pgvector (see "When to Use a Vector DB vs Static Index" and "Recommended stack" below).

#### How Markdown Reaches the LLM (Content Pipeline)

Vault content is **not** sent to the LLM as raw files on each request. It is prepared once (build time or scheduled job), then used at query time for retrieval only.

1. **Source:** Markdown files from **om-outer-mind** (e.g. cloned from GitHub or read from the built Quartz content).
2. **Chunking:** Content is split into **chunks** (e.g. by heading, by token limit, or by document with metadata). Chunk boundaries should preserve meaning (e.g. keep a heading with its following paragraph).
3. **Embedding:** Each chunk is sent to an **embedding API** (e.g. Voyage AI). The API returns a **vector** (list of numbers) representing the chunk’s meaning.
4. **Index storage:** For each chunk we store:
   - The **vector** (for similarity search), and
   - **Metadata** including the **original chunk text** (markdown or plain text) and source path/slug.
   - Storage can be: **vector DB** (e.g. Supabase pgvector) or **static index** (e.g. JSON file in the repo or deployed with the serverless function).
5. **At query time:** The user’s message is **embedded** with the same embedding model → similarity search returns the **top-k chunks**. The chunk **text** (still markdown) is what gets sent to the LLM.
6. **Prompt:** The serverless handler builds a prompt that includes those chunks as **context** (e.g. in the system message or a “context” block). **No conversion is required:** LLMs accept markdown natively. The model sees something like: “Answer using only this context: … [chunk 1 markdown] … [chunk 2 markdown] …”
7. **Response:** The LLM generates an answer; the backend returns it to the modal.

So: **markdown is the format all the way** — chunked for retrieval, stored as text alongside vectors, and passed as-is into the LLM prompt. Optional: strip to plain text or normalize headings if a provider recommends it; for most use cases, markdown is preferable so structure (lists, headings, links) is preserved.

#### Portability

To make it easy to move data and setup to another service:

- **Vector DB (Supabase pgvector):** Use standard Postgres/pgvector so data can be dumped (e.g. `pg_dump`) or exported to JSON and re-imported elsewhere (e.g. Qdrant, Weaviate, or another Postgres). Supabase does not lock you in.
- **Backend code:** Keep the chat API in **plain TypeScript/JavaScript** (or Deno for Supabase Edge) with **no platform-specific APIs** for core logic (retrieval + LLM call). Use environment variables for API keys and DB URL. Then the same logic can run on Supabase Edge, Vercel, Netlify, Cloudflare Workers, or a small Node server.
- **Secrets:** Store keys in the chosen platform’s env (e.g. Supabase secrets, GitHub Actions secrets). Moving = re-create env vars on the new platform; no keys in repo.

#### GitHub-Centric Deployment (Minimize Platforms)

If you want to concentrate on **GitHub** and minimize other services:

- **Quartz (static site):** Deploy to **GitHub Pages** from the same repo (or from `om-quartz`). Build via **GitHub Actions** (e.g. on push to `main`): install deps, build Quartz, publish to `gh-pages` or GitHub Pages branch.
- **Index build:** Either run **`npm run build:chat-index`** (reads **content/** submodule, Voyage embed, upsert to Supabase pgvector) locally or in a GitHub Actions workflow; or, for a static-index approach, build a JSON index and deploy with the API.
- **Chat API:** GitHub does **not** provide serverless functions for arbitrary backends. You still need **one** of: **Vercel**, **Netlify**, **Cloudflare Workers**, or **Supabase Edge**. To minimize platforms:
  - **Option A:** Use **GitHub Pages for Quartz** and **one** of Vercel / Netlify / Cloudflare / Supabase **only for the chat API** (no need to host the static site there). Point the modal’s `apiBaseUrl` at that API.
  - **Option B:** If you currently use **Netlify** for the site, you can keep Netlify for both: Netlify hosts Quartz and Netlify Functions for the chat API. Moving later = same portable code; switch to GitHub Pages + another provider for the API when you want.

**Chosen stack for PoC (minimal platforms):** **GitHub** (static site + Actions for build/index) + **Supabase** (vector DB + chat API via Edge Functions) + **Voyage AI** (voyage-4-lite embeddings) + **Anthropic** (Claude Haiku 4.5). No separate API host: Supabase Edge Functions serve the chat endpoint. Flow: GitHub Pages serves Quartz; modal calls Supabase Edge Function; Edge Function uses pgvector (`match_vault_chunks` RPC), Voyage for query embedding, and Anthropic for the reply. Index build: **`npm run build:chat-index`** (reads **content/** submodule → chunk → Voyage embed → upsert to pgvector); can be run locally or in GitHub Actions.

#### Hosting & Deployment

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **GitHub Pages** | Host Quartz static site | Free; good for docs; no server-side logic. **PoC: chosen** for static site. |
| **Vercel** | Host Quartz and/or serverless chat API | Generous free tier; serverless functions; easy Git deploy |
| **Netlify** | Alternative to Vercel for site + functions | Free tier; functions; similar model |
| **Cloudflare Pages + Workers** | Static site + edge functions | Free tier; low latency; Workers for chat API |
| **Supabase** | DB, auth (later), **Edge Functions for chat API** (no separate API host needed) | Free tier; pgvector; Edge Functions = full backend. **PoC: chosen** for chat API + vector store. |

**Chosen for PoC:** **GitHub Pages** for the Quartz static site (build via GitHub Actions) + **Supabase** for the chat API and pgvector. No separate Vercel/Netlify/Cloudflare needed. See "Chosen stack for PoC" under GitHub-Centric Deployment above.

#### When to Use a Vector DB vs Static Index

- **Static index (e.g. JSON in repo):** Best when total indexed content is modest and fits comfortably in a single deployable artifact (e.g. hundreds of chunks, low tens of MB). Simple and portable.
- **Vector DB (e.g. Supabase pgvector):** Prefer when content is **large or heterogeneous** — e.g. **books**, many long documents, or when the index would be too big to load in one serverless request. pgvector supports similarity search at scale and keeps the API stateless; index refresh = re-run embed job and upsert into the DB.

**Chosen for this project:** Vault content may include **books** and other long-form material, so a **vector DB** is used. **Supabase pgvector** is the PoC choice (free tier, standard Postgres, exportable). Static index remains an option for smaller corpora.

#### Embedding & Retrieval

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **Voyage AI** | Embeddings for RAG | voyage-4-lite: 200M free tokens/account, then ~$0.02/M tokens; retrieval-oriented; 32k context. **PoC: chosen.** |
| **Supabase pgvector** | Store embeddings and run similarity search | Free tier; suitable for om-outer-mind including larger content (e.g. books). **PoC: chosen.** |
| **Vercel KV / Upstash** | Key-value or simple cache; not a full vector DB | Free tier; can cache or store small state |
| **Build-time index in repo** | Precomputed embeddings as JSON in repo; loaded at runtime | Best for small, uniform content; not used when books/large docs are in scope |

**Chosen for PoC:** **Voyage AI** with **voyage-4-lite** for embeddings (index build and query embedding). Store vectors and chunk metadata in **Supabase pgvector**. Index build = script `scripts/build-chat-index.mjs` (reads **content/** submodule, chunks, Voyage embed, upsert). Retrieval = vector similarity via `match_vault_chunks` RPC; pass top chunk **text** (markdown) to the LLM. **Note:** Voyage is for **embeddings only**; chat replies use a separate **LLM** (see LLM section).

#### Voyage + pgvector requirements

These requirements allow the chat API to perform RAG: embed the user query with Voyage, search pgvector for relevant chunks, and pass that context to Claude.

**Embedding model:** **voyage-4-lite** (Voyage AI). Default dimension **1024**; use the same dimension for index build and query embedding.

**Secrets:** The chat Edge Function needs **VOYAGE_API_KEY** (Supabase Edge Function secrets). **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** are provided automatically by Supabase at runtime.

**Database:**

- Enable the **pgvector** extension (in a migration).
- **Table `vault_chunks`:** Stores one row per chunk. Columns: **id** (uuid, primary key), **path** (text, source path or slug), **text** (text, chunk content in markdown), **embedding** (vector(1024)), **created_at** (timestamptz, optional). Optional: **vault** (text) or **updated_at** for multi-vault or refresh logic later. Implemented in `supabase/migrations/20250306000000_vault_chunks_pgvector.sql`.
- **RPC (optional but recommended):** A Postgres function such as **`match_vault_chunks(query_embedding vector(1024), match_count int)`** that returns rows ordered by cosine distance (`embedding <=> query_embedding`) with `LIMIT match_count`. The Edge Function calls this RPC so it does not need to send raw vectors in the request.

**Index build (out of band):** Implemented as **`scripts/build-chat-index.mjs`** (run with **`npm run build:chat-index`**). It clears **vault_chunks**, then reads markdown from the **content** directory (om-outer-mind submodule), chunks by heading, calls Voyage with `input_type: "document"`, and inserts. The index therefore always matches current content (removed files drop out). Run after submodule updates, content changes, or on a schedule (e.g. GitHub Actions). See “Running the index build” in the Supabase setup steps.

**Chat flow with RAG:** On each user message, the Edge Function: (1) embeds the message with Voyage (`input_type: "query"`), (2) calls the match RPC to get top-k chunks, (3) builds a system or user message that includes “Answer using only this context: …” plus the chunk texts, (4) calls Claude with that context and conversation history, (5) returns the reply.

**CORS:** The function must allow the Quartz site origin (see Accounts and setup checklist). Use **ALLOWED_ORIGIN** or reflect the request **Origin** header.

#### LLM (Chat Completion)

**Distinction:** **Voyage AI** provides **embeddings** (for RAG retrieval). It does **not** provide chat/completion. You need a separate **LLM** provider to generate replies from the retrieved context.

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **OpenAI** | Chat completion | Usage-based; free credits for new accounts |
| **Anthropic** | Chat completion | Usage-based; free tiers / credits. **PoC: chosen** (Claude Haiku 4.5). |
| **Vercel AI SDK** | Unified interface to multiple providers | No cost by itself; depends on provider (can be used from Supabase Edge with fetch) |

**Chosen for PoC:** **Claude Haiku 4.5** (Anthropic). Model ID: `claude-haiku-4-5` (or `claude-haiku-4-5-20251001`). The Supabase Edge Function calls the Anthropic Messages API after retrieval. Optional later: rule-based or template overrides for high-risk topics.

#### Accounts and Setup Checklist

Use a **shared organization email** for all service accounts where possible.

| Account | Purpose |
|---------|---------|
| **GitHub** | Repo (om-quartz), GitHub Pages, Actions for build and index |
| **Supabase** | Project: pgvector (vector store) + Edge Functions (chat API) |
| **Voyage AI** | Embeddings (e.g. voyage-4-lite) |
| **Anthropic** | LLM for chat completion (Claude Haiku 4.5) |

**API keys and secrets:**

- **Supabase:** Create a project; obtain project URL and keys. Store **Voyage** and **Anthropic** API keys only in **Supabase Edge Function secrets** (or project env), never in the client or repo.
- **Voyage:** Create API key; add to Supabase secrets.
- **Anthropic:** Create API key; add to Supabase secrets.

**Billing:** Add a payment method where required (e.g. Anthropic, Supabase if exceeding free tier) so usage is not hard-cut when free limits are reached.

**CORS:** The chat modal runs on the Quartz site origin (e.g. `https://<org>.github.io` or custom domain). The Supabase Edge Function that serves the chat API must allow that origin in CORS so the browser permits the request. Configure the Edge Function response headers accordingly (e.g. `Access-Control-Allow-Origin` for the Quartz site origin).

#### Content Scope & Safety

- **Scope:** om-outer-mind only. No om-inner-mind in the first version.
- **Indexing:** Only content intended for public FAQ (entire om-outer-mind or a defined subset by path/tag if needed).
- **No write:** Read-only; no creating or editing vault notes from the modal.
- **Secrets:** API keys and vault content only in backend/env or serverless config; never in client bundle.

#### Modal UX and Design

- **Placement and behaviour:** The chat is a **modal** **centered** in the viewport. It is **hidden by default**. A **chat icon launcher** sits next to the theme and reader icons; clicking it opens the modal. When open, the overlay covers the **entire viewport (including sidebars)**: the rest of the site is **blurred**. The modal panel sits above the backdrop and is centered. The user can close the modal via a close button in the modal header or by clicking outside the panel (the overlay). The chat appears on **all pages** (homepage and every content/list page) via the shared layout. **SPA:** With Quartz SPA routing enabled, the chat icon can stop working after client-side navigation; use **`enableSPA: false`** in `quartz.config.ts` so the chat works on every page (see chat/README.md).
- **Content:** Message list (user + agent), multi-line text input, optional loading/typing indicator. **Enter** sends a message; **Shift+Enter** inserts a newline (no separate send button).
- **Scope:** No threads, no multi-room, no persistence requirement for PoC.
- **Accessibility:** Basic keyboard use and readable text; toggle and modal use appropriate ARIA (e.g. `aria-expanded`, `role="dialog"`, `aria-label`).

#### Refresh & Operations

- **Index refresh:** Run the index-build script from this repo: **`npm run build:chat-index`** (see **“Running the index build”** in the Supabase setup steps). The script reads from the **content** directory (om-outer-mind submodule), chunks markdown, embeds with Voyage, and replaces **vault_chunks** in Supabase. No redeploy of the chat function is needed when the table is updated. Optionally run on a schedule (e.g. GitHub Actions) or after `git submodule update --remote content`.
- **Availability:** Best effort; short outages acceptable for PoC.
- **No SLA, no billing, no usage caps** for this iteration.

#### Embedded Modal in Quartz

Quartz is a static site generator. Pages are composed of **layout slots** filled by **components** (Preact-based). This implementation uses **`enableSPA: false`**, so each navigation is a full page load; no `nav` event or re-mount logic is used.

1. **Layout:** In **`quartz.layout.ts`**, add **`Component.Chat()`** to **`sharedPageComponents.afterBody`** so the chat mount point exists on every page. Add **`Component.ChatLauncher()`** in the header area next to theme and reader controls: in **`defaultContentPageLayout`** and **`defaultListPageLayout`**, place it inside the left **Flex** (e.g. after `Darkmode()` and `ReaderMode()`). Components are imported from `quartz/components` and re-exported in `quartz/components/index.ts`.

2. **Chat component** (`quartz/components/Chat.tsx`): Renders a single div with **`id="om-chat-root"`**, **`class="om-chat-wrapper"`**, and **`data-api-base-url`** set from **`process.env.CHAT_API_BASE_URL`** at build time . Attaches **`Chat.css`** and an **`.afterDOMLoaded`** script (`quartz/components/scripts/chat.inline.ts`). The script runs once after DOM load: it gets the element by `om-chat-root`, reads `data-api-base-url`, and renders the Preact **ChatModal** from the `chat` package into that div.

3. **Chat launcher component** (`quartz/components/ChatLauncher.tsx`): Renders a button with **`class="chatlaunch"`** and **`aria-label="Open chat"`**. Its **`.afterDOMLoaded`** script (`quartz/components/scripts/chatLauncher.inline.ts`) runs once, finds all `button.chatlaunch` elements, and adds a click handler that calls **`window.omChatOpen()`**. Uses **`data-chat-bound="1"`** on each button to avoid binding twice if the script runs multiple times.

4. **Modal (chat package):** On mount, the **ChatModal** assigns **`window.omChatOpen`**, **`window.omChatClose`**, and **`window.omChatToggle`** so the launcher (and any other script) can open, close, or toggle the modal. The modal is centered with a blurred backdrop; the user closes it via the header close control or by clicking the backdrop.

**Modular chat package:** The chat modal source lives in **chat/** with its own `package.json` (workspace dependency). The Quartz Chat component imports and mounts **ChatModal** from the `chat` package via the inline script.

#### Repository layout: where to put the chat API

**Recommendation: keep the API in this repository.** One repo keeps the chat feature (modal + API + docs) in one place, simplifies CI and documentation, and allows shared types or schemas between frontend and backend. Use a **separate repository** only if a different team owns the API or you need a separate release cycle.

**Same repo — two options:**

| Option | Location | Notes |
|--------|----------|--------|
| **A. Supabase layout only** | **`supabase/functions/chat/`** | Standard Supabase layout. Edge Function implements the chat endpoint. Deploy with `npx supabase functions deploy chat`. **PoC: chosen** — implemented in this repo. |
| **B. Dedicated package + Supabase** | **`chat-api/`** (or **`api/`**) + **`supabase/functions/chat/`** | Shared types and handler logic in **`chat-api/`**; Edge Function is a thin HTTP wrapper. Use when you want a clear “API package” or reuse with scripts. |

**Chosen for PoC:** **Option A.** A single **`supabase/functions/chat/`** directory (plus **`supabase/config.toml`** and **`supabase/migrations/`**) is implemented. Option B can be added later if shared code is needed.

#### Supabase setup steps

Follow these steps once per Supabase project. The code in this repo is **deployed** via the Supabase CLI, not added through the dashboard.

1. **Create a Supabase project** (if needed). In the [Supabase Dashboard](https://supabase.com/dashboard), create a new project. Note the **Project ref** (in URL or Settings → General) and the **database password** (shown once at creation).
2. **Supabase CLI:** The CLI is a dev dependency. From the repo root run `npm install`, then use `npx supabase` for all commands (see [Supabase CLI](https://supabase.com/docs/guides/cli)). Global install is not required.
3. **Link this repo to the project (one-time):** From the repo root, run:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
   When prompted, use your database password or set `SUPABASE_ACCESS_TOKEN` for CI. The CLI stores the link (e.g. in `.supabase/`); that directory is gitignored.
4. **Enable pgvector and create the RAG table:** Run the migration that creates the vector extension and the `vault_chunks` table (and optional RPC for similarity search). From repo root:
   ```bash
   npx supabase db push
   ```
   Or: `npm run supabase:db-push`. Migrations live in `supabase/migrations/`; see “Voyage + pgvector requirements” below.)
5. **Set Edge Function secrets:** In Dashboard → Project Settings → Edge Functions → secrets (or via CLI), set:
   - **ANTHROPIC_API_KEY** — Anthropic API key (required for chat).
   - **VOYAGE_API_KEY** — Voyage AI API key (required for RAG query embedding).
   - **ALLOWED_ORIGIN** (optional) — Quartz site origin for CORS (e.g. `https://yourorg.github.io`). If unset, the function reflects the request `Origin` header.
   Supabase automatically provides **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** to Edge Functions at runtime; you do not set those in secrets.
6. **Deploy the chat function:** From repo root:
   ```bash
   npx supabase functions deploy chat
   ```
   Or: `npm run supabase:functions-deploy`. The CLI uploads **`supabase/functions/chat/`** to your project. The API is then available at `https://<project-ref>.supabase.co/functions/v1/chat`.
7. **Configure the modal:** Set the **`CHAT_API_BASE_URL`** environment variable when building Quartz (e.g. `CHAT_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1`). The **Chat component** reads it via `process.env.CHAT_API_BASE_URL` at build time and passes it to the modal via the mount div’s `data-api-base-url`. Do not commit the URL. Example: `CHAT_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1 npx quartz build`, or set it in CI (e.g. GitHub Actions secrets). The modal sends `POST …/chat` with `{ message, history }`.
8. **Populate the RAG index:** Run the index-build script so the chat can answer from vault content. See **“Running the index build”** below.

**CI (optional):** To deploy on push, add a GitHub Actions workflow that runs `npx supabase link` (using `SUPABASE_ACCESS_TOKEN`) and `npx supabase functions deploy chat`. Use `npx supabase db push` only when migrations change.

#### Running the index build

The script **`scripts/build-chat-index.mjs`** replaces the RAG index with the current **`content`** directory: it clears **vault_chunks**, then reads markdown from content (om-outer-mind submodule), chunks it, embeds with Voyage (voyage-4-lite, `input_type: "document"`), and inserts. So the index always reflects current content—**run it after removing or changing content** so removed files are no longer indexed. After pushing these changes to GitHub, someone else can run it as follows.

1. **Clone the repo and pull the latest** (including this script and the `content` submodule):
   ```bash
   git clone <repo-url> om-quartz && cd om-quartz
   git submodule update --init --recursive
   ```
   If the repo is already cloned, run `git pull` and then:
   ```bash
   git submodule update --init --recursive
   ```
   so that **`content/`** is populated with om-outer-mind.

2. **Install dependencies** (from repo root):
   ```bash
   npm install
   ```

3. **Set environment variables** for Voyage and Supabase (same as used by the Edge Function and dashboard). Required:
   - **VOYAGE_API_KEY** — Voyage AI API key.
   - **SUPABASE_URL** — Supabase project URL (e.g. `https://<project-ref>.supabase.co`).
   - **SUPABASE_SERVICE_ROLE_KEY** — Supabase service role key (Dashboard → Project Settings → API → service_role secret).
   Export them or put them in a `.env` file at the repo root; the script loads `.env` automatically when present (do not commit `.env`).

4. **Run the script** from the repo root:
   ```bash
   npm run build:chat-index
   ```
   Or:
   ```bash
   node scripts/build-chat-index.mjs
   ```
   The script clears **vault_chunks**, then inserts only chunks from the current **content/** directory. Removed files are no longer in the index. No need to redeploy the chat function; the next request will use the updated table.

**When to re-run:** After updating the **content** submodule, after **removing** files from **content/**, or when you add/change markdown. Re-run so the index matches current content; optionally refresh the submodule first:
   ```bash
   git submodule update --remote content
   npm run build:chat-index
   ```

### 4.4 Success Criteria

- [ ] A user can open any page, use the chat (toggle button → centered modal with blurred backdrop), ask a question, and receive an answer grounded in om-outer-mind content.
- [ ] The modal works without authentication and runs on free-tier infrastructure.
- [ ] One documented way to refresh vault-derived content and re-deploy or re-index.
- [ ] No vault write access; no exposure of API keys or full vault to the client.
- [ ] Architecture and data model do not preclude adding om-inner-mind (and `ai-ready` filtering).

### 4.5 Next steps (improvements)

- **Chat with SPA enabled:** The PoC uses `enableSPA: false` so the chat icon works on every page (see §4.2 Placement and behaviour). A future improvement is to make the chat work with Quartz SPA routing enabled: the icon should open the modal after client-side navigation, and conversation state could persist across in-app navigations within the same session. This likely requires changes in how Quartz patches the document head on nav (e.g. re-executing or re-loading the postscript so the modal mounts and registers correctly).

## 5. Iteration 2 – Future Work (outline)

These are not part of the proof-of-concept and may be built in this repo or as a separate application.

### 5.1 Web Application

- Dedicated chat UI (single-page app) instead of or in addition to the chat modal.
- May live in this repository or a separate app; decision deferred.
- Same principles: on-demand context, no full vault load; support for multiple vaults and scoping by role.

### 5.2 Subscribers & Members

- **Subscribers** are users who draw on OM resources (om-outer-mind and filtered notes from om-inner-mind). They may be prospective members or independent researchers. They pay for a subscription or provide proof-of-donation.
- **Members** are users who have full read and write access to all OM resources (om-outer-mind and om-inner-mind). They are granted full access to the chat for research and development that aligns with the OM programme.

### 5.3 Multi-Vault Support

- Content scope and permissions vary by role: public (om-outer-mind, read only), subscribers  (om-outer-mind and filtered om-inner-mind, read only), member (om-outer-mind and filtered om-inner-mind, read and write).
