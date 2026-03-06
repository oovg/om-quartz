function bindLaunchers() {
  const buttons = document.querySelectorAll<HTMLButtonElement>("button.chatlaunch")
  for (const btn of buttons) {
    // Avoid duplicate handlers when re-running on SPA navigation
    if (btn.dataset.omChatBound === "1") continue
    btn.dataset.omChatBound = "1"

    const handler = () => {
      const w = window as unknown as { omChatOpen?: () => void }
      w.omChatOpen?.()
    }
    btn.addEventListener("click", handler)
  }
}

bindLaunchers()
document.addEventListener("nav", () => {
  bindLaunchers()
})

