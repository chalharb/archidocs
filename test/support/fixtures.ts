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

/** One Project whose Element tree spreads over several files, joined with `in:`. */
export const elementTreeWorkspace: Files = {
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: storefront-team
`,
  "shop/people.yaml": `people:
  shopper:
    name: Shopper
    description: Buys things online.
    tags: [customer]
`,
  "shop/systems.yaml": `systems:
  checkout:
    name: Checkout
    services:
      cart:
        name: Cart
        technology: Go
        components:
          cart-api:
            name: Cart API
      payments:
        name: Payments
        owner: payments-team
  psp:
    name: Payment provider
    external: true
    owner: payments-team
    services:
      psp-gateway:
        name: PSP gateway
        external: true
        owner: payments-team
`,
  "shop/cart/store.yaml": `components:
  cart-store:
    name: Cart store
    in: cart
    technology: Redis
`,
  "shop/web.yaml": `services:
  web:
    name: Web
    components:
      web-ui:
        name: Web UI
`,
};

/**
 * A platform Project declares region › cluster Deployment Targets; two
 * Projects deploy Services onto them in two Environments, one referencing
 * the Targets across Projects.
 */
export const deploymentWorkspace: Files = {
  "workspace.yaml": `teams:
  platform-team:
    name: Platform
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
environments:
  staging:
    name: Staging
  prod:
    name: Production
`,
  "platform/project.yaml": `id: platform
name: Platform
owner: platform-team
`,
  "platform/targets.yaml": `targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    tags: [aws]
    targets:
      eks-staging:
        name: EKS staging
        kind: cluster
      eks-prod:
        name: EKS prod
        kind: cluster
        owner: storefront-team
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: storefront-team
`,
  "shop/model.yaml": `services:
  web:
    name: Web
targets:
  shop-edge:
    name: Shop edge
    kind: cdn
deployments:
  - { service: web, environment: staging, target: platform:eks-staging, url: https://staging.shop.example.com }
  - service: web
    environment: prod
    target: platform:eks-prod
    url: https://shop.example.com
    endpoints:
      - { name: health, url: https://shop.example.com/healthz }
  - { service: web, environment: prod, target: shop-edge }
`,
  "payments/project.yaml": `id: payments
name: Payments
owner: payments-team
`,
  "payments/api.yaml": `services:
  payments-api:
    name: Payments API
    owner: storefront-team
deployments:
  - { service: payments-api, environment: prod, target: platform:eks-prod }
`,
};
