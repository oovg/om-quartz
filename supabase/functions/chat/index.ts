// Chat Edge Function: POST { message, history } → RAG (Voyage + pgvector) + Claude Haiku 4.5 → { reply }.
// CORS: set ALLOWED_ORIGIN in Supabase secrets to your Quartz site origin (e.g. https://yourorg.github.io).
// RAG: set VOYAGE_API_KEY and run migration + index build so vault_chunks is populated.

import { createClient } from "npm:@supabase/supabase-js@2"

const ANTHROPIC_VERSION = "2023-06-01"
const MODEL = "claude-haiku-4-5"
const MAX_TOKENS = 1024
const VOYAGE_MODEL = "voyage-4-lite"
const RAG_MATCH_COUNT = 5

interface RequestBody {
  message?: string
  history?: Array<{ role: "user" | "assistant"; content: string }>
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin = origin || "*"
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  }
}

function jsonResponse(data: object, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  })
}

async function embedQuery(voyageApiKey: string, text: string): Promise<number[] | null> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageApiKey}` },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      input_type: "query",
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> }
  const embedding = data?.data?.[0]?.embedding
  return Array.isArray(embedding) ? embedding : null
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = Deno.env.get("ALLOWED_ORIGIN") ?? req.headers.get("Origin") ?? null

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin)
  }

  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!anthropicApiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY not configured" }, 500, origin)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, origin)
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return jsonResponse({ error: "Missing or empty message" }, 400, origin)
  }

  const history = Array.isArray(body.history) ? body.history : []
  const anthropicMessages: Array<{ role: "user" | "assistant"; content: string }> = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }))

  // RAG: embed query, search pgvector, build context (optional; works without Voyage/index)
  let contextBlock = ""
  const voyageApiKey = Deno.env.get("VOYAGE_API_KEY")
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (voyageApiKey && supabaseUrl && supabaseServiceKey) {
    const queryEmbedding = await embedQuery(voyageApiKey, message)
    if (queryEmbedding && queryEmbedding.length === 1024) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      const { data: chunks, error } = await supabase.rpc("match_vault_chunks", {
        query_embedding: queryEmbedding,
        match_count: RAG_MATCH_COUNT,
      })
      if (!error && Array.isArray(chunks) && chunks.length > 0) {
        const contextParts = (chunks as Array<{ path?: string; text?: string }>).map(
          (c) => (c.path ? `[${c.path}]\n${c.text ?? ""}` : c.text ?? "")
        )
        contextBlock =
          "Use the following context from the knowledge base to answer the user. If the context does not contain relevant information, say so.\n\n---\n\n" +
          contextParts.join("\n\n---\n\n")
      }
    }
  }

  // Build messages: system with context (if any) then conversation
  const systemContent =
    contextBlock ||
    "You are a helpful assistant. Answer concisely. If you do not have specific information, say so."
  anthropicMessages.push({ role: "user", content: message })

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemContent,
        messages: anthropicMessages,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error("Anthropic API error:", res.status, errText)
      return jsonResponse(
        { error: `LLM request failed: ${res.status}` },
        res.status >= 500 ? 502 : 400,
        origin
      )
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>
    }
    const content = data?.content
    const textBlock = Array.isArray(content)
      ? content.find((c) => c?.type === "text" && typeof c.text === "string")
      : null
    const reply = (textBlock?.text ?? "").trim()

    if (!reply) {
      return jsonResponse(
        { error: "LLM returned no reply" },
        502,
        origin
      )
    }

    return jsonResponse({ reply }, 200, origin)
  } catch (e) {
    console.error("Chat error:", e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Internal server error" },
      500,
      origin
    )
  }
})
