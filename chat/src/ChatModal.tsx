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
            role: "agent",
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

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(errText || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as { reply?: string }
      const reply = data?.reply ?? "No reply returned."
      setMessages((prev) => [...prev, { role: "agent", content: reply }])
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong."
      setMessages((prev) => [
        ...prev,
        { role: "agent", content: `Error: ${message}` },
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
                        : "om-chat__message om-chat__message--agent"
                    }
                  >
                    <span class="om-chat__message-role">{m.role === "user" ? "You" : "Mind"}</span>
                    <div class="om-chat__message-content">{m.content}</div>
                  </div>
                ))}
                {loading && (
                  <div class="om-chat__message om-chat__message--agent">
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

