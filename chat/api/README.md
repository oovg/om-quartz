# Agent API (with x402 monetization)

This directory contains documentation for the **agent-facing API** behind the OM Quartz chat modal.

## What agents can call

- `POST {CHAT_API_BASE_URL}/chat` (minimal, UI-compatible)
- `POST {CHAT_API_BASE_URL}/v1/chat/completions` (OpenAI-style)

Both endpoints use the same underlying **RAG + LLM** behavior (Voyage embeddings + pgvector retrieval + Claude Haiku).

## Monetization

When enabled, the API can require payment per call using **x402** (HTTP `402 Payment Required` + agent retry with payment proof).

## Full contract

For the machine-readable request/response details and the x402 flow, see `AGENT_API_SPEC.md`.

