import { render, createElement } from "preact"
import { ChatModal } from "chat"

function mount() {
  const root = document.getElementById("om-chat-root")
  if (root) {
    render(createElement(ChatModal, {}), root)
  }
}

mount()
document.addEventListener("nav", () => {
  mount()
})
