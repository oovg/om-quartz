# Interactive Mind Chat

Modular chat package for the OM Quartz docs site. Renders a **centered modal** opened via a **chat icon** next to the theme/reader icons; blurred backdrop when open; talks to a chat API (RAG + LLM).

- **Spec:** [SPEC.md](./SPEC.md)
- **Modal:** Preact component in `src/ChatModal.tsx`; mounted by Quartz via `quartz/components/scripts/chat.inline.ts`.

## Configuring the API

The modal calls `POST {apiBaseUrl}/chat` with `{ message, history }` and expects `{ reply }`. By default `apiBaseUrl` is empty, so the modal shows a “not configured” message.

To point at a backend, the mount script or component would need to pass `apiBaseUrl` (e.g. from a data attribute or global config). For now you can extend `ChatModal` props in `chat.inline.ts` when you add a serverless endpoint.
