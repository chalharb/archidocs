import { describe, expect, it } from "vitest";
import { listAdrs, rules } from "../../src/core/index.ts";
import { landscapeWorkspace } from "../support/fixtures.ts";
import { loadWorkspace, type Files } from "../support/workspace.ts";

/** An ADR file: frontmatter lines, then a `# ` title and a body. */
const adr = (frontmatter: string, title = "Use Kafka for payment events", body = "We publish payment events on Kafka.\n") =>
  `---\n${frontmatter}\n---\n\n# ${title}\n\n${body}`;

const withAdrs = (adrs: Files): Files => ({ ...landscapeWorkspace, ...adrs });

describe("ADRs in the Bundle", () => {
  it("reads each ADR in a Project's adr/ folder, with its title, frontmatter, qualified links and body", async () => {
    const { bundle, issues } = await loadWorkspace(
      withAdrs({
        "shop/adr/0001-use-kafka.md": adr(
          "status: accepted\ndate: 2026-03-01\ndecision-makers: [storefront-team, Ana]\nconsulted: [payments-team]\ninformed: [platform-team]\ntags: [messaging]\nelements: [order-history, payments:payments-api, platform:eks-prod]\nviews: []",
        ),
        "shop/adr/template.md": "---\nstatus: proposed\ndate: {{date}}\n---\n\n# {{title}}\n",
      }),
    );

    expect(issues).toEqual([]);
    expect(bundle.adrs).toEqual([
      {
        id: "shop:0001",
        project: "shop",
        title: "Use Kafka for payment events",
        status: "accepted",
        effectiveStatus: "accepted",
        date: "2026-03-01",
        elements: ["shop:order-history", "payments:payments-api", "platform:eks-prod"],
        views: [],
        supersedes: [],
        supersededBy: [],
        decisionMakers: ["storefront-team", "Ana"],
        consulted: ["payments-team"],
        informed: ["platform-team"],
        tags: ["messaging"],
        body: "# Use Kafka for payment events\n\nWe publish payment events on Kafka.\n",
        source: { file: "archidocs/shop/adr/0001-use-kafka.md", line: 1 },
      },
    ]);
  });

  it("derives supersededBy and the effective status only once the superseding ADR is accepted", async () => {
    const { bundle, issues } = await loadWorkspace(
      withAdrs({
        "shop/adr/0001-use-rabbitmq.md": adr("status: accepted\ndate: 2025-01-10", "Use RabbitMQ"),
        "shop/adr/0002-use-kafka.md": adr("status: accepted\ndate: 2026-03-01\nsupersedes: [\"0001\"]"),
        "payments/adr/0001-retry-charges.md": adr("status: accepted\ndate: 2025-06-01", "Retry charges"),
        "payments/adr/0002-idempotent-charges.md": adr("status: proposed\ndate: 2026-04-01\nsupersedes: [payments:0001]", "Idempotent charges"),
      }),
    );

    expect(issues).toEqual([]);
    expect(bundle.adrs.map((a) => [a.id, a.status, a.effectiveStatus, a.supersedes, a.supersededBy])).toEqual([
      ["payments:0001", "accepted", "accepted", [], []],
      ["payments:0002", "proposed", "proposed", ["payments:0001"], []],
      ["shop:0001", "accepted", "superseded", [], ["shop:0002"]],
      ["shop:0002", "accepted", "accepted", ["shop:0001"], []],
    ]);
  });
});

describe("listAdrs", () => {
  const timeline = withAdrs({
    "shop/adr/0001-checkout-system.md": adr("status: accepted\ndate: 2025-01-10\nelements: [checkout]\ntags: [structure]", "Group checkout Services"),
    "shop/adr/0002-cart-store.md": adr("status: accepted\ndate: 2025-05-02\nelements: [cart-db, web]\ntags: [storage]", "Keep carts in Postgres"),
    "shop/adr/0003-cart-ui.md": adr("status: accepted\ndate: 2025-05-02\nelements: [checkout-ui]", "Render checkout on the server"),
    "shop/adr/0004-cart-store-v2.md": adr("status: accepted\ndate: 2026-02-01\nelements: [cart]\nsupersedes: [\"0002\"]\ntags: [storage]", "Keep carts in Redis"),
    "payments/adr/0001-cart-api.md": adr("status: proposed\ndate: 2026-03-01\nelements: [shop:cart, payments-api]", "Charge from the cart"),
    "platform/adr/0001-eks.md": adr("status: accepted\ndate: 2025-02-01\nelements: [eks-prod]", "Run on EKS"),
  });

  it("returns the ADRs linking an Element or its descendants, not its ancestors, newest first, with matchedVia", async () => {
    const { bundle } = await loadWorkspace(timeline);

    expect(listAdrs(bundle, { element: "shop:cart" }).map((a) => [a.id, a.date, a.effectiveStatus, a.matchedVia])).toEqual([
      ["payments:0001", "2026-03-01", "proposed", ["shop:cart"]],
      ["shop:0004", "2026-02-01", "accepted", ["shop:cart"]],
      ["shop:0003", "2025-05-02", "accepted", ["shop:checkout-ui"]],
    ]);
    expect(listAdrs(bundle, { element: "shop:checkout" }).map((a) => [a.id, a.matchedVia])).toEqual([
      ["payments:0001", ["shop:cart"]],
      ["shop:0004", ["shop:cart"]],
      ["shop:0003", ["shop:checkout-ui"]],
      ["shop:0002", ["shop:cart-db"]],
      ["shop:0001", ["shop:checkout"]],
    ]);
    expect(listAdrs(bundle, { element: "platform:aws-eu" }).map((a) => a.id)).toEqual(["platform:0001"]);
  });

  it("filters on effective status and tag", async () => {
    const { bundle } = await loadWorkspace(timeline);

    expect(listAdrs(bundle, { status: "superseded" }).map((a) => a.id)).toEqual(["shop:0002"]);
    expect(listAdrs(bundle, { tag: "storage" }).map((a) => [a.id, a.effectiveStatus])).toEqual([
      ["shop:0004", "accepted"],
      ["shop:0002", "superseded"],
    ]);
  });
});

describe("ADR check rules", () => {
  it("are registered, each with a failing and passing example run by the registry test", () => {
    const adrRules = rules.filter((r) => Object.keys(r.example.failing).some((path) => path.includes("/adr/")));
    expect(adrRules.map((r) => [r.id, r.severity])).toEqual([
      ["invalid-adr-frontmatter", "error"],
      ["missing-adr-title", "error"],
      ["bad-adr-filename", "error"],
      ["duplicate-adr-number", "error"],
      ["unknown-adr-link", "error"],
      ["hand-written-superseded", "error"],
      ["supersedes-cycle", "error"],
      ["superseded-twice", "warning"],
      ["supersedes-unaccepted", "warning"],
    ]);
  });

  const issuesOf = async (adrs: Files) =>
    (await loadWorkspace(withAdrs(adrs))).issues.map(({ file, line, rule, severity, message }) => ({ file: file.replace("archidocs/", ""), line, rule, severity, message }));

  it("reports frontmatter, title and filename problems at their lines", async () => {
    expect(
      await issuesOf({
        "shop/adr/0001-use-kafka.md": adr("status: approved\ndate: 2026-03-01\ntag: [messaging]"),
        "shop/adr/0002-no-title.md": "---\nstatus: accepted\ndate: 2026-03-01\n---\n\nJust text.\n",
        "shop/adr/0003-no-frontmatter.md": "# Plain MADR\n",
        "shop/adr/use-redis.md": adr("status: accepted\ndate: 2026-03-01"),
        "shop/adr/0004-bad-date.md": adr("status: accepted\ndate: March 2026"),
      }),
    ).toEqual([
      { file: "shop/adr/0001-use-kafka.md", line: 2, rule: "invalid-adr-frontmatter", severity: "error", message: 'Invalid value for "status": expected one of "proposed"|"accepted"|"rejected"|"deprecated"|"superseded"' },
      { file: "shop/adr/0001-use-kafka.md", line: 4, rule: "invalid-adr-frontmatter", severity: "error", message: 'Unknown field "tag"; did you mean "tags"?' },
      { file: "shop/adr/0002-no-title.md", line: 6, rule: "missing-adr-title", severity: "error", message: "ADR has no title: start the body with a `# ` heading" },
      { file: "shop/adr/0003-no-frontmatter.md", line: 1, rule: "invalid-adr-frontmatter", severity: "error", message: "ADR has no frontmatter: start the file with `---`, then `status` and `date`, then `---`" },
      { file: "shop/adr/0004-bad-date.md", line: 3, rule: "invalid-adr-frontmatter", severity: "error", message: 'Invalid value for "date": must be an ISO date (YYYY-MM-DD)' },
      { file: "shop/adr/use-redis.md", line: 1, rule: "bad-adr-filename", severity: "error", message: 'ADR file "use-redis.md" must be named NNNN-slug.md, such as 0005-use-redis.md' },
    ]);
  });

  it("reports duplicate numbers, unknown links and hand-written superseded", async () => {
    expect(
      await issuesOf({
        "shop/adr/0001-use-kafka.md": adr("status: superseded\ndate: 2026-03-01"),
        "shop/adr/0001-use-redis.md": adr("status: accepted\ndate: 2026-03-01\nelements: [crat, platform:eks-prd, nowhere:web]\nviews: [front]\nsupersedes: [\"0009\", payments:0001]"),
      }),
    ).toEqual([
      { file: "shop/adr/0001-use-kafka.md", line: 2, rule: "hand-written-superseded", severity: "error", message: "`superseded` is derived, never written: give this ADR the status it had, and list it in the new ADR's `supersedes`" },
      { file: "shop/adr/0001-use-redis.md", line: 1, rule: "duplicate-adr-number", severity: "error", message: 'ADR number 0001 is already used in Project "shop" by archidocs/shop/adr/0001-use-kafka.md' },
      { file: "shop/adr/0001-use-redis.md", line: 4, rule: "unknown-adr-link", severity: "error", message: 'Unknown Element or Deployment Target "crat" in Project "shop"; did you mean "cart"?' },
      { file: "shop/adr/0001-use-redis.md", line: 4, rule: "unknown-adr-link", severity: "error", message: 'Unknown Element or Deployment Target "eks-prd" in Project "platform"; did you mean "eks-prod"?' },
      { file: "shop/adr/0001-use-redis.md", line: 4, rule: "unknown-adr-link", severity: "error", message: 'Unknown Project "nowhere"' },
      { file: "shop/adr/0001-use-redis.md", line: 5, rule: "unknown-adr-link", severity: "error", message: 'Unknown Saved View "front" in Project "shop"' },
      { file: "shop/adr/0001-use-redis.md", line: 6, rule: "unknown-adr-link", severity: "error", message: 'Unknown ADR "0009" in Project "shop"; did you mean "0001"?' },
      { file: "shop/adr/0001-use-redis.md", line: 6, rule: "unknown-adr-link", severity: "error", message: 'Unknown ADR "0001" in Project "payments"' },
    ]);
  });

  it("reports a supersedes cycle once, and warns on double and unaccepted supersedes", async () => {
    expect(
      await issuesOf({
        "shop/adr/0001-a.md": adr("status: accepted\ndate: 2026-01-01\nsupersedes: [\"0002\"]"),
        "shop/adr/0002-b.md": adr("status: accepted\ndate: 2026-01-02\nsupersedes: [\"0001\"]"),
        "payments/adr/0001-old.md": adr("status: accepted\ndate: 2025-01-01"),
        "payments/adr/0002-new.md": adr("status: accepted\ndate: 2026-01-01\nsupersedes: [\"0001\"]"),
        "payments/adr/0003-newer.md": adr("status: accepted\ndate: 2026-02-01\nsupersedes: [\"0001\", \"0004\"]"),
        "payments/adr/0004-idea.md": adr("status: proposed\ndate: 2026-01-15"),
      }),
    ).toEqual([
      { file: "payments/adr/0003-newer.md", line: 4, rule: "superseded-twice", severity: "warning", message: "payments:0001 is superseded by more than one accepted ADR: payments:0002, payments:0003" },
      { file: "payments/adr/0003-newer.md", line: 4, rule: "supersedes-unaccepted", severity: "warning", message: "Supersedes payments:0004, which is proposed; only an accepted or deprecated ADR is superseded" },
      { file: "shop/adr/0002-b.md", line: 4, rule: "supersedes-cycle", severity: "error", message: "ADRs supersede each other in a cycle: shop:0001, shop:0002" },
    ]);
  });
});
