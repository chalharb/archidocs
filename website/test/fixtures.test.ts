import { describe, expect, it } from "vitest";
import { buildSite } from "./support.ts";

const page = (title: string, body: string) => `---\ntitle: ${title}\n---\n\n${body}\n`;

describe("the build fails on a page that is wrong", () => {
  it("fails on a broken internal link", async () => {
    const result = await buildSite({ pages: { "fixture/broken-link.mdx": page("Broken link", "See [the rule](/docs/reference/rules/no-such-rule/).") } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain("Links validation failed");
    expect(result.output).toContain("/docs/reference/rules/no-such-rule/");
  });

  it("fails on a link to a heading that doesn't exist", async () => {
    const result = await buildSite({ pages: { "fixture/broken-anchor.mdx": page("Broken anchor", "See [the flag](/docs/reference/cli/export/#--no-such-flag).") } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain("#--no-such-flag");
  });

  it("fails on an unknown flag in an archidocs line", async () => {
    const result = await buildSite({ pages: { "fixture/unknown-flag.mdx": page("Unknown flag", "```bash\nnpx archidocs export --all-saved --out views --themes dark\n```") } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain("Unknown archidocs command line");
    expect(result.output).toContain("--themes");
  });

  it("fails on an unknown command in inline code", async () => {
    const result = await buildSite({ pages: { "fixture/unknown-command.mdx": page("Unknown command", "Run `archidocs publish` to ship it.") } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain('Unknown command "publish"');
  });
});

describe("the build fails on a sample fence that is wrong", () => {
  it("fails on a sample fence with YAML typed into it", async () => {
    const result = await buildSite({ pages: { "fixture/typed-sample.mdx": page("Typed sample", '```yaml file="examples/kitchen-sink/archidocs/sink/project.yaml"\nid: typed\n```') } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain("must be empty");
  });

  it("fails on a sample region the file doesn't have", async () => {
    const result = await buildSite({ pages: { "fixture/missing-region.mdx": page("Missing region", '```yaml file="examples/kitchen-sink/archidocs/sink/model.yaml" region="no-such-region"\n```') } });
    expect(result.ok, result.output).toBe(false);
    expect(result.output).toContain("has no #region no-such-region");
  });
});
