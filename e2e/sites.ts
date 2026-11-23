/** Where e2e/serve.ts serves each fixture site; each sits under a sub-path, never at the root. */
export const PORT = 4517;
export const SITES = {
  /** The landscape fixture: Systems, Services with Components, three Teams. */
  landscape: "/team/archidocs/",
  /** A generated Workspace whose C2 Landscape passes 100 nodes once its Systems are open. */
  big: "/team/big/",
  /** The sequence chart scenario: the 46-Step full checkout and a short payment, with event Steps via a broker. */
  checkout: "/team/checkout/",
} as const;
