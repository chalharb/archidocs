import { describe, expect, it } from "vitest";
import { commandList, commands, EXIT, parseCommandLine, usageText, type CommandDefinition } from "../../src/cli/commands.ts";
import { DEFAULT_DEV_PORT } from "../../src/cli/dev.ts";
import { DEFAULT_KEEP } from "../../src/history/index.ts";
import { DEFAULT_PORT } from "../../src/mcp/index.ts";

/**
 * One concrete command line for a synopsis: optional groups are taken, the
 * first of each `a|b` choice is used, and a `<placeholder>` becomes a value.
 */
function synopsisArgv(synopsis: string): string[] {
  return synopsis
    .replace(/[[\]]/g, " ")
    .split(/\s+/)
    .filter((t) => t !== "" && t !== "|")
    .map((t) => (t.startsWith("<") ? "value" : t.split("|")[0]!));
}

/** An example's words as a shell splits them: spaces separate, and double quotes hold a word together. */
const exampleArgv = (line: string): string[] => (line.match(/"[^"]*"|\S+/g) ?? []).map((word) => word.replace(/^"(.*)"$/, "$1"));

describe("CLI command definitions", () => {
  it("print the usage text", () => {
    expect(usageText()).toMatchInlineSnapshot(`
      "Usage:
        archidocs version [--format text|json]
        archidocs init [--skill [--workspace <dir>]]
        archidocs guide [topic] [--skill <id>]
        archidocs check [--format text|json|github] [--strict]
        archidocs gaps [--project <id>] [--owner <team>] [--json]
        archidocs build [--out <dir>] [--bundle-only] [--keep <n|all>]
        archidocs build --preview [--base <branch>] [--out <dir>]
        archidocs dev [--workspace <dir>] [--port <n>] [--host <host>]
        archidocs export <view-id> [--format svg|png] [--out <file>] [--direction TB|BT|LR|RL] [--theme light|dark] [--label <text>]
        archidocs export --all-saved --out <dir> [--format svg|png] [--direction TB|BT|LR|RL] [--theme light|dark] [--label <text>]
        archidocs diff <from> [<to>] [--format text|json|markdown]
        archidocs history build [--since <ref|date|time>]
        archidocs mcp [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>] [--check]
        archidocs mcp --http [--host <loopback>] [--port <n>] [--allow-writes] [--workspace <dir> | --bundle <url|path>] [--viewer-url <url>]
      "
    `);
  });

  it("describe every command, argument and flag", () => {
    for (const command of commandList) {
      expect(command.description.trim(), command.name).not.toBe("");
      expect(command.synopsis.length, command.name).toBeGreaterThan(0);
      for (const arg of command.arguments) expect(arg.description.trim(), `${command.name} ${arg.name}`).not.toBe("");
      for (const [name, flag] of Object.entries(command.flags)) {
        expect(flag.description.trim(), `${command.name} --${name}`).not.toBe("");
        // A string flag shows what it takes; a boolean takes nothing.
        expect(flag.value !== undefined, `${command.name} --${name}`).toBe(flag.type === "string");
      }
    }
  });

  it("name every flag in a synopsis, and only defined flags", () => {
    for (const command of commandList) {
      const used = new Set(command.synopsis.flatMap((s) => [...s.matchAll(/--([a-z-]+)/g)].map((m) => m[1])));
      expect([...used].sort(), command.name).toEqual(Object.keys(command.flags).sort());
    }
  });

  it("give every command an example, each a line the CLI accepts with a line on what it does", () => {
    for (const command of commandList) {
      expect(command.examples, `${command.name} has no example`).not.toHaveLength(0);
      for (const example of command.examples) {
        const [program, ...argv] = exampleArgv(example.command);
        expect(program, example.command).toBe("archidocs");
        expect(parseCommandLine(argv), example.command).toEqual({ ok: true, command: command.name });
        expect(example.description.trim(), example.command).not.toBe("");
      }
      expect(new Set(command.examples.map((e) => e.command)).size, `${command.name} repeats an example`).toBe(command.examples.length);
    }
  });

  it("refuse, in the type, a command with no example or no exit code", () => {
    // @ts-expect-error A command needs at least one example.
    const noExample: CommandDefinition = { ...commands.check, examples: [] };
    // @ts-expect-error A command needs at least one exit code.
    const noExitCode: CommandDefinition = { ...commands.check, exitCodes: [] };
    expect([noExample.examples, noExitCode.exitCodes]).toEqual([[], []]);
  });

  it("list each command's exit codes once, lowest first, each with what it means", () => {
    for (const command of commandList) {
      const codes = command.exitCodes.map((e) => e.code);
      expect(codes, command.name).toEqual([...new Set(codes)].sort((a, b) => a - b));
      // Any command can be given a flag it doesn't take.
      expect(codes, command.name).toContain(EXIT.couldNotRun);
      for (const { code, meaning } of command.exitCodes) expect(meaning.trim(), `${command.name} exit ${code}`).not.toBe("");
    }
  });

  it("document the defaults the commands work out themselves", () => {
    expect(commands.dev.flags.port.default).toBe(String(DEFAULT_DEV_PORT));
    expect(commands.mcp.flags.port.defaultText).toBe(String(DEFAULT_PORT));
    expect(commands.build.flags.keep.defaultText).toBe(String(DEFAULT_KEEP));
  });
});

describe("parseCommandLine", () => {
  it.each(commandList.flatMap((c) => c.synopsis))("accepts archidocs %s", (synopsis) => {
    const argv = synopsisArgv(synopsis);
    expect(parseCommandLine(argv)).toMatchObject({ ok: true, command: commandList.find((c) => synopsis.startsWith(`${c.name} `) || synopsis === c.name)?.name });
  });

  it("accepts flags given as --flag=value", () => {
    expect(parseCommandLine(["export", "c1", "--format=png"])).toEqual({ ok: true, command: "export" });
  });

  it.each([
    [[], "No command given."],
    [["chek"], 'Unknown command "chek".'],
    [["history"], "Give a history command."],
    [["history", "prune"], 'Unknown history command "prune".'],
  ])("rejects the command in %j", (argv, message) => {
    expect(parseCommandLine(argv)).toEqual({ ok: false, message });
  });

  it.each([
    [["check", "--bogus"], "--bogus"],
    [["build", "--format", "json"], "--format"],
    [["history", "build", "--keep", "3"], "--keep"],
  ])("rejects the unknown flag in %j", (argv, flag) => {
    const result = parseCommandLine(argv);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain(flag);
  });

  it("rejects a missing value and a stray argument", () => {
    expect(parseCommandLine(["check", "--format"]).ok).toBe(false);
    expect(parseCommandLine(["check", "extra"]).ok).toBe(false);
  });
});
