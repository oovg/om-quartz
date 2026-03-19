# Interactive Mind Chat

Modular chat package for the OM Quartz docs site. Renders a **centered modal** opened via a **chat icon** next to the theme/reader icons; blurred backdrop when open; talks to a chat API (RAG + LLM).

- **Spec:** [SPEC.md](./SPEC.md) — implementation-specific design and decisions for this repo (stack, data model, wiring into Quartz, Supabase/Voyage/Anthropic usage). Updated as a *working document* while the chat evolves.
- **Build:** [BUILD.md](./BUILD.md) — generic instructions for adding a similar chat modal and RAG stack to a brand-new Quartz site.
- **SPA Bug:** [BUG_SPA.md](./BUG_SPA.md) — debugging attempts to make the chat modal work reliably with Quartz SPA routing enabled.
- **API:** [api/README.md](./api/README.md) — agent-facing API documentation (including x402 pay-per-call monetization).

## Configuring the API

The chat API base URL is set at **build time** via the `CHAT_API_BASE_URL` environment variable (see [SPEC.md](./SPEC.md) § Supabase setup, step 7). The modal then calls `POST {apiBaseUrl}/chat` with `{ message, history }` and expects `{ reply }`. Each item in `history` has `role: "user" | "assistant"` and `content: string` (aligned with Anthropic’s message roles). On error the API may return `{ error: string }`; the modal shows that message when present. By default, if `CHAT_API_BASE_URL` is not set, `apiBaseUrl` is empty and the modal shows a “not configured” message. Do not commit the URL to the repo.

**SPA navigation:** With Quartz’s SPA routing enabled (`enableSPA: true`), the chat icon often stops working after you navigate to another page. **Use `enableSPA: false`** in `quartz.config.ts` so the chat works on every page (each navigation is a full load; messages do not persist across navigations). Making the chat work with SPA enabled is documented as a next step in [SPEC.md](./SPEC.md) §4.5. See also [BUG_SPA.md](./BUG_SPA.md) for a detailed log of attempted fixes and test procedures.

## Updating what the chat knows

The chat answers using a **knowledge base** built from the **content** folder (the om-outer-mind docs). Whenever you add, edit, or remove files in that folder, you need to **rebuild the index** so the chat’s answers stay accurate. Below are step-by-step instructions.

### When to update

- You **added** new markdown files to the content folder.
- You **edited** existing markdown (so answers should reflect the new text).
- You **removed** files (so the chat should no longer use that content).

Run the index build **after** any of these changes so the chat reflects the current content.

### What you need before starting

1. **The repo on your computer** — either already cloned or clone it and open a terminal in the repo folder.
2. **The content folder present** — it’s a submodule; if `content/` is empty, see step 1 below.
3. **A `.env` file in the repo root** with three variables (ask your team or admin if you don’t have them):
   - `VOYAGE_API_KEY` — Voyage AI API key
   - `SUPABASE_URL` — your Supabase project URL (e.g. `https://xxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (Dashboard → Project Settings → API → service_role)

Do **not** commit the `.env` file; it’s already in `.gitignore`.

### Step-by-step: rebuild the chat index

Do these steps from the **repo root** (the folder that contains `package.json` and the `content` folder).

1. **Get the latest content (if you use the submodule)**  
   For most people, you just need the content at the commit this repo already points to:
   ```bash
   git submodule update --init --recursive
   ```
   If you already have content and only changed files locally, you can skip this.

   #### For maintainers: updating the submodule to the latest upstream content

   If you maintain this repo and want to move the `content` submodule forward to the latest commit on its configured branch, you can run:
   ```bash
   git submodule update --remote --recursive
   git status # verify updated submodule pointers
   git commit -am "Update content submodule"
   git push
   ```
   This fetches the latest commits from the submodule’s remote, updates the submodule working tree, and then records the new commit pointer in this repo.

2. **Install dependencies (if you haven’t already)**  
   ```bash
   npm install
   ```

3. **Run the index build**  
   ```bash
   npm run build:chat-index
   ```
   The script reads all markdown from the `content/` folder, prepares it for the chat, and updates the database. When it finishes, the chat will use the new content on the next question.

That’s it. You don’t need to redeploy the site or the chat API; the next time someone uses the chat, they’ll get answers based on the updated content.
