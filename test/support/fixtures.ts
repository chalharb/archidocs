import type { Files } from "./workspace.ts";

/** A valid Workspace: two Projects, Teams, Environments and Services. */
export const validWorkspace: Files = {
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
    description: Owns the online shop.
    links:
      - label: Handbook
        url: https://wiki.example.com/storefront
  payments-team:
    name: Payments
environments:
  staging:
    name: Staging
  prod:
    name: Production
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: storefront-team
`,
  "shop/services.yaml": `services:
  web:
    name: Web
    technology: Next.js
    tags: [frontend]
  orders-db:
    name: Orders DB
    type: datastore
    technology: Postgres
`,
  "payments/project.yaml": `id: payments
name: Payments
owner: payments-team
`,
  "payments/model/api.yaml": `# The public payments API.
services:
  payments-api:
    name: Payments API
    description: Takes card payments.
    technology: Go
    links:
      - label: Runbook
        url: https://runbooks.example.com/payments-api
  stripe:
    name: Stripe
    external: true
    owner: storefront-team
`,
};
