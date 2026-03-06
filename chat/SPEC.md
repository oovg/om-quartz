# Interactive Mind Chat - Specification

> **Working document.** Use the [Progress](#progress) section to track implementation status. Update checkboxes and notes as you go.

## Progress

### Iteration 1: Chat Modal (proof-of-concept)

| Task | Status | Notes |
|------|--------|-------|
| Chat package with Preact modal (UI + placeholder API) | ✅ Done | `chat/` with ChatModal |
| Quartz integration: Chat component, layout, root dependency | ✅ Done | Modal with blurred backdrop |
| Confirm stack: host, serverless, embedding, vector/index, LLM | ⬜ Pending | See Sections 4.3–4.5 |
| Chat API endpoint (serverless) | ⬜ Pending | Placeholder or real (Vercel/Supabase) |
| Define index scope for om-outer-mind | ⬜ Pending | Paths/tags for public FAQ |
| RAG: embed om-outer-mind, vector store or static index | ⬜ Pending | Voyage AI + Supabase or static |
| LLM integration | ⬜ Pending | OpenAI/Anthropic/etc. |
| Document: run locally, deploy, refresh index | ⬜ Pending | README in `chat/` |

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
- **Iteration 2+** (web application, subscriber/member pathways, multi-vault) is outlined in **Section 7**.

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

**Recommendation:** Static site (e.g. GitHub Pages for Quartz) + a thin serverless backend (e.g. Vercel Serverless or Supabase Edge Functions) that performs retrieval (from a pre-built index or free vector DB) and calls an LLM. Keeps keys and vault content off the client and allows adding om-inner-mind later behind the same API with different indices/scopes.

#### Hosting & Deployment

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **GitHub Pages** | Host Quartz static site | Free; good for docs; no server-side logic |
| **Vercel** | Host Quartz and/or serverless chat API | Generous free tier; serverless functions; easy Git deploy |
| **Netlify** | Alternative to Vercel for site + functions | Free tier; functions; similar model |
| **Cloudflare Pages + Workers** | Static site + edge functions | Free tier; low latency; Workers for chat API |
| **Supabase** | DB, auth (later), Edge Functions for chat API | Free tier; pgvector possible for small vector store or store metadata only and use external embedding/vector API |

**Recommendation:** GitHub Pages for Quartz (if already in use) + Vercel or Supabase for a small serverless API that handles chat and retrieval. This avoids running a dedicated server and stays within free tiers for low traffic.

#### Embedding & Retrieval

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **Voyage AI** | Embeddings for RAG | Free tier available; good for retrieval-oriented embeddings |
| **Supabase pgvector** | Store embeddings and run similarity search | Free tier; limited size; suitable for om-outer-mind PoC |
| **Vercel KV / Upstash** | Key-value or simple cache; not a full vector DB | Free tier; can cache or store small state |
| **Build-time index in repo** | Precomputed embeddings as JSON (or similar) in repo; loaded by serverless at runtime | No vector DB cost; simple; index refresh = rebuild + deploy or scheduled job |

**Recommendation:** Use **Voyage AI** (or another free-tier embedding API) to embed om-outer-mind content at build time or via a scheduled job; store embeddings and metadata in Supabase (pgvector) or as a static index in the repo and load in the serverless function. Retrieval = vector search (or simple keyword fallback) then pass top chunks to LLM.

#### LLM

| Service | Use case | Free tier notes |
|---------|----------|------------------|
| **OpenAI** | Chat completion | Usage-based; free credits for new accounts |
| **Anthropic** | Chat completion | Usage-based; free tiers / credits |
| **Vercel AI SDK** | Unified interface to multiple providers | No cost by itself; depends on provider |

**Recommendation for PoC:** One provider with a free tier or trial (e.g. OpenAI or Anthropic via Vercel AI SDK or direct API) to keep cost at zero for low traffic. Optional: rule-based or template overrides for a few high-risk or sensitive topics.

#### Content Scope & Safety

- **Scope:** om-outer-mind only. No om-inner-mind in the first version.
- **Indexing:** Only content intended for public FAQ (entire om-outer-mind or a defined subset by path/tag if needed).
- **No write:** Read-only; no creating or editing vault notes from the modal.
- **Secrets:** API keys and vault content only in backend/env or serverless config; never in client bundle.

#### Modal UX and Design

- **Placement and behaviour:** The chat is a **modal** **centered** in the viewport. It is **hidden by default**. A **chat icon launcher** sits next to the theme and reader icons; clicking it opens the modal. When open, the overlay covers the **entire viewport (including sidebars)**: the rest of the site is **blurred**. The modal panel sits above the backdrop and is centered. The user can close the modal via a close button in the modal header or by clicking outside the panel (the overlay). The chat appears on **all pages** (homepage and every content/list page) via the shared layout.
- **Content:** Message list (user + agent), multi-line text input, optional loading/typing indicator. **Enter** sends a message; **Shift+Enter** inserts a newline (no separate send button).
- **Scope:** No threads, no multi-room, no persistence requirement for PoC.
- **Accessibility:** Basic keyboard use and readable text; toggle and modal use appropriate ARIA (e.g. `aria-expanded`, `role="dialog"`, `aria-label`).

#### Refresh & Operations

- **Index refresh:** Document one repeatable process: e.g. "On vault change, run script to re-embed om-outer-mind and update index (or redeploy with new index)."
- **Availability:** Best effort; short outages acceptable for PoC.
- **No SLA, no billing, no usage caps** for this iteration.

#### Embedded Modal in Quartz

Quartz is a static site generator. Pages are composed of **layout slots** filled by **components** (Preact-based). To show the chat on **all pages** as a centered modal (toggle button in lower-right):

1. **Layout:** Add the chat component to **`sharedPageComponents.afterBody`** in `quartz.layout.ts`. That way it is included on every page (homepage, content pages, list pages). The chat is rendered as a fixed-position shell (toggle button + modal), not in the sidebar.
2. **Component:** The Quartz component renders a mount div and attaches the modal script and styles. Components live under `quartz/components/`, are re-exported in `quartz/components/index.ts`, and can attach `.css` and `.afterDOMLoaded` (see Quartz docs: [creating components](../docs/advanced/creating%20components.md), [layout](../docs/layout.md)).
3. **Interactivity:** The modal is mounted in `.afterDOMLoaded` (or an imported `.inline.ts` script). The modal is opened via a **header icon launcher** that calls a global `window.omChatOpen()` function exposed by the modal after it mounts. The modal is centered with a blurred backdrop; the user can close the modal via a close control or backdrop. Listen for the `"nav"` event and use `window.addCleanup` on navigation if using SPA routing.

**Modular chat package:** The spec and chat modal source live in **chat/** with its own `package.json`. The Quartz component renders a mount div and uses an inline script that imports and mounts the modal from the `chat` package (workspace package approach).

### 4.4 Success Criteria

- [ ] A user can open any page, use the chat (toggle button → centered modal with blurred backdrop), ask a question, and receive an answer grounded in om-outer-mind content.
- [ ] The modal works without authentication and runs on free-tier infrastructure.
- [ ] One documented way to refresh vault-derived content and re-deploy or re-index.
- [ ] No vault write access; no exposure of API keys or full vault to the client.
- [ ] Architecture and data model do not preclude adding om-inner-mind (and `ai-ready` filtering).

## 5. Iteration 2 – Future Work (outline)

These are not part of the proof-of-concept and may be built in this repo or as a separate application.

### 7.1 Web Application

- Dedicated chat UI (single-page app) instead of or in addition to the chat modal.
- May live in this repository or a separate app; decision deferred.
- Same principles: on-demand context, no full vault load; support for multiple vaults and scoping by role.

### 7.2 Subscribers & Members

- **Subscribers** are users who draw on OM resources (om-outer-mind and filtered notes from om-inner-mind). They may be prospective members or independent researchers. They pay for a subscription or provide proof-of-donation.
- **Members** are users who have full read and write access to all OM resources (om-outer-mind and om-inner-mind). They are granted full access to the chat for research and development that aligns with the OM programme.

### 7.3 Multi-Vault Support

- Content scope and permissions vary by role: public (om-outer-mind, read only), subscribers  (om-outer-mind and filtered om-inner-mind, read only), member (om-outer-mind and filtered om-inner-mind, read and write).
