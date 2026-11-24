/**
 * A Starlight plugin that fills sample fences from their files: a code fence
 * whose meta names `file="…"` (and optionally `region="…"`) gets that file's
 * text as its code and its Workspace path as its title. A sample fence must
 * be empty, so no Model YAML is ever typed into a page. See `lib/samples.ts`.
 */
import { fileURLToPath } from "node:url";
import type { StarlightPlugin } from "@astrojs/starlight/types";
import { readSample, sampleRef } from "../lib/samples.ts";

interface CodeNode {
  type: "code";
  value: string;
  lang?: string | null;
  meta?: string | null;
  position?: { start: { line: number } };
}

interface Context {
  setProperty(node: unknown, key: string, value: unknown): void;
}

/** The meta string left for Expressive Code: the sample attributes dropped, a title added. */
const remainingMeta = (meta: string, title: string): string => {
  const rest = meta.replace(/\b(?:file|region|fails|title)=(?:"[^"]*"|'[^']*'|\S+)/g, "").trim();
  return [`title="${title}"`, rest].filter(Boolean).join(" ");
};

/** The mdast plugin, in the shape Sätteri takes: a factory per file. */
export const samplesMdastPlugin = ({ fileURL }: { fileURL?: URL }) => ({
  name: "archidocs-samples",
  options: { position: true },
  code(node: CodeNode, ctx: Context) {
    const ref = sampleRef(node.meta);
    if (!ref) return;
    const where = `${fileURL ? fileURLToPath(fileURL) : "a generated page"}${node.position ? `:${node.position.start.line}` : ""}`;
    if (node.value.trim() !== "") throw new Error(`${where}: a sample fence (file="${ref.file}") must be empty; its code comes from the file.`);
    let sample;
    try {
      sample = readSample(ref);
    } catch (error) {
      throw new Error(`${where}: ${(error as Error).message}`, { cause: error });
    }
    ctx.setProperty(node, "value", sample.text);
    ctx.setProperty(node, "meta", remainingMeta(node.meta ?? "", sample.title));
  },
});

export default function samples(): StarlightPlugin {
  return {
    name: "archidocs-samples",
    hooks: {
      "config:setup"({ astroConfig }) {
        const processor = astroConfig.markdown.processor as { name?: string; options?: { mdastPlugins?: unknown[] } } | undefined;
        if (processor?.name !== "satteri" || !Array.isArray(processor.options?.mdastPlugins)) {
          throw new Error("The archidocs-samples plugin needs Astro's default Sätteri Markdown processor.");
        }
        // First, so the plugins after it see the sample's code.
        processor.options.mdastPlugins.unshift(samplesMdastPlugin);
      },
    },
  };
}
