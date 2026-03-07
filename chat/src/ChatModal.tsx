import { useState, useRef, useEffect } from "preact/hooks"
import type { ChatMessage, ChatModalProps } from "./types"

const defaultApiBaseUrl = ""
const defaultPlaceholder = "What is The Open Machine?"
const defaultTitle = "Interactive Mind Chat"

export function ChatModal(props: ChatModalProps = {}) {
  const {
    apiBaseUrl = defaultApiBaseUrl,
    inputPlaceholder = defaultPlaceholder,
    title = defaultTitle,
  } = props

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      el.scrollTo(0, el.scrollHeight)
    })
    return () => cancelAnimationFrame(raf)
  }, [messages])

  useEffect(() => {
    const w = window as unknown as {
      omChatOpen?: () => void
      omChatClose?: () => void
      omChatToggle?: () => void
    }

    const openFn = () => setOpen(true)
    const closeFn = () => setOpen(false)
    const toggleFn = () => setOpen((prev) => !prev)

    w.omChatOpen = openFn
    w.omChatClose = closeFn
    w.omChatToggle = toggleFn

    return () => {
      if (w.omChatOpen === openFn) delete w.omChatOpen
      if (w.omChatClose === closeFn) delete w.omChatClose
      if (w.omChatToggle === toggleFn) delete w.omChatToggle
    }
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: ChatMessage = { role: "user", content: text }
    const historyForRequest = messages

    setInput("")
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)
    setError(null)

    try {
      if (!apiBaseUrl) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "The chat API is not configured yet.",
          },
        ])
        return
      }

      const res = await fetch(`${apiBaseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyForRequest }),
      })

      const raw = await res.text()
      let data: { reply?: string; error?: string } = {}
      try {
        if (raw) data = JSON.parse(raw) as { reply?: string; error?: string }
      } catch {
        if (!res.ok) throw new Error(raw.trim() || `HTTP ${res.status}`)
        throw new Error("Invalid response from chat API")
      }
      // Check HTTP status first
      if (!res.ok) {
        const errMsg = typeof data?.error === "string" ? data.error.trim() : ""
        const fallback = `Request failed (${res.status})`
        throw new Error(errMsg || fallback)
      }

      // Application-level error in successful response body
      const appErr = typeof data?.error === "string" ? data.error.trim() : ""
      if (appErr) {
        throw new Error(appErr)
      }

      if (typeof data?.reply !== "string") {
        throw new Error(raw.trim() ? "Invalid response from chat API" : "Empty response from chat API")
      }
      const reply = data.reply.trim()
      if (!reply) {
        throw new Error("Empty response from chat API")
      }
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong."
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${message}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: Event) => {
    e.preventDefault()
    sendMessage()
  }

  return (
    <div class="om-chat-shell">
      {open && (
        <div
          class="om-chat-modal"
          role="dialog"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <div class="om-chat-modal__panel" onClick={(e) => e.stopPropagation()}>
            <div class="om-chat-modal__header">
              <h3 class="om-chat-modal__title">{title}</h3>
              <button
                type="button"
                class="om-chat-modal__close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
            <div class="om-chat">
              <div class="om-chat__messages" ref={listRef} role="log" aria-live="polite">
                {messages.length === 0 && (
                  <p class="om-chat__empty">Probe the mind of The Open Machine...</p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    class={
                      m.role === "user"
                        ? "om-chat__message om-chat__message--user"
                        : "om-chat__message om-chat__message--assistant"
                    }
                  >
                    <span class="om-chat__message-role">{m.role === "user" ? "You" : "Mind"}</span>
                    <div class="om-chat__message-content">{m.content}</div>
                  </div>
                ))}
                {loading && (
                  <div class="om-chat__message om-chat__message--assistant">
                    <span class="om-chat__message-role">OM</span>
                    <div class="om-chat__message-content om-chat__message-content--loading">
                      …
                    </div>
                  </div>
                )}
              </div>
              {error && <p class="om-chat__error">{error}</p>}
              <form class="om-chat__form" onSubmit={handleSubmit}>
                <textarea
                  ref={textareaRef}
                  class="om-chat__input"
                  placeholder={inputPlaceholder}
                  value={input}
                  rows={4}
                  onInput={(e) => {
                    setInput((e.target as HTMLTextAreaElement).value)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  disabled={loading}
                  aria-label="Chat message"
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

