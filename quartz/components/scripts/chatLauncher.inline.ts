function bindLaunchers() {
  const buttons = document.querySelectorAll<HTMLButtonElement>("button.chatlaunch")
  for (const btn of buttons) {
    if (btn.dataset.chatBound === "1") continue
    btn.dataset.chatBound = "1"
    btn.addEventListener("click", () => {
      const w = window as unknown as { omChatOpen?: () => void }
      w.omChatOpen?.()
    })
  }
}

bindLaunchers()
