import { describe, expect, it } from "vitest";
import { captureLanding, countWord, landingDiagram } from "../src/lib/landing.ts";

describe("the landing page's capture", () => {
  it("takes get_impact's real result and the Saved View that agrees with it", async () => {
    const landing = await captureLanding();
    expect(landing.call).toEqual({ name: "get_impact", arguments: { id: "core:mainframe", direction: "upstream" } });
    expect(landing.impact.upstream.total).toBe(landing.impact.upstream.rings.reduce((n, r) => n + r.elements.length, 0));
    expect(landing.view.hits).toBe(landing.impact.upstream.total);
    expect(landing.view.crumbs).toEqual(["Saved", "Digital Banking", "What a mainframe outage takes down"]);
    expect(landing.view.lens).toBe("Impact of Mainframe, upstream");
    expect(landing.tools.map((t) => t.name)).toContain("get_impact");
  });

  it("shows the YAML line that declares a directly affected Service's Relationship, under its keys", async () => {
    const { yaml } = await captureLanding();
    expect(yaml.file).toBe("core/model.yaml");
    const marked = yaml.lines.filter((l) => l.mark);
    expect(marked).toHaveLength(1);
    expect(marked[0]!.text.trim()).toBe("- to: mainframe");
    expect(yaml.lines[0]!.text).toBe("systems:");
    expect(yaml.lines.map((l) => l.n)).toEqual([...yaml.lines.map((l) => l.n)].sort((a, b) => a - b));
  });

  it("crops the exported map to its nodes, without the export's title and legend", async () => {
    const map = await landingDiagram();
    const [, , width, height] = /viewBox="([\d.-]+) ([\d.-]+) ([\d.]+) ([\d.]+)"/.exec(map.svg)!.slice(1).map(Number);
    expect([width, height]).toEqual([map.width, map.height]);
    expect(map.svg).not.toContain("What a mainframe outage takes down</text>");
    expect(map.svg).toContain(">Mainframe</text>");
    expect(map.svg).toContain(">ORIGIN</text>");
    expect(map.ringX).toBeGreaterThan(0);
    expect(map.ringX).toBeLessThan(map.width);
  });

  it("words small counts", () => {
    expect(countWord(10)).toBe("ten");
    expect(countWord(13)).toBe("13");
  });
});
