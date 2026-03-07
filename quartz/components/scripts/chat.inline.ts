import { render, createElement } from "preact"
import { ChatModal } from "chat"

function mount() {
  const root = document.getElementById("om-chat-root")
  if (root) {
    const apiBaseUrl = root.getAttribute("data-api-base-url") ?? ""
    render(createElement(ChatModal, { apiBaseUrl: apiBaseUrl || undefined }), root)
  }
}

mount()
document.addEventListener("nav", () => {
  mount()
})
