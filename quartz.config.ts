import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 * Open Machine — Interactive Mind
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "The Open Machine",
    pageTitleSuffix: " | Interactive Mind",
    enableSPA: false,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "mind.theopenmachine.net",
    ignorePatterns: [
      ".obsidian"
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "local",
      cdnCaching: true,
      typography: {
        header: "polymath-display",
        body: "adobe-caslon-pro",
        code: "SFMono-Regular",
      },
      colors: {
        lightMode: {
          light: "#ffffff",
          lightgray: "#e0e0e0",
          gray: "#999999",
          darkgray: "#333333",
          dark: "#111111",
          secondary: "#555555",
          tertiary: "#777777",
          highlight: "rgba(0, 0, 0, 0.04)",
          textHighlight: "rgba(0, 0, 0, 0.08)",
        },
        darkMode: {
          light: "#0a0a0a",
          lightgray: "#1a1a1a",
          gray: "#555555",
          darkgray: "#d0d0d0",
          dark: "#f0f0f0",
          secondary: "#b0b0b0",
          tertiary: "#cccccc",
          highlight: "rgba(255, 255, 255, 0.05)",
          textHighlight: "rgba(255, 255, 255, 0.08)",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
    ],
  },
}

export default config