# Bug: Chat modal does not open after SPA navigation

When Quartz SPA routing is enabled (`enableSPA: true`), the chat launcher icon stops opening the modal after the user navigates to another page via client-side navigation. The search bar continues to work after navigation.

## Attempted 1: `nav` event re-initialization (reverted)

**What was tried:** Mirror the search bar’s behavior by re-initializing the chat on every SPA navigation using the `nav` custom event.

1. **`quartz/components/scripts/chat.inline.ts`**
   - Moved the mount logic into a `mountChat()` function.
   - Called `mountChat()` on initial load.
   - Added `document.addEventListener("nav", mountChat)` so that after each SPA navigation the modal is re-mounted into the new page’s `#om-chat-root` (the previous root is removed when the body is morphed).

2. **`quartz/components/scripts/chatLauncher.inline.ts`**
   - Added `document.addEventListener("nav", bindLaunchers)` so that after each navigation the new launcher buttons get click handlers that call `window.omChatOpen()`.

**Why this approach:** Search works after nav because it registers a `nav` listener and re-runs `setupSearch()` on the current DOM, re-binding to the new search container and button. The chat was doing a one-time mount and one-time button binding, so after the body is morphed the old modal root and old buttons are gone and the new ones have no handlers. Re-running mount and bind on `nav` was intended to fix that.

**Why it was reverted:** This solution had been tried before and did not resolve the issue. It is documented here so we don’t repeat it and can try a different strategy.

## Attempt 2: event delegation + deferred re-mount (did not work)

**Launcher (`chatLauncher.inline.ts`):** Used **event delegation** instead of binding to buttons. A single `document.addEventListener("click", ...)` checked `event.target instanceof Element && event.target.closest("button.chatlaunch")` and then called `window.omChatOpen?.()`. This listener is on `document`, so it is not removed when the body is morphed; it will see clicks on launcher buttons on any page without re-binding on `nav`.

**Modal (`chat.inline.ts`):** Still re-mounted on `nav` so the new page’s `#om-chat-root` would get the modal and set `window.omChatOpen`. To avoid running before the morphed DOM was ready, the re-mount ran inside `queueMicrotask(mountChat)` when the `nav` event fired.

**Outcome:** In practice, this still did **not** reliably make the chat open after SPA navigation. The launcher click handler ran, but the modal was not consistently mounted / wired in time after navigation, so the chat often still failed to open. This attempt is recorded here and considered unsuccessful.

## Attempt 3: bootstrap-on-click with `autoOpenOnMount` (did not work)

**Idea:** Instead of trying to re-mount eagerly on every `nav`, define a persistent **bootstrap function on `window`** (created once when the script loads) that can mount and immediately **open** the chat modal on demand. The launcher, on click, will:

- If `window.omChatOpen` exists (modal already mounted on this page), just call it.
- Otherwise, call `window.omChatBootstrapOpen()` which mounts the modal into the current page’s `#om-chat-root` with a prop that tells it to **start open** (no need to wait for `omChatOpen` to be registered by `useEffect`).

**Why this might help (in theory):**  
- The script bundle (where `mountChat` / `omChatBootstrapOpen` live) is loaded once and persists across SPA navigations, even though the body is morphed.  
- After SPA navigation, the new page has a fresh `#om-chat-root`, but there is no modal mounted and no `omChatOpen` handler. The bootstrap function can always look up the **current** `#om-chat-root`, mount a new modal instance with `autoOpenOnMount: true`, and let it manage its own open state.  
- This avoids relying on `nav` timing and keeps the logic focused on “open on click,” using the fact that `window`-level functions survive SPA navigations.

**What changed in code:**

- `chat/src/types.ts`: added `autoOpenOnMount?: boolean` to `ChatModalProps`.
- `chat/src/ChatModal.tsx`: initialized `open` from `!!autoOpenOnMount` instead of `false`.
- `quartz/components/scripts/chat.inline.ts`: introduced `mountChat(autoOpenOnMount?)`; did an initial `mountChat(false)` and exposed `window.omChatBootstrapOpen = () => mountChat(true)`.
- `quartz/components/scripts/chatLauncher.inline.ts`: on click of `button.chatlaunch`, first tried `window.omChatOpen()`, and if absent, called `window.omChatBootstrapOpen()` to mount and immediately open the modal.

**Outcome:** This also did **not** fix the bug: after SPA navigation, clicking the chat icon still did not reliably open the modal. Even with the bootstrap function and `autoOpenOnMount`, the combination of SPA morphing, window state, and how/when scripts run meant the modal was not consistently mounted and interactive in time for the launcher click.

---

## How to rebuild and test each attempt

Use these steps whenever changing chat / SPA-related code for this bug:

1. **Clear the Quartz cache**
   - From the repo root:
     - `rm -rf .quartz-cache`

2. **Rebuild and serve the site**
   - From the repo root:
     - `npx quartz build --serve -d content`
   - This is the expected way to run the application for these tests.

3. **Open in a fresh browser context**
   - Either:
     - Do a **hard refresh** in the browser (clear cache for the site), or
     - Open the served URL in a **new incognito/private window**.

4. **Test behavior with SPA enabled**
   - Ensure `enableSPA: true` in `quartz.config.ts` when testing SPA-focused attempts.
   - Steps:
     1. Load the home page.
     2. Click the chat icon and confirm that the modal opens.
     3. Click an internal link (client-side navigation) to another page (e.g. a doc page).
     4. Click the chat icon again and observe whether the modal opens.
   - Optionally, keep the browser dev tools console open to watch for JavaScript errors or warnings during navigation and chat icon clicks.

5. **Fallback sanity check**
   - To confirm the regression is strictly tied to SPA:
     - Set `enableSPA: false` in `quartz.config.ts`.
     - Repeat steps 1–3 above and verify the chat works after full page loads.

These are the steps that were followed for the attempts documented above and should be reused for any future experiments on this bug.
