# Interactive Mind Agent API

Modular agent-facing API documentation behind the OM Quartz chat modal.

- **Spec:** [SPEC.md](./SPEC.md) — agent API contract and x402 pay-per-call flow (working document)
- **Build:** [BUILD.md](./BUILD.md) — placeholder blueprint for building the agent API (and expanding later)

## What agents can call

- `POST {CHAT_API_BASE_URL}/chat` (minimal, UI-compatible)
- `POST {CHAT_API_BASE_URL}/v1/chat/completions` (OpenAI-style)

Both endpoints use the same underlying **RAG + LLM** behavior (Voyage embeddings + pgvector retrieval + Claude Haiku).

## Monetization (optional)

When enabled, the API can require payment per call using **x402** (HTTP `402 Payment Required` + agent retry with payment proof).

