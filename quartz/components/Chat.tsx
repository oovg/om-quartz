import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import style from "./styles/chat.scss"

// @ts-ignore
import script from "./scripts/chat.inline"

const Chat: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
  const apiBaseUrl = cfg?.chatApiBaseUrl ?? ""
  return (
    <div id="om-chat-root" class="om-chat-wrapper" data-api-base-url={apiBaseUrl || undefined}>
      {/* Modal is mounted here by chat.inline.ts after DOM load */}
    </div>
  )
}

Chat.css = style
Chat.afterDOMLoaded = script

export default (() => Chat) satisfies QuartzComponentConstructor
