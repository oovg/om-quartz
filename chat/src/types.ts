export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatModalProps {
  /** Base URL for the chat API (e.g. https://api.example.com/chat). No trailing slash. */
  apiBaseUrl?: string
  /** Placeholder for the input field */
  inputPlaceholder?: string
  /** Title shown above the chat */
  title?: string
}
