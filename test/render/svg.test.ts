import { describe, expect, it } from "vitest";
import { resolveView } from "../../src/core/index.ts";
import { layoutView, renderSvg, type RenderSource } from "../../src/render/index.ts";
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
  const view = resolveView(bundle, viewId)!;
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

  it("has a key for sync and async lines, the Team stripe and code, and External", async () => {
    const svg = await render(workspace, "c1");

    expect(texts(svg)).toEqual(expect.arrayContaining(["Sync", "Async", "Team (stripe and code)", "External"]));
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

  it("embeds its one font, so it draws the same without the font installed", async () => {
    const svg = await render(workspace, "c1");

    expect(svg).toMatch(/@font-face\{font-family:"Inter";src:url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/);
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

    expect(texts(svg)).toEqual(expect.arrayContaining(["0", "1", "2", "Lens: impact of shop:cart, upstream"]));
  });

  it("dims what the Lens misses and highlights what it hits", async () => {
    const svg = await render(lensed, "shop:cart-impact");

    // Cart DB and Payments API are not upstream of Cart, nor are the edges to them.
    expect(svg.match(/<g opacity="0.35"><g>/g)?.length).toBe(2);
    expect(svg.match(/<g opacity="0.35"><path/g)?.length).toBe(2);
    expect(svg).toMatch(/marker-end="url\(#arrow-lit\)"/);
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
    const view = resolveView(bundle, "deployment/prod")!;
    return renderSvg({ bundle, view, layout: await layoutView(view, { direction: view.direction }), source });
  }

  it("draws exactly as its golden file", async () => {
    await expect(await renderDeployment()).toMatchFileSnapshot("golden/deployment-prod.svg");
  });

  it("labels Targets with their kind, System boxes as Systems and Deployments as Deployments", async () => {
    const t = texts(await renderDeployment());

    expect(t[0]).toBe("Production (Deployment)");
    expect(t).toEqual(expect.arrayContaining(["AWS eu-west-1 · region", "EKS eu · cluster", "shop namespace · namespace", "Checkout · System", "Web", "Deployment · Next.js", "Stripe", "External Service"]));
  });
});
