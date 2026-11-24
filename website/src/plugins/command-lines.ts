/**
 * A Starlight plugin that fails the build when a page has an `archidocs …`
 * line the CLI would refuse: an unknown command or flag, or a flag missing
 * its value. It adds an mdast plugin to Astro's Markdown processor, so it
 * sees hand-written pages and generated reference pages alike. Commands are
 * parsed against `src/cli/commands.ts`, never run.
 */
import { fileURLToPath } from "node:url";
import type { StarlightPlugin } from "@astrojs/starlight/types";
import { checkCode } from "../lib/command-lines.ts";

interface CodeNode {
  type: "code" | "inlineCode";
  value: string;
  lang?: string | null;
  position?: { start: { line: number } };
}

/** The mdast plugin, in the shape Sätteri takes: a factory per file. */
export const commandLinesMdastPlugin = ({ fileURL }: { fileURL?: URL }) => {
  const where = (node: CodeNode) => `${fileURL ? fileURLToPath(fileURL) : "a generated page"}${node.position ? `:${node.position.start.line}` : ""}`;
  const check = (node: CodeNode, inline: boolean) => {
    const [problem] = checkCode(node.value, { lang: node.lang ?? null, inline });
    if (problem) throw new Error(`Unknown archidocs command line in ${where(node)}: \`${problem.line}\`: ${problem.message}`);
  };
  return {
    name: "archidocs-command-lines",
    options: { position: true },
    code: (node: CodeNode) => check(node, false),
    inlineCode: (node: CodeNode) => check(node, true),
  };
};

export default function commandLines(): StarlightPlugin {
  return {
    name: "archidocs-command-lines",
    hooks: {
      "config:setup"({ astroConfig }) {
        const processor = astroConfig.markdown.processor as { name?: string; options?: { mdastPlugins?: unknown[] } } | undefined;
        if (processor?.name !== "satteri" || !Array.isArray(processor.options?.mdastPlugins)) {
          throw new Error("The archidocs-command-lines plugin needs Astro's default Sätteri Markdown processor.");
        }
        processor.options.mdastPlugins.push(commandLinesMdastPlugin);
      },
    },
  };
}
