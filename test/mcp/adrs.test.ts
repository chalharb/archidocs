import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { connect } from "../support/mcp.ts";
import type { Files } from "../support/workspace.ts";

const adr = (frontmatter: string, title: string, body = "Some context.\n") => `---\n${frontmatter}\n---\n\n# ${title}\n\n${body}`;

/** The landscape fixture with a Saved View and a few ADRs across Projects. */
const workspace: Files = {
  ...landscapeWorkspace,
  "shop/views.yaml": "views:\n  structural:\n    front:\n      title: Front\n      level: c2\n",
  "shop/adr/0001-cart-store.md": adr("status: accepted\ndate: 2025-05-02\nelements: [checkout-ui]\ntags: [storage]", "Keep carts in Postgres"),
  "shop/adr/0002-cart-store-v2.md": adr("status: accepted\ndate: 2026-02-01\nelements: [cart]\nviews: [front]\nsupersedes: [\"0001\"]\ntags: [storage]", "Keep carts in Redis"),
  "shop/adr/0003-checkout-system.md": adr("status: accepted\ndate: 2024-11-01\nelements: [checkout]", "Group checkout Services"),
  "payments/adr/0001-charge-from-cart.md": adr("status: proposed\ndate: 2026-03-01\nelements: [shop:cart, payments-api, platform:eks-prod]", "Charge from the cart"),
};

async function setup(files: Files = workspace) {
  const session = await connect(files);
  const read = (path: string) => readFile(join(session.root, path), "utf8");
  return { ...session, read };
}

/** `YYYY-MM-DD` of the local day at `d`, as `propose_adr` dates an ADR. */
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => localDay(new Date());

describe("list_adrs", () => {
  it("lists the ADRs for an Element and its descendants, newest first, with matchedVia and superseded ones marked", async () => {
    const { call, text } = await setup();
    const result = await call("list_adrs", { element: "shop:cart" });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      total: 3,
      truncated: false,
      adrs: [
        {
          id: "payments:0001",
          title: "Charge from the cart",
          status: "proposed",
          effectiveStatus: "proposed",
          date: "2026-03-01",
          elements: ["shop:cart", "payments:payments-api", "platform:eks-prod"],
          views: [],
          supersedes: [],
          supersededBy: [],
          tags: [],
          matchedVia: ["shop:cart"],
        },
        expect.objectContaining({ id: "shop:0002", effectiveStatus: "accepted", matchedVia: ["shop:cart"] }),
        expect.objectContaining({ id: "shop:0001", status: "accepted", effectiveStatus: "superseded", supersededBy: ["shop:0002"], matchedVia: ["shop:checkout-ui"] }),
      ],
    });
    expect(text(result)).toBe(
      [
        "3 ADRs for shop:cart.",
        "- payments:0001 Charge from the cart: proposed, 2026-03-01 (via shop:cart)",
        "- shop:0002 Keep carts in Redis: accepted, 2026-02-01 (via shop:cart)",
        "- shop:0001 Keep carts in Postgres: superseded by shop:0002, 2025-05-02 (via shop:checkout-ui)",
      ].join("\n"),
    );
  });

  it("filters on effective status and tag, and pages with limit", async () => {
    const { call } = await setup();

    const ids = async (args: Record<string, unknown>) => ((await call("list_adrs", args)).structuredContent!.adrs as { id: string }[]).map((a) => a.id);
    expect(await ids({ status: "superseded" })).toEqual(["shop:0001"]);
    expect(await ids({ tag: "storage" })).toEqual(["shop:0002", "shop:0001"]);
    expect((await call("list_adrs", { limit: 2 })).structuredContent).toMatchObject({ total: 4, truncated: true, adrs: [{ id: "payments:0001" }, { id: "shop:0002" }] });
  });

  it("returns not_found for an unknown Element", async () => {
    const { call } = await setup();
    expect((await call("list_adrs", { element: "shop:crat" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop:cart"] });
  });
});

describe("get_adr", () => {
  it("returns everything in the Bundle slot, body included", async () => {
    const { call, text } = await setup();
    const result = await call("get_adr", { id: "shop:0001" });

    expect(result.structuredContent).toMatchObject({
      id: "shop:0001",
      title: "Keep carts in Postgres",
      effectiveStatus: "superseded",
      supersededBy: ["shop:0002"],
      body: "# Keep carts in Postgres\n\nSome context.\n",
      source: { file: "archidocs/shop/adr/0001-cart-store.md", line: 1 },
    });
    expect(text(result)).toContain("Superseded by shop:0002");
    expect(text(result)).toContain("# Keep carts in Postgres\n\nSome context.");
  });

  it("returns not_found with suggestions", async () => {
    const { call } = await setup();
    expect((await call("get_adr", { id: "0001" })).structuredContent).toMatchObject({ code: "not_found", suggestions: expect.arrayContaining(["payments:0001", "shop:0001"]) });
  });
});

describe("get_element", () => {
  it("lists the Element's ADRs as list_adrs(element) does", async () => {
    const { call } = await setup();
    const element = (await call("get_element", { id: "shop:checkout" })).structuredContent!;
    const listed = (await call("list_adrs", { element: "shop:checkout" })).structuredContent!;

    expect(element.adrs).toEqual(listed.adrs);
    expect((element.adrs as { id: string }[]).map((a) => a.id)).toEqual(["payments:0001", "shop:0002", "shop:0001", "shop:0003"]);
  });
});

describe("propose_adr", () => {
  it("takes the next free number and fills the default MADR minimal template", async () => {
    const { call, read } = await setup();
    const result = await call("propose_adr", { project: "shop", title: "Cache carts at the edge", elements: ["cart", "platform:eks-prod"], supersedes: ["0002"] });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ action: "created", id: "shop:0004", files: ["archidocs/shop/adr/0004-cache-carts-at-the-edge.md"], dryRun: false });
    const written = await read("shop/adr/0004-cache-carts-at-the-edge.md");
    expect(written).toBe(`---
status: proposed
date: ${today()}
elements: [cart, platform:eks-prod]
supersedes: ["0002"]
---

# Cache carts at the edge

## Context and Problem Statement

{Describe the context and problem statement in two or three sentences.}

## Considered Options

* {title of option 1}
* {title of option 2}

## Decision Outcome

Chosen option: "{title of option 1}", because {justification}.

### Consequences

* Good, because {positive consequence}
* Bad, because {negative consequence}
`);
    const listed = (await call("list_adrs", { element: "shop:cart" })).structuredContent!.adrs as { id: string; status: string }[];
    expect(listed[0]).toMatchObject({ id: "shop:0004", status: "proposed" });
  });

  it("uses the Workspace template over the default, and the Project template over both", async () => {
    const files: Files = {
      ...workspace,
      "adr-template.md": "---\nstatus: draft\ndate: {{date}}\nconsulted: [platform-team]\n---\n\n# {{title}}\n\nWorkspace template. Affects {{elements}}; Views {{views}}.\n",
      "payments/adr/template.md": "---\n# Payments house format\nstatus: proposed\ndate: {{date}}\n---\n\n# Decision: {{title}}\n\nPayments template.\n",
    };
    const { call, read } = await setup(files);

    await call("propose_adr", { project: "shop", title: "Split the cart", elements: ["cart"], views: ["front"] });
    expect(await read("shop/adr/0004-split-the-cart.md")).toBe(
      `---\nstatus: proposed\ndate: ${today()}\nconsulted: [platform-team]\nelements: [cart]\nviews: [front]\n---\n\n# Split the cart\n\nWorkspace template. Affects cart; Views front.\n`,
    );

    await call("propose_adr", { project: "payments", title: "Retry charges" });
    expect(await read("payments/adr/0002-retry-charges.md")).toBe(`---\n# Payments house format\nstatus: proposed\ndate: ${today()}\n---\n\n# Decision: Retry charges\n\nPayments template.\n`);

    await call("propose_adr", { project: "platform", title: "Run on EKS" });
    expect(await read("platform/adr/0001-run-on-eks.md")).toContain("\n# Run on EKS\n\nWorkspace template. Affects ; Views .\n");
  });

  it("dates a new ADR by the local day, not the UTC day", async () => {
    // Each instant is 23:30 and 00:30 UTC. In any zone with a non-zero offset,
    // one of them falls on a different local day from its UTC day. Under UTC
    // both pass, so this proves the fix only where the runner's zone is not UTC.
    const { call, read } = await setup();
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (const [instant, title, path] of [
        ["2026-11-27T23:30:00Z", "Late UTC", "shop/adr/0004-late-utc.md"],
        ["2026-11-28T00:30:00Z", "After midnight UTC", "shop/adr/0005-after-midnight-utc.md"],
      ] as const) {
        vi.setSystemTime(new Date(instant));
        await call("propose_adr", { project: "shop", title, body: "Text.\n" });
        expect(await read(path)).toContain(`date: ${localDay(new Date(instant))}\n`);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes a given body under the title instead of the template", async () => {
    const { call, read } = await setup();
    await call("propose_adr", { project: "shop", title: "Use Redis", body: "We move carts to Redis.\n" });
    expect(await read("shop/adr/0004-use-redis.md")).toBe(`---\nstatus: proposed\ndate: ${today()}\n---\n\n# Use Redis\n\nWe move carts to Redis.\n`);
  });

  it("returns the diff without writing on a dry run", async () => {
    const { call, root } = await setup();
    const result = await call("propose_adr", { project: "shop", title: "Use Redis", body: "Text.", dry_run: true });

    expect(result.structuredContent).toMatchObject({ action: "created", id: "shop:0004", dryRun: true });
    expect(result.structuredContent!.diff).toContain("+# Use Redis");
    await expect(readFile(join(root, "shop/adr/0004-use-redis.md"), "utf8")).rejects.toThrow();
  });

  it("refuses unknown links and supersedes with the issues, writing nothing", async () => {
    const { call, root } = await setup();
    const result = await call("propose_adr", { project: "shop", title: "Use Redis", elements: ["crat"], supersedes: ["0009"] });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      code: "validation_failed",
      issues: [
        { file: "archidocs/shop/adr/0004-use-redis.md", rule: "unknown-adr-link", message: 'Unknown Element or Deployment Target "crat" in Project "shop"; did you mean "cart"?' },
        { file: "archidocs/shop/adr/0004-use-redis.md", rule: "unknown-adr-link", message: 'Unknown ADR "0009" in Project "shop"; did you mean "0001"?' },
      ],
    });
    await expect(readFile(join(root, "shop/adr/0004-use-redis.md"), "utf8")).rejects.toThrow();
  });

  it("refuses an unknown Project and an empty title", async () => {
    const { call } = await setup();
    expect((await call("propose_adr", { project: "shp", title: "X" })).structuredContent).toMatchObject({ code: "not_found", suggestions: ["shop"] });
    expect((await call("propose_adr", { project: "shop", title: " " })).structuredContent).toMatchObject({ code: "invalid_input" });
  });
});

describe("removals refused while an ADR links the item", () => {
  it("refuses remove_element, remove_target and remove_view with the ADR's file:line", async () => {
    const files: Files = { ...workspace, "shop/adr/0004-retire-search.md": adr("status: accepted\ndate: 2026-04-01\nelements: [order-history]", "Retire order history") };
    const { call } = await setup(files);

    expect((await call("remove_element", { project: "shop", id: "order-history" })).structuredContent).toMatchObject({
      code: "validation_failed",
      references: [{ file: "archidocs/shop/adr/0004-retire-search.md", line: 4, what: "ADR shop:0004 links it" }],
    });
    expect((await call("remove_target", { project: "platform", id: "eks-prod" })).structuredContent).toMatchObject({
      code: "validation_failed",
      references: expect.arrayContaining([{ file: "archidocs/payments/adr/0001-charge-from-cart.md", line: 4, what: "ADR payments:0001 links it" }]),
    });
    expect((await call("remove_view", { project: "shop", id: "front" })).structuredContent).toMatchObject({
      code: "validation_failed",
      references: [{ file: "archidocs/shop/adr/0002-cart-store-v2.md", line: 5, what: "ADR shop:0002 links it" }],
    });
  });
});
