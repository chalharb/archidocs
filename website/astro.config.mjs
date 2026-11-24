// @ts-check
import process from "node:process";
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmActions from "starlight-llm-actions";
import starlightLlmsTxt from "starlight-llms-txt";
import { PAGEFIND_RANKING } from "./src/lib/search.ts";
import commandLines from "./src/plugins/command-lines.ts";
import identifierHeadings from "./src/plugins/identifier-headings.ts";

/**
 * A sidebar group listing a folder's pages.
 * @param {string} label
 * @param {string} directory
 * @param {{ collapsed?: boolean }} [extra]
 */
const group = (label, directory, extra = {}) => ({ label, items: [{ autogenerate: { directory } }], ...extra });

export default defineConfig({
  site: "https://archidocs.dev",
  // The fixture tests (test/fixtures.test.ts) build a copy of src/ with a broken page added, into a temp folder.
  srcDir: process.env.ARCHIDOCS_DOCS_SRC_DIR ?? "./src",
  outDir: process.env.ARCHIDOCS_DOCS_OUT_DIR ?? "./dist",
  ...(process.env.ARCHIDOCS_DOCS_CACHE_DIR ? { cacheDir: process.env.ARCHIDOCS_DOCS_CACHE_DIR } : {}),
  integrations: [
    starlight({
      title: "Archidocs",
      description: "Git-native architecture as code: one Model in YAML, a diagram viewer for people and MCP tools for agents.",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/chalharb/archidocs" }],
      editLink: { baseUrl: "https://github.com/chalharb/archidocs/edit/main/website/" },
      customCss: ["./src/styles/diagram.css"],
      pagefind: { ranking: PAGEFIND_RANKING },
      sidebar: [
        group("Start here", "docs/start"),
        group("Concepts", "docs/concepts"),
        {
          label: "Guides",
          items: [group("Model", "docs/guides/model"), group("Publish", "docs/guides/publish"), group("Agents", "docs/guides/agents"), group("Review", "docs/guides/review")],
        },
        {
          label: "Reference",
          items: [
            group("CLI", "docs/reference/cli", { collapsed: true }),
            group("Model YAML", "docs/reference/model", { collapsed: true }),
            group("MCP tools", "docs/reference/mcp"),
            group("CI", "docs/reference/ci"),
            group("Check rules", "docs/reference/rules", { collapsed: true }),
            group("Authoring guide for agents", "docs/reference/agent-guide", { collapsed: true }),
            "docs/reference/glossary",
            "docs/reference/changelog",
          ],
        },
        group("Examples", "docs/examples"),
      ],
      plugins: [
        commandLines(),
        identifierHeadings(),
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: "Archidocs",
          details: [
            "If you can run Archidocs, prefer its own guide: `archidocs guide` (or the MCP `get_authoring_guide` tool) serves the authoring guide that matches the installed version. This site documents the latest release only.",
            "Every page is also available as Markdown at its URL with `.md` appended, such as https://archidocs.dev/docs/reference/cli/check.md.",
          ].join("\n\n"),
          // One set per part of the docs, so llms.txt indexes them all.
          customSets: [
            { label: "Start here", paths: ["docs", "docs/start/**"], description: "what Archidocs is, a quick start and a tutorial" },
            { label: "Concepts", paths: ["docs/concepts/**"], description: "the Model and how its parts fit together" },
            { label: "Guides", paths: ["docs/guides/**"], description: "how to model, publish, connect agents and review changes" },
            { label: "CLI reference", paths: ["docs/reference/cli/**", "docs/reference/cli"], description: "every archidocs command and flag" },
            { label: "Model YAML reference", paths: ["docs/reference/model/**"], description: "every field of every Workspace and Project file" },
            { label: "MCP tools", paths: ["docs/reference/mcp/**"], description: "every MCP tool with its input and output" },
            { label: "Check rules", paths: ["docs/reference/rules/**", "docs/reference/rules"], description: "every check rule with a failing example and the fix" },
            { label: "Authoring guide for agents", paths: ["docs/reference/agent-guide/**", "docs/reference/agent-guide"], description: "the skill and task topics agents follow to edit the Model" },
          ],
          // llms-small.txt leaves out the Examples and the Changelog.
          exclude: ["docs/examples/**", "docs/reference/changelog"],
        }),
        starlightLlmActions(),
      ],
    }),
  ],
});
