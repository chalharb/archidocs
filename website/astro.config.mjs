// @ts-check
import process from "node:process";
import { URL } from "node:url";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmActions from "starlight-llm-actions";
import starlightLlmsTxt from "starlight-llms-txt";
import { PAGEFIND_RANKING } from "./src/lib/search.ts";
import { shareHead } from "./src/lib/share.ts";
import commandLines from "./src/plugins/command-lines.ts";
import identifierHeadings from "./src/plugins/identifier-headings.ts";
import samples from "./src/plugins/samples.ts";

/**
 * A sidebar group listing a folder's pages.
 * @param {string} label
 * @param {string} directory
 * @param {{ collapsed?: boolean }} [extra]
 */
const group = (label, directory, extra = {}) => ({ label, items: [{ autogenerate: { directory } }], ...extra });

const site = "https://archidocs.dev";

export default defineConfig({
  site,
  // Renamed pages keep their old URL. A static build writes each as a page that forwards to the new one.
  redirects: {
    "/docs/guides/model/dynamic-views": "/docs/guides/model/write-a-dynamic-view/",
    "/docs/concepts/viewer": "/docs/guides/viewer/",
  },
  // The fixture tests (test/fixtures.test.ts) build a copy of src/ with a broken page added, into a temp folder.
  srcDir: process.env.ARCHIDOCS_DOCS_SRC_DIR ?? "./src",
  outDir: process.env.ARCHIDOCS_DOCS_OUT_DIR ?? "./dist",
  ...(process.env.ARCHIDOCS_DOCS_CACHE_DIR ? { cacheDir: process.env.ARCHIDOCS_DOCS_CACHE_DIR } : {}),
  integrations: [
    starlight({
      title: "Archidocs",
      description: "Git-native architecture as code: one Model in YAML, a diagram viewer for people and MCP tools for agents.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/chalharb/archidocs" }],
      editLink: { baseUrl: "https://github.com/chalharb/archidocs/edit/beta/website/" },
      // The mark from assets/brand/: the dark tile on the light theme, the light tile on the dark one.
      logo: { light: "../assets/brand/archidocs-mark-dark.svg", dark: "../assets/brand/archidocs-mark-light.svg" },
      // /favicon.svg is the viewer's own favicon (src/pages/favicon.svg.ts).
      favicon: "/favicon.svg",
      // The social card and app icon for link previews (src/lib/share.ts).
      head: shareHead(new URL(site)).map(({ tag, attrs }) => ({ tag, attrs: { ...attrs } })),
      customCss: ["./src/styles/brand.css", "./src/styles/diagram.css"],
      pagefind: { ranking: PAGEFIND_RANKING },
      // The date of each hand-written page's last commit, so the workflows that deploy the site check out
      // the full git history (`fetch-depth: 0`). A generated page has no file, so it shows no date.
      lastUpdated: true,
      // Starlight's page footer, with the release the site documents added, and its site title,
      // with a beta badge on the staging build of the beta branch.
      components: { Footer: "./src/components/Footer.astro", SiteTitle: "./src/components/SiteTitle.astro" },
      // Each group opens with its index page: `index.mdx` in the group's folder, with `sidebar.order: 0`.
      // Guides and Reference are made of sub-groups, so their index pages are named here.
      sidebar: [
        group("Start here", "docs/start"),
        group("Concepts", "docs/concepts"),
        {
          label: "Guides",
          items: ["docs/guides", group("Use the viewer", "docs/guides/viewer"), group("Model", "docs/guides/model"), group("Publish", "docs/guides/publish"), group("Agents", "docs/guides/agents"), group("Review and share", "docs/guides/review")],
        },
        {
          label: "Reference",
          items: [
            "docs/reference",
            group("CLI", "docs/reference/cli", { collapsed: true }),
            group("Model YAML", "docs/reference/model", { collapsed: true }),
            group("MCP tools", "docs/reference/mcp"),
            group("CI", "docs/reference/ci"),
            group("Check rules", "docs/reference/rules", { collapsed: true }),
            "docs/reference/viewer-urls",
            group("Authoring guide for agents", "docs/reference/agent-guide", { collapsed: true }),
            "docs/reference/glossary",
            "docs/reference/changelog",
          ],
        },
        group("Examples", "docs/examples"),
        // Last in the sidebar. Its pages are ordered by `sidebar.order`, and its index lists them, so a new Help page needs no entry here.
        group("Help", "docs/help"),
      ],
      plugins: [
        samples(),
        commandLines(),
        identifierHeadings(),
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: "Archidocs",
          details: [
            "If you can run Archidocs, prefer its own guide: `archidocs guide` (or the MCP `get_authoring_guide` tool) serves the authoring guide that matches the installed version. This site documents the latest release only.",
            "Every page is also available as Markdown at its URL with `.md` appended, such as https://archidocs.dev/docs/reference/cli/check.md.",
          ].join("\n\n"),
          // One set per part of the docs, so llms.txt indexes them all. A group's index page has its folder's
          // own id (`docs/start`), which `docs/start/**` doesn't match, so it is named beside the folder.
          customSets: [
            { label: "Start here", paths: ["docs", "docs/start", "docs/start/**"], description: "what Archidocs is, a quick start and a tutorial" },
            { label: "Concepts", paths: ["docs/concepts", "docs/concepts/**"], description: "the Model and how its parts fit together" },
            { label: "Guides", paths: ["docs/guides", "docs/guides/**"], description: "how to model, publish, connect agents and review changes" },
            { label: "CLI reference", paths: ["docs/reference/cli/**", "docs/reference/cli"], description: "every archidocs command and flag" },
            { label: "Model YAML reference", paths: ["docs/reference/model/**"], description: "every field of every Workspace and Project file" },
            { label: "MCP tools", paths: ["docs/reference/mcp/**"], description: "every MCP tool with its input and output" },
            { label: "Check rules", paths: ["docs/reference/rules/**", "docs/reference/rules"], description: "every check rule with a failing example and the fix" },
            { label: "Authoring guide for agents", paths: ["docs/reference/agent-guide/**", "docs/reference/agent-guide"], description: "the skill and task topics agents follow to edit the Model" },
            { label: "Examples", paths: ["docs/examples", "docs/examples/**"], description: "the Big Bank and Kitchen sink example Workspaces" },
            { label: "Help", paths: ["docs/help", "docs/help/**"], description: "troubleshooting and answers to common questions" },
          ],
          // llms-small.txt leaves out the Examples and the Changelog.
          exclude: ["docs/examples", "docs/examples/**", "docs/reference/changelog"],
        }),
        // The .md copies: sample fences filled in, Diagrams as images, cards and page lists as lists (src/render-markdown.ts).
        starlightLlmActions({ renderMarkdown: { module: "./src/render-markdown.ts" } }),
      ],
    }),
  ],
});
