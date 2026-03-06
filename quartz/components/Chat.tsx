import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/chat.scss"

// @ts-ignore
import script from "./scripts/chat.inline"

const Chat: QuartzComponent = (_props: QuartzComponentProps) => {
  return (
    <div id="om-chat-root" class="om-chat-wrapper">
      {/* Modal is mounted here by chat.inline.ts after DOM load */}
    </div>
  )
}

Chat.css = style
Chat.afterDOMLoaded = script

export default (() => Chat) satisfies QuartzComponentConstructor
