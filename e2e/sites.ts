/** Where e2e/serve.ts serves each fixture site; each sits under a sub-path, never at the root. `E2E_PORT` moves the port, so suites in several checkouts can run side by side. */
export const PORT = Number(process.env.E2E_PORT ?? 4517);
export const SITES = {
  /** The landscape fixture: Systems, Services with Components, three Teams. */
  landscape: "/team/archidocs/",
  /** A generated Workspace whose C2 Landscape passes 100 nodes once its Systems are open. */
  big: "/team/big/",
  /** The sequence chart scenario: the 46-Step full checkout and a short payment, with event Steps via a broker. */
  checkout: "/team/checkout/",
  /** A git history: the first model (dropped by `--keep 1`), Legacy added (tag v1), then Wishlist added, Web renamed and Legacy removed. */
  history: "/team/history/",
  /** A PR preview (`build --preview`): main has the Legacy shop (historyBefore); the PR adds Wishlist, renames Web and retires Legacy. */
  preview: "/team/preview/",
  /** The landscape plus a Saved View and ADRs linked to Cart, Cart DB and Checkout. */
  decisions: "/team/decisions/",
  /** The Big Bank demo, built by `examples/big-bank/build-demo.mjs` with its history: the docs' viewer URL reference links into it. */
  bigBank: "/team/big-bank/",
} as const;
