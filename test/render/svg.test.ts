import { describe, expect, it } from "vitest";
import { structuralView } from "../support/views.ts";
import { layoutView, PALETTES, renderSvg, type RenderSource } from "../../src/render/index.ts";
import { deploymentViewWorkspace, landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";

/** The landscape fixture plus an External System, so every part of the key is drawn. */
const workspace: Files = {
  ...landscapeWorkspace,
  "payments/psp.yaml": `systems:
  psp:
    name: Card network
    external: true
`,
  "payments/model.yaml": landscapeWorkspace["payments/model.yaml"]!.replace("        name: Payments API\n", "        name: Payments API\n        technology: Go\n        relationships:\n          - to: psp\n            description: Clears card payments\n"),
};

const source: RenderSource = { workspace: "acme-architecture", commit: "0123456789abcdef0123456789abcdef01234567", date: "2026-11-22T10:30:00+01:00" };

async function render(files: Files, viewId: string) {
  const { bundle } = await loadWorkspace(files);
  const view = structuralView(bundle, viewId)!;
  return renderSvg({ bundle, view, layout: await layoutView(view), source });
}

/** The text a reader sees, one string per `<text>` element, entities decoded. */
const texts = (svg: string) =>
  [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
  );

describe("renderSvg", () => {
  it.each([
    ["c1", "c1.svg"],
    ["c2/shop:checkout", "c2-checkout.svg"],
    ["c3/shop:cart", "c3-cart.svg"],
  ])("draws %s exactly as its golden file", async (viewId, golden) => {
    const svg = await render(workspace, viewId);

    await expect(svg).toMatchFileSnapshot(`golden/${golden}`);
    expect(await render(workspace, viewId)).toBe(svg);
  });

  it("titles the picture and gives its source: Workspace, short commit and date", async () => {
    const svg = await render(workspace, "c2/shop:checkout");

    expect(texts(svg).slice(0, 2)).toEqual(["Checkout (C2)", "acme-architecture · 0123456 · 2026-11-22"]);
  });

  it("labels each node with its name, its kind and technology, and its Owner's Team code", async () => {
    const svg = await render(workspace, "c2/shop:checkout");

    const seen = texts(svg);
    expect(seen).toContain("Fraud check");
    expect(seen).toContain("PAY");
    expect(seen).toContain("Cart DB");
    expect(seen).toContain("Datastore");
  });

  it("has a key for the Team stripe and code, External and broker", async () => {
    const svg = await render(workspace, "c1");

    expect(texts(svg)).toEqual(expect.arrayContaining(["Team (stripe and code)", "External", "Broker"]));
  });

  it("uses the viewer's light tokens by default and its Night shift tokens with the dark theme", async () => {
    const { bundle } = await loadWorkspace(workspace);
    const view = structuralView(bundle, "c2/shop:checkout")!;
    const layout = await layoutView(view);
    const light = renderSvg({ bundle, view, layout, source });
    const dark = renderSvg({ bundle, view, layout, source, theme: "dark" });

    expect(renderSvg({ bundle, view, layout, source, theme: "light" })).toBe(light);
    expect(light).toContain(`<rect width="${/width="(\d+)"/.exec(light)![1]}" height="${/height="(\d+)"/.exec(light)![1]}" fill="${PALETTES.light.ground}"/>`);
    expect(dark).toContain(`fill="${PALETTES.dark.ground}"/>`);
    expect(dark).toContain(`fill="${PALETTES.dark.ink}">Checkout (C2)</text>`);
    expect(dark).not.toContain(PALETTES.light.ink);
  });

  it("replaces the source line with a label", async () => {
    const { bundle } = await loadWorkspace(workspace);
    const view = structuralView(bundle, "c1")!;
    const svg = renderSvg({ bundle, view, layout: await layoutView(view), source, label: "Big Bank · v1.2.0" });

    expect(texts(svg).slice(0, 2)).toEqual(["C1 Landscape", "Big Bank · v1.2.0"]);
  });

  it("cuts a name too long for its box, ending it with an ellipsis", async () => {
    const long = "An extraordinarily long service name that cannot possibly fit";
    const svg = await render({ ...workspace, "shop/web.yaml": workspace["shop/web.yaml"]!.replace("name: Web", `name: ${long}`) }, "c1");

    const label = texts(svg).find((t) => t.startsWith("An ex"))!;
    expect(label.endsWith("…")).toBe(true);
    expect(label.length).toBeLessThan(long.length);
  });

  it("escapes names, so any text is safe in the SVG", async () => {
    const svg = await render({ ...workspace, "shop/web.yaml": workspace["shop/web.yaml"]!.replace("name: Web", 'name: "<Web & co>"') }, "c1");

    expect(texts(svg)).toContain("<Web & co>");
    expect(svg).not.toContain("<Web &");
  });

  it("embeds Overpass Regular and Bold, so it draws the same without the font installed", async () => {
    const svg = await render(workspace, "c1");

    for (const weight of [400, 700]) expect(svg).toMatch(new RegExp(`@font-face\\{font-family:"Overpass";font-weight:${weight};src:url\\(data:font/ttf;base64,[A-Za-z0-9+/=]+\\)`));
    expect(svg).toContain(`font-family="Overpass, sans-serif"`);
  });
});

describe("renderSvg with a Lens", () => {
  /** The render workspace plus a Saved View with an upstream impact Lens on Cart. */
  const lensed: Files = {
    ...workspace,
    "shop/views.yaml": `views:
  structural:
    cart-impact:
      title: Who needs the cart
      level: c2
      include:
        - { element: cart, upstream: all, downstream: 1 }
      lens: { impact: cart, direction: upstream }
`,
  };

  it("draws a Saved View with its Lens exactly as its golden file", async () => {
    const svg = await render(lensed, "shop:cart-impact");

    await expect(svg).toMatchFileSnapshot("golden/saved-lens.svg");
    expect(await render(lensed, "shop:cart-impact")).toBe(svg);
  });

  it("badges each hit node with its distance and names the Lens in the key", async () => {
    const svg = await render(lensed, "shop:cart-impact");

    expect(texts(svg)).toEqual(expect.arrayContaining(["ORIGIN", "UPSTREAM 1", "UPSTREAM 2", "Origin", "Upstream", "Lens: Impact of Cart, upstream"]));
  });

  it("steps back what the Lens misses in solid faint colours, never fading it, and lights what it hits", async () => {
    const svg = await render(lensed, "shop:cart-impact");
    const { line, ground, faint, up, upbg } = PALETTES.light;

    expect(svg).not.toMatch(/opacity/);
    // Cart DB and Payments API are not upstream of Cart, nor are the edges to them.
    expect(svg.match(new RegExp(`fill="${ground}"/><path [^>]*stroke="${line}"`, "g"))?.length).toBe(2);
    expect(texts(svg.split("<g>").filter((g) => g.includes(`fill="${faint}">`)).join(""))).toEqual(expect.arrayContaining(["Cart DB", "Payments API"]));
    expect(svg.match(/marker-end="url\(#arrow-faint\)"/g)?.length).toBe(2);
    expect(svg).toMatch(/marker-end="url\(#arrow-lit\)"/);
    expect(svg).toContain(`fill="${upbg}"/><path `);
    expect(svg).toContain(`stroke="${up}"`);
  });

  it("draws a View without a Lens unchanged", async () => {
    const svg = await render(workspace, "c1");

    expect(svg).not.toContain("arrow-lit");
    expect(texts(svg).some((t) => t.startsWith("Lens:"))).toBe(false);
  });
});

describe("a Deployment View", () => {
  async function renderDeployment() {
    const { bundle } = await loadWorkspace(deploymentViewWorkspace);
    const view = structuralView(bundle, "deployment/prod")!;
    return renderSvg({ bundle, view, layout: await layoutView(view, { direction: view.direction }), source });
  }

  it("draws exactly as its golden file", async () => {
    await expect(await renderDeployment()).toMatchFileSnapshot("golden/deployment-prod.svg");
  });

  it("fills each Target with the Target Depth ground of its nesting level, capped at the last step", async () => {
    const files: Files = {
      ...deploymentViewWorkspace,
      "platform/targets.yaml": deploymentViewWorkspace["platform/targets.yaml"]!.replace(
        "    kind: datacentre\n",
        "    kind: dc\n    targets:\n      d2:\n        name: Depth two\n        kind: room\n        targets:\n          d3:\n            name: Depth three\n            kind: rack\n            targets:\n              d4:\n                name: Depth four\n                kind: host\n                targets:\n                  d5:\n                    name: Depth five\n                    kind: vm\n",
      ),
      "shop/model.yaml": deploymentViewWorkspace["shop/model.yaml"]!.replace("target: platform:dc }", "target: platform:d5 }"),
    };
    const { bundle } = await loadWorkspace(files);
    const view = structuralView(bundle, "deployment/prod")!;
    const svg = renderSvg({ bundle, view, layout: await layoutView(view, { direction: view.direction }), source });
    /** The fill of the frame drawn in the same group as the header that starts with `name · `. */
    const fillOf = (name: string) => /^<rect [^>]*fill="(#[0-9a-f]+)"/.exec(svg.split("<g>").find((g) => g.includes(`>${name} · `))!)![1];
    const { "target-1": one, "target-2": two, "target-3": three } = PALETTES.light;

    expect(new Set([one, two, three]).size).toBe(3);
    expect(["Data centre", "Depth two", "Depth three", "Depth four", "Depth five"].map(fillOf)).toEqual([one, two, three, three, three]);
  });

  it("labels Targets with their kind, System boxes as Systems and Deployments as Deployments", async () => {
    const t = texts(await renderDeployment());

    expect(t[0]).toBe("Production (Deployment)");
    expect(t).toEqual(expect.arrayContaining(["AWS eu-west-1 · region", "EKS eu · cluster", "shop namespace · namespace", "Checkout · System", "Web", "Deployment · Next.js", "Stripe", "External Service"]));
  });
});

describe("a scaled Deployment", () => {
  /** The Deployment View fixture with Web fixed at 3 and Cart autoscaling 2–10 in the shop namespace. */
  const scaled: Files = {
    ...deploymentViewWorkspace,
    "shop/model.yaml": deploymentViewWorkspace["shop/model.yaml"]!
      .replace("target: platform:ns-shop, url: https://shop.example.com }", "target: platform:ns-shop, url: https://shop.example.com, instances: 3 }")
      .replace("{ service: cart, environment: prod, target: platform:ns-shop }", "{ service: cart, environment: prod, target: platform:ns-shop, instances: { min: 2, max: 10 } }"),
  };

  async function renderView(files: Files) {
    const { bundle, issues } = await loadWorkspace(files);
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
    const view = structuralView(bundle, "deployment/prod")!;
    return renderSvg({ bundle, view, layout: await layoutView(view, { direction: view.direction }), source });
  }

  it("draws exactly as its golden file", async () => {
    await expect(await renderView(scaled)).toMatchFileSnapshot("golden/deployment-scaled.svg");
  });

  it("draws a count chip, `×3` fixed and `2–10` autoscale, two copies behind each scaled box, and a Key row", async () => {
    const svg = await renderView(scaled);
    const t = texts(svg);

    expect(t.filter((s) => s === "×3" || s === "2–10").sort()).toEqual(["2–10", "×3"]);
    expect(t).toContain("Stacked: scaled (×3 fixed, 2–10 autoscale)");
    expect(svg.split("<g>").filter((g) => /<rect [^>]*width="\d+(\.\d+)?" height="68"/.test(g))).toHaveLength(2);
  });

  it("leaves the chip and the Key row out of a View with no scaled Deployment", async () => {
    const t = texts(await renderView(deploymentViewWorkspace));

    expect(t.some((s) => s.startsWith("Stacked"))).toBe(false);
    expect(t.some((s) => s.startsWith("×"))).toBe(false);
  });
});
