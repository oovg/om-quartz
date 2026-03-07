#!/usr/bin/env node
/**
 * Build RAG index from the content directory (om-outer-mind submodule).
 * Chunks markdown, embeds with Voyage voyage-4-lite, upserts into Supabase vault_chunks.
 *
 * Prerequisites:
 *   - content/ populated (git submodule: git submodule update --init --recursive)
 *   - Env: VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *     (set in shell or in a .env file at repo root; .env is loaded automatically if present)
 *
 * Usage: node scripts/build-chat-index.mjs
 *    or: npm run build:chat-index
 */

import fs from "node:fs/promises"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

// Load .env from repo root so "npm run build:chat-index" works with a root .env file
try {
  const envPath = path.resolve(process.cwd(), ".env")
  const raw = await fs.readFile(envPath, "utf8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=")
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim()
        let val = trimmed.slice(eq + 1).trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1).replace(/\\(.)/g, "$1")
        if (!(key in process.env)) process.env[key] = val
      }
    }
  }
} catch (e) {
  if (e?.code !== "ENOENT") throw e
}

const CONTENT_DIR = "content"
const VOYAGE_MODEL = "voyage-4-lite"
const VOYAGE_BATCH_SIZE = 32
const MAX_CHUNK_CHARS = 6000

function stripFrontmatter(raw) {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)
  return match ? match[1].trim() : raw.trim()
}

/** Split a long string into chunks of at most MAX_CHUNK_CHARS, preferring line boundaries. */
function splitOversized(block) {
  if (block.length <= MAX_CHUNK_CHARS) return [block]
  const result = []
  let rest = block
  while (rest.length > 0) {
    if (rest.length <= MAX_CHUNK_CHARS) {
      result.push(rest)
      break
    }
    const slice = rest.slice(0, MAX_CHUNK_CHARS)
    const lastNewline = slice.lastIndexOf("\n")
    const splitAt = lastNewline >= Math.floor(MAX_CHUNK_CHARS / 2) ? lastNewline + 1 : MAX_CHUNK_CHARS
    result.push(rest.slice(0, splitAt).trim())
    rest = rest.slice(splitAt).trim()
  }
  return result
}

function chunkByHeadings(text) {
  const sections = text.split(/(?=^#{1,6}\s)/m).filter(Boolean).map((s) => s.trim())
  const chunks = []
  for (const section of sections) {
    if (section.length <= MAX_CHUNK_CHARS) {
      chunks.push(section)
    } else {
      const parts = section.split(/\n\n+/)
      let current = ""
      for (const part of parts) {
        if (part.length > MAX_CHUNK_CHARS) {
          if (current.length > 0) {
            chunks.push(current.trim())
            current = ""
          }
          chunks.push(...splitOversized(part))
        } else if (current.length + part.length + 2 > MAX_CHUNK_CHARS && current.length > 0) {
          chunks.push(current.trim())
          current = part
        } else {
          current = current ? current + "\n\n" + part : part
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }
  }
  return chunks.length > 0 ? chunks : [text.slice(0, MAX_CHUNK_CHARS)]
}

async function collectChunks(contentDir) {
  const chunks = []
  async function walk(dir, base = "") {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      const rel = base ? `${base}/${ent.name}` : ent.name
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name.startsWith(".")) continue
        await walk(path.join(dir, ent.name), rel)
      } else if (ent.name.endsWith(".md")) {
        const fullPath = path.join(dir, ent.name)
        const raw = await fs.readFile(fullPath, "utf-8").catch(() => "")
        const text = stripFrontmatter(raw)
        if (!text) continue
        const sectionChunks = chunkByHeadings(text)
        for (let i = 0; i < sectionChunks.length; i++) {
          chunks.push({
            path: sectionChunks.length > 1 ? `${rel}#chunk-${i + 1}` : rel,
            text: sectionChunks[i],
          })
        }
      }
    }
  }
  await walk(contentDir)
  return chunks
}

async function embedBatch(voyageApiKey, texts) {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${voyageApiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: VOYAGE_MODEL,
      input_type: "document",
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage API ${res.status}: ${err}`)
  }
  const data = await res.json()
  const rawList = data?.data
  const embeddings = Array.isArray(rawList)
    ? rawList.map((d) => d?.embedding).filter(Array.isArray)
    : []
  if (embeddings.length !== texts.length) {
    throw new Error(`Voyage returned ${embeddings.length} embeddings for ${texts.length} inputs`)
  }
  return embeddings
}

async function main() {
  const voyageApiKey = process.env.VOYAGE_API_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!voyageApiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env. Required: VOYAGE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const contentDir = path.resolve(process.cwd(), CONTENT_DIR)
  try {
    await fs.access(contentDir)
  } catch {
    console.error(`Content directory not found: ${contentDir}`)
    console.error("Initialize the submodule: git submodule update --init --recursive")
    process.exit(1)
  }

  console.log("Collecting chunks from", contentDir, "...")
  const chunks = await collectChunks(contentDir)
  console.log("Chunks:", chunks.length)

  if (chunks.length === 0) {
    console.log("No markdown chunks found. Exiting.")
    process.exit(0)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log("Clearing existing vault_chunks...")
  for (;;) {
    const { data: batch, error: selectError } = await supabase.from("vault_chunks").select("id").limit(1000)
    if (selectError) {
      console.error("Select error (vault_chunks):", selectError.message)
      process.exit(1)
    }
    if (!batch?.length) break
    const { error: deleteError } = await supabase.from("vault_chunks").delete().in("id", batch.map((r) => r.id))
    if (deleteError) {
      console.error("Delete error:", deleteError.message)
      process.exit(1)
    }
  }

  console.log("Embedding and inserting in batches of", VOYAGE_BATCH_SIZE, "...")
  for (let i = 0; i < chunks.length; i += VOYAGE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + VOYAGE_BATCH_SIZE)
    const texts = batch.map((c) => c.text)
    const embeddings = await embedBatch(voyageApiKey, texts)
    const rows = batch.map((c, j) => ({
      path: c.path,
      text: c.text,
      embedding: embeddings[j],
    }))
    const { error } = await supabase.from("vault_chunks").insert(rows)
    if (error) {
      console.error("Insert error:", error.message)
      process.exit(1)
    }
    console.log(`  ${Math.min(i + VOYAGE_BATCH_SIZE, chunks.length)} / ${chunks.length}`)
  }

  console.log("Done. vault_chunks has", chunks.length, "rows.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
