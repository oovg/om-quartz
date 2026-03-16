# Adding a RAG Chat to a Quartz Site

This document is a blueprint for adding a chat feature to a Quartz static site. The chat appears as a centered modal on every page, backed by a serverless API that answers questions using your site’s markdown content (RAG: retrieval-augmented generation). It assumes a **new Quartz project** with default configuration and no prior customizations. A reader or agent with no other context can follow these steps to implement the feature and configure the required services.

---

## 1. What You Will Build

- **Frontend:** A chat **modal** (centered, with blurred backdrop) that is hidden by default and opened via a **chat icon** in the page header (e.g. next to theme and reader icons). The modal shows a message list (user and assistant), a multi-line text input (Enter sends, Shift+Enter newline), and a loading indicator. It appears on all pages via the shared layout.
- **Backend:** A single **chat API** endpoint that accepts the current message and conversation history, runs RAG (embed query → similarity search over pre-indexed chunks → build context), calls an LLM, and returns the reply.
- **Index pipeline:** An **out-of-band script** that reads your site’s markdown from a content directory, chunks it, embeds chunks with an embedding API, and stores them in a vector database. The chat API uses this index at query time for retrieval only.

**Stack:**

- **Quartz** (static site), built and deployed e.g. to **GitHub Pages**.
- **Supabase:** Edge Functions (chat API) + Postgres with **pgvector** (vector store).
- **Voyage AI:** Embeddings (e.g. **voyage-4-lite**, 1024 dimensions).
- **Anthropic:** Chat completion (e.g. **Claude Haiku 4.5**).

**Assumptions:** You have a GitHub account. The site’s content is markdown in a single directory (e.g. `content/`).

---

## 2. API Contract

The modal calls the chat API with:

- **Request:** `POST {apiBaseUrl}/chat`  
  Body: `{ "message": string, "history": Array<{ "role": "user" | "assistant", "content": string }> }`
- **Success:** `200` with body `{ "reply": string }`
- **Error:** `4xx`/`5xx` with body `{ "error": string }` (optional; modal can show this to the user)

The backend must accept this contract. Conversation history is in Anthropic-style message roles; the backend sends it plus RAG context to the LLM.

---

## 3. Accounts and API Keys

Create the following accounts and obtain keys. Use a shared or project-specific email where appropriate.

| Service    | Purpose |
|-----------|---------|
| **Supabase** | One project: Postgres (pgvector) + Edge Functions (chat API). You need the project **URL**, **database password** (once), and **service role key** (Dashboard → Project Settings → API → service_role). |
| **Voyage AI** | Embeddings for RAG. Create an API key at voyageai.com. Model: **voyage-4-lite** (1024 dimensions). |
| **Anthropic** | LLM for chat replies. Create an API key; use model **claude-haiku-4-5** (or latest Haiku 4.5). |

**Secrets:**

- Store **Voyage** and **Anthropic** API keys only in **Supabase Edge Function secrets** (or project env). Never in the client or in the repository.
- Supabase provides **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** to Edge Functions at runtime; you do not set those in secrets.
- Add a payment method where required (e.g. Anthropic, Supabase) so usage is not hard-cut when free limits are reached.

**CORS:** The modal runs on your Quartz site origin (e.g. `https://yourorg.github.io` or your custom domain). The chat Edge Function must allow that origin in CORS (e.g. set **ALLOWED_ORIGIN** in Supabase secrets to that origin, or have the function reflect the request `Origin` header).

---

## 4. Implementation Steps

### 4.1 Chat package (modal UI)

Create a small **chat** package that exports a modal component and types.

- **Types:**  
  - `ChatMessage`: `{ role: "user" | "assistant", content: string }`.  
  - `ChatModalProps`: `apiBaseUrl?: string`, optional `title`, `inputPlaceholder`.
- **Modal component:**  
  - Renders a centered modal (hidden by default) with blurred full-viewport backdrop, message list, textarea (Enter to send, Shift+Enter for newline), and loading state.  
  - When `apiBaseUrl` is set: on submit, `POST {apiBaseUrl}/chat` with `{ message, history }`; display `reply` or `error`.  
  - When `apiBaseUrl` is missing: show a short “Chat is not configured” message.  
  - Expose a way to open the modal from outside: on mount, set **`window.omChatOpen`** (and optionally **`window.omChatClose`**, **`window.omChatToggle`**) so the Quartz launcher button can call **`window.omChatOpen()`** to open the modal.  
- **Build:** Package should be consumable by the Quartz build (e.g. a workspace package or bundled script). Use **Preact** (or React) for the modal so it fits Quartz’s component model.

### 4.2 Quartz integration

Set **`enableSPA: false`** in your Quartz config so each navigation is a full page load. The wiring below assumes full page loads; no “nav” event or re-mount logic is needed.

**Layout (in your layout file, e.g. `quartz.layout.ts`):**

- Add one component to the **afterBody** slot of the shared layout so it appears on every page. This component is the **Chat** component (mount point + script).
- Add a **Chat launcher** component in the header area on each page layout that has a header—for example, inside the same Flex or row as the theme toggle and reader-mode controls, so the chat icon sits next to them.

**Chat component (mount point + script):**

- The component runs at **build time** in Node. It must read the API base URL from **`process.env.CHAT_API_BASE_URL`** and render a single div with:
  - A **stable id** (e.g. `chat-root`) so the script can find it.
  - Attribute **`data-api-base-url`** set to that value (or empty if unset).
- Attach the component’s **CSS** and an **afterDOMLoaded** script. In Quartz, components can export `.css` and `.afterDOMLoaded`; the script runs in the browser once the DOM is ready.
- The **afterDOMLoaded script** should: (1) get the mount div by its id, (2) read `data-api-base-url` from the div, (3) import the modal from your chat package and render it into the div with that URL as the `apiBaseUrl` prop. With full page loads, the div is always present; no need to create it dynamically.

**Chat launcher component (button + script):**

- The component renders a **button** with a stable **class** (e.g. `chatlaunch`) and an **aria-label** (e.g. “Open chat”). Attach an **afterDOMLoaded** script that: (1) finds all elements with that button class, (2) for each, add a click listener that calls **`window.omChatOpen()`**. Use a data attribute (e.g. `data-chat-bound="1"`) to avoid binding the same button twice if the script runs more than once. With full page loads, binding once per page is enough; no document-level delegation or custom events are required.

**Modal → window:** The modal component must, on mount (e.g. in a `useEffect`), assign **`window.omChatOpen`** to a function that opens the modal (e.g. `() => setOpen(true)`). Optionally assign **`window.omChatClose`** and **`window.omChatToggle`**. The launcher script relies on `window.omChatOpen` being set after the Chat script has mounted the modal; because both scripts run in afterDOMLoaded, the order of execution should ensure the modal is mounted before the user can click the launcher.

**API URL at build time:** Set **`CHAT_API_BASE_URL`** when running the Quartz build (e.g. `CHAT_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1 npx quartz build`). Do not commit the URL; use CI secrets or a local env..

**Wiring summary:** afterBody → Chat component (renders div with id and `data-api-base-url`, plus afterDOMLoaded script that mounts the modal into that div). Header → ChatLauncher component (renders button with class `chatlaunch`, plus afterDOMLoaded script that binds click → `window.omChatOpen()`). When the user clicks the launcher, the modal (already mounted) opens because the modal set `window.omChatOpen` on mount.

### 4.3 Supabase: database and RPC

- **pgvector:** In a Supabase migration, enable the **vector** extension (in a schema such as `extensions`).
- **Table:** Create a table (e.g. **`vault_chunks`**) with columns: **id** (uuid, primary key), **path** (text, source path or slug), **text** (text, chunk content in markdown), **embedding** (vector(1024)). Optionally **created_at**.
- **RPC:** Create a Postgres function, e.g. **`match_vault_chunks(query_embedding vector(1024), match_count int)`**, that returns rows from that table ordered by cosine distance (`embedding <=> query_embedding`) with `LIMIT match_count` (cap at a sensible max, e.g. 20). Set `search_path` so the vector operator is found. The Edge Function will call this RPC instead of sending raw vectors.

### 4.4 Supabase: Edge Function (chat API)

Implement the chat endpoint under **`supabase/functions/chat/`**.

- **Handler:** On `POST`: parse `{ message, history }`; validate `message` is a non-empty string; normalize `history` to an array of `{ role: "user" | "assistant", content: string }`.
- **RAG:**  
  - Embed the user `message` with Voyage (**voyage-4-lite**, `input_type: "query"`).  
  - Call the match RPC with the query embedding and a small `match_count` (e.g. 5) to get the top chunks.  
  - Build a context string from the chunk `text` fields (e.g. “Answer using only this context: …” plus concatenated chunk text).  
- **LLM:** Call Anthropic Messages API (e.g. Claude Haiku 4.5) with the context (in system or user message) and the conversation history; get the reply.  
- **Response:** Return `{ reply }` with CORS headers. On error (missing keys, API failure, invalid body), return appropriate status and `{ error: string }`.  
- **Secrets:** Read **ANTHROPIC_API_KEY**, **VOYAGE_API_KEY**; optionally **ALLOWED_ORIGIN** for CORS. Use **SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** (provided by Supabase) to create a Supabase client and call the RPC.

### 4.5 Index build script

Implement a **Node script** that rebuilds the vector index from your markdown content.

- **Input:** A single **content directory** that contains the markdown files your site (and chat) should use (e.g. the same folder Quartz uses as source).
- **Behavior:**  
  - **Clear** the `vault_chunks` table (or delete all rows) so the index exactly matches current content (removed files disappear from the index).  
  - **Walk** the content directory for `.md` files; strip frontmatter; **chunk** by heading (and by paragraph/size limits for long sections; e.g. max chunk size ~6000 characters).  
  - **Embed** each chunk with Voyage (**voyage-4-lite**, `input_type: "document"`), in batches (e.g. 32 at a time).  
  - **Insert** into `vault_chunks` (id, path, text, embedding).  
- **Environment:** The script needs **VOYAGE_API_KEY**, **SUPABASE_URL**, **SUPABASE_SERVICE_ROLE_KEY** (e.g. from a `.env` file in the project root; do not commit `.env`).  
- **Run:** Invoke after content changes (add/edit/remove markdown). No need to redeploy the Edge Function when only the table data changes.

---

## 5. One-Time Supabase Setup

Do this once per Supabase project.

1. **Create a Supabase project** in the dashboard. Note the **project ref** (from URL or Settings → General) and the **database password** (shown once).
2. **Install and link:** From the project root, run `npm install` (if the Supabase CLI is a dev dependency) and link:  
   `npx supabase link --project-ref <your-project-ref>`  
   Use the database password or `SUPABASE_ACCESS_TOKEN` when prompted.
3. **Apply migrations:** Run `npx supabase db push` so the vector extension, `vault_chunks` table, and `match_vault_chunks` RPC exist.
4. **Set Edge Function secrets:** In Dashboard → Project Settings → Edge Functions (or via CLI), set:  
   **ANTHROPIC_API_KEY**, **VOYAGE_API_KEY**; optionally **ALLOWED_ORIGIN** (your Quartz site origin for CORS).
5. **Deploy the chat function:** From project root, run `npx supabase functions deploy chat`. The API will be at `https://<project-ref>.supabase.co/functions/v1/chat`.
6. **Configure the modal:** When building Quartz, set the environment variable **CHAT_API_BASE_URL** to `https://<project-ref>.supabase.co/functions/v1` (no trailing slash). Do not commit this value; use CI secrets or a local env when running the build. Example:  
   `CHAT_API_BASE_URL=https://<project-ref>.supabase.co/functions/v1 npx quartz build`
7. **Populate the index:** Run the index-build script (see 4.5) so the chat can answer from your content. After that, the next chat request will use the new index.

**Optional CI:** Add a workflow that runs `npx supabase link` (with `SUPABASE_ACCESS_TOKEN`) and `npx supabase functions deploy chat` on push. Run `npx supabase db push` only when migrations change. You can also run the index-build script in CI after content or code changes.

---

## 6. When to Re-Run the Index Build

Run the index script whenever your **content directory** changes in a way that should be reflected in chat answers:

- You **add** new markdown files.
- You **edit** existing markdown.
- You **remove** files (so they should no longer be in the index).

Re-run after pulling or updating content (e.g. from another repo or submodule) so the index matches the current content.

---

## 7. Summary Checklist

- [ ] Accounts and keys: Supabase (project + service role key), Voyage AI, Anthropic.
- [ ] Supabase: migration (pgvector, `vault_chunks`, `match_vault_chunks` RPC), Edge Function secrets (ANTHROPIC_API_KEY, VOYAGE_API_KEY, optional ALLOWED_ORIGIN), deploy chat function.
- [ ] Quartz: chat package (modal + types), Chat and ChatLauncher components, layout (afterBody + header launcher), Chat reads `CHAT_API_BASE_URL` at build time, `enableSPA: false`.
- [ ] Index script: read content dir → chunk → Voyage embed → clear + insert into `vault_chunks`; env vars for Voyage and Supabase.
- [ ] Build Quartz with `CHAT_API_BASE_URL` set; run index build so the chat has content to retrieve.

Once these are in place, users can open the chat from any page and get answers grounded in your site’s markdown.
