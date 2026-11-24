/**
 * The CLI reference, from the structured command definitions in
 * `src/cli/commands.ts` that also drive the CLI's usage text: an index and a
 * page per command, each flag a heading of its own so search finds it.
 */
import { commandList, usageText, type CommandDefinition, type FlagDefinition } from "../../../src/cli/commands.ts";
import { blocks, fence, table, text, type GeneratedPage } from "./page.ts";

const BASE = "docs/reference/cli";
const SOURCE = "src/cli/commands.ts";

export const commandSlug = (name: string): string => name.replace(/ /g, "-");
export const commandPath = (name: string): string => `/${BASE}/${commandSlug(name)}/`;

export function cliPages(commands: readonly CommandDefinition[] = commandList): GeneratedPage[] {
  return [
    {
      id: BASE,
      title: "CLI",
      label: "Overview",
      order: 0,
      description: "Every `archidocs` command and its flags.",
      source: SOURCE,
      body: blocks(
        "A usage error prints this summary. Each command's page describes its arguments and flags.",
        fence("text", usageText()),
        table(
          ["Command", "What it does"],
          commands.map((c) => [`[\`archidocs ${c.name}\`](${commandPath(c.name)})`, text(c.description)]),
        ),
      ),
    },
    ...commands.map((c, i) => commandPage(c, i + 1)),
  ];
}

function commandPage(command: CommandDefinition, order: number): GeneratedPage {
  const flags = Object.entries(command.flags);
  return {
    id: `${BASE}/${commandSlug(command.name)}`,
    title: `archidocs ${command.name}`,
    label: command.name,
    order,
    description: command.description,
    source: SOURCE,
    body: blocks(
      text(command.description),
      "## Usage",
      fence("text", command.synopsis.map((s) => `archidocs ${s}`).join("\n")),
      command.arguments.length > 0 && "## Arguments",
      command.arguments.length > 0 && table(["Argument", "Meaning"], command.arguments.map((a) => [`\`${a.name}\``, text(a.description)])),
      "## Flags",
      flags.length === 0 && "This command takes no flags.",
      ...flags.map(([name, flag]) => flagSection(name, flag)),
    ),
  };
}

function flagSection(name: string, flag: FlagDefinition): string {
  const facts = [
    flag.type === "boolean" ? `\`--${name}\`` : `\`--${name} ${flag.value ?? "<value>"}\``,
    flag.defaultText !== undefined ? `Default: ${text(flag.defaultText)}.` : flag.default !== undefined && flag.default !== false ? `Default: \`${String(flag.default)}\`.` : flag.type === "boolean" ? "Off by default." : undefined,
  ].filter((f) => f !== undefined);
  return blocks(`### \`--${name}\``, facts.join(" · "), text(flag.description));
}
