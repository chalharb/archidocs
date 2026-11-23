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

/**
 * Two Projects with Relationships declared at Person, Service and Component
 * level, across Projects, several on one pair, and one async via a broker.
 */
export const relationshipWorkspace: Files = {
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
    relationships:
      - to: web
        description: Browses and buys
        technology: HTTPS
`,
  "shop/systems.yaml": `systems:
  checkout:
    name: Checkout
    services:
      cart:
        name: Cart
        relationships:
          - to: cart-db
            description: Reads and writes carts
        components:
          checkout-ui:
            name: Checkout UI
            relationships:
              - id: authorise
                to: payments:charges
                description: Authorises a card
              - id: capture
                to: payments:charges
                description: Captures a payment
      cart-db:
        name: Cart DB
        type: datastore
      order-history:
        name: Order history
        relationships:
          - to: payments:charges
            description: Payment events
            interaction: async
            via: events
            channel: payment.captured
`,
  "shop/web.yaml": `services:
  web:
    name: Web
    relationships:
      - to: cart
        description: Manages the cart
  events:
    name: Events
    type: broker
    technology: Kafka
`,
  "payments/project.yaml": `id: payments
name: Payments
owner: payments-team
`,
  "payments/model.yaml": `systems:
  payments:
    name: Payments
    services:
      payments-api:
        name: Payments API
        components:
          charges:
            name: Charges
`,
};

/**
 * The Relationship Workspace grown into a small landscape: a Service owned by
 * another Team than its System, a platform Project's Deployment Targets, and
 * Deployments onto them from two Projects.
 */
export const landscapeWorkspace: Files = {
  ...relationshipWorkspace,
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
  platform-team:
    name: Platform
environments:
  prod:
    name: Production
`,
  "shop/fraud.yaml": `services:
  fraud-check:
    name: Fraud check
    in: checkout
    owner: payments-team
    relationships:
      - to: payments:payments-api
        description: Scores a payment
deployments:
  - { service: cart, environment: prod, target: platform:eks-prod }
`,
  "payments/deployments.yaml": `deployments:
  - { service: payments-api, environment: prod, target: platform:eks-prod }
`,
  "platform/project.yaml": `id: platform
name: Platform
owner: platform-team
`,
  "platform/targets.yaml": `targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      eks-prod:
        name: EKS prod
        kind: cluster
`,
};

/**
 * The landscape the viewer's Playwright suite serves: the landscape Workspace
 * with a staging Environment and URLs on Cart's Deployments, so a URL can be
 * found and copied.
 */
export const viewerWorkspace: Files = {
  ...landscapeWorkspace,
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
  platform-team:
    name: Platform
environments:
  prod:
    name: Production
  staging:
    name: Staging
`,
  "shop/fraud.yaml": `services:
  fraud-check:
    name: Fraud check
    in: checkout
    owner: payments-team
    relationships:
      - to: payments:payments-api
        description: Scores a payment
deployments:
  - service: cart
    environment: prod
    target: platform:eks-prod
    url: https://cart.shop.example.com
    endpoints:
      - { name: health, url: https://cart.shop.example.com/healthz }
  - { service: cart, environment: staging, target: platform:eks-staging, url: https://cart.staging.shop.example.com }
`,
  "platform/targets.yaml": `targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      eks-prod:
        name: EKS prod
        kind: cluster
      eks-staging:
        name: EKS staging
        kind: cluster
`,
};

/** One Step of a fixture Dynamic View, as written in YAML. */
type StepRow = { from: string; to: string; description?: string; relationship?: string; return?: true; note?: string };
const stepYaml = (s: StepRow) =>
  `      - { ${Object.entries(s)
    .map(([k, v]) => `${k}: ${typeof v === "string" && /[:{}[\],#"]/.test(v) ? JSON.stringify(v) : String(v)}`)
    .join(", ")} }`;

const api = "checkout-api";
/**
 * The full checkout of the sequence chart prototype: 46 Steps across 16
 * participants, with nested sync calls and their returns, two event Steps via
 * the platform's Event Bus and a fire-and-forget async call.
 */
export const fullCheckoutSteps: StepRow[] = [
  { from: "shopper", to: "checkout-web", description: "Opens checkout with 3 items in the basket" },
  { from: "checkout-web", to: api, description: "GET /checkout/session" },
  { from: api, to: "identity:auth", description: "Validate session token" },
  { from: "identity:auth", to: api, return: true, description: "Session valid" },
  { from: api, to: "identity:profile", description: "Load saved addresses and payment preferences for the signed-in user" },
  { from: "identity:profile", to: api, return: true, description: "Two addresses, default card" },
  { from: api, to: "pricing", description: "Price basket" },
  { from: "pricing", to: "promotions", description: "Find promotions for basket and loyalty tier" },
  { from: "promotions", to: "pricing", return: true, description: "WINTER10 applies" },
  { from: "pricing", to: api, return: true, description: "Subtotal 84.00" },
  { from: api, to: "fulfilment:inventory-api", description: "Check stock for 3 SKUs" },
  { from: "fulfilment:inventory-api", to: api, return: true, description: "All in stock" },
  { from: api, to: "fulfilment:shipping-api", description: "Quote shipping to default address" },
  { from: "fulfilment:shipping-api", to: "fulfilment:carrier-gateway", description: "Request carrier rates (DHL, UPS)" },
  { from: "fulfilment:carrier-gateway", to: "fulfilment:shipping-api", return: true, description: "Rates" },
  { from: "fulfilment:shipping-api", to: api, return: true, relationship: "quote", description: "3 options" },
  { from: api, to: "checkout-web", return: true, description: "200 session + basket" },
  { from: "checkout-web", to: "shopper", return: true, description: "Renders checkout page" },
  { from: "shopper", to: "checkout-web", description: "Chooses express shipping and clicks \"Place order\"" },
  { from: "checkout-web", to: api, description: "POST /orders" },
  { from: api, to: "identity:auth", description: "Re-validate session token" },
  { from: "identity:auth", to: api, return: true, description: "Session valid" },
  { from: api, to: "fulfilment:inventory-api", description: "Reserve stock for 15 minutes" },
  { from: "fulfilment:inventory-api", to: api, return: true, description: "Reservation r-77" },
  { from: api, to: "orders-db", description: "INSERT order, status pending" },
  { from: "orders-db", to: api, return: true, description: "order 9031" },
  { from: api, to: "payments:payments-api", description: "POST /payments/authorize" },
  { from: "payments:payments-api", to: "payments:fraud-scorer", description: "Score transaction" },
  { from: "payments:fraud-scorer", to: "payments:payments-api", return: true, description: "Risk 0.12" },
  { from: "payments:payments-api", to: "payments:stripe", description: "Create PaymentIntent", note: "Idempotency key is the order id" },
  { from: "payments:stripe", to: "payments:payments-api", return: true, description: "requires_capture" },
  { from: "payments:payments-api", to: "payments:ledger-db", description: "Write authorization hold" },
  { from: "payments:payments-api", to: api, return: true, relationship: "authorize", description: "200 Authorized" },
  { from: api, to: "orders-db", description: "UPDATE order, status authorized" },
  { from: api, to: "checkout-web", return: true, description: "201 Created {orderId: 9031}" },
  { from: "checkout-web", to: "shopper", return: true, description: "Shows the confirmation page" },
  { from: "payments:payments-api", to: api, description: "PaymentAuthorized event", note: "Arrives after the response; Checkout API marks the order paid" },
  { from: api, to: "fulfilment:shipping-api", description: "Book express shipment for order 9031" },
  { from: "fulfilment:shipping-api", to: "fulfilment:carrier-gateway", description: "Create shipping label" },
  { from: "fulfilment:carrier-gateway", to: "fulfilment:shipping-api", return: true, description: "Label + tracking number" },
  { from: "fulfilment:shipping-api", to: api, return: true, relationship: "quote", description: "Shipment booked" },
  { from: "fulfilment:shipping-api", to: api, description: "ShipmentBooked event" },
  { from: api, to: "fulfilment:inventory-api", description: "Convert reservation r-77 to allocation" },
  { from: "fulfilment:inventory-api", to: api, return: true, description: "Allocated" },
  { from: api, to: "orders-db", description: "UPDATE order, status paid" },
  { from: api, to: "email-provider", description: "Send confirmation email with tracking link" },
];

/**
 * The sequence chart prototype's Model: a shop, payments, identity and
 * fulfilment, and a platform Event Bus, with the 46-Step `shop:full-checkout`
 * and the 9-Step `shop:pay` (which shares `shop:authorize`) as Dynamic Views.
 */
export const checkoutScenarioWorkspace: Files = {
  "workspace.yaml": `teams:
  orders: { name: Orders }
  payments-team: { name: Payments }
  identity-team: { name: Identity }
  platform-team: { name: Platform }
  fulfilment-team: { name: Fulfilment }
  growth: { name: Growth }
`,
  "shop/project.yaml": "id: shop\nname: Shop\nowner: orders\n",
  "shop/model.yaml": `people:
  shopper:
    name: Shopper
    relationships:
      - { to: checkout-web, description: Browses and checks out, technology: HTTPS }
systems:
  checkout:
    name: Checkout
    services:
      checkout-web:
        name: Checkout Web
        technology: Next.js
        relationships:
          - { to: checkout-api, description: Submits orders, technology: HTTPS/JSON }
      checkout-api:
        name: Checkout API
        technology: Node.js
        relationships:
          - { to: identity:auth, description: Validates sessions, technology: gRPC }
          - { to: identity:profile, description: Reads addresses and preferences, technology: gRPC }
          - { to: orders-db, description: Reads and writes orders, technology: SQL }
          - { id: authorize, to: payments:payments-api, description: Authorizes payments, technology: HTTPS/JSON }
          - { id: payment-updates, to: payments:payments-api, description: Receives payment events, technology: Kafka, interaction: async, via: platform:event-bus, channel: payment-events }
          - { to: email-provider, description: Sends order emails, technology: HTTPS, interaction: async }
          - { to: pricing, description: Prices baskets, technology: gRPC }
          - { to: fulfilment:inventory-api, description: Reserves and releases stock, technology: HTTPS/JSON }
          - { id: quote, to: fulfilment:shipping-api, description: Quotes and books shipping, technology: HTTPS/JSON }
          - { id: shipment-updates, to: fulfilment:shipping-api, description: Receives shipment events, technology: Kafka, interaction: async, via: platform:event-bus, channel: shipment-events }
      orders-db:
        name: Orders DB
        type: datastore
        technology: Postgres
      pricing:
        name: Pricing Engine
        owner: growth
        technology: Rust
        relationships:
          - { to: promotions, description: Looks up applicable promotions, technology: gRPC }
      promotions:
        name: Promotions Service
        owner: growth
        technology: Node.js
  email-provider:
    name: Email Provider
    external: true
`,
  "shop/views.yaml": `views:
  dynamic:
    full-checkout:
      title: Place order (full)
      description: Every Service in a real checkout.
      steps:
${fullCheckoutSteps.map(stepYaml).join("\n")}
    pay:
      title: Pay for an order
      steps:
        - { from: checkout-api, to: payments:payments-api, relationship: authorize }
        - { from: payments:payments-api, to: payments:fraud-scorer }
        - { from: payments:fraud-scorer, to: payments:payments-api, return: true }
        - { from: payments:payments-api, to: checkout-api, return: true, relationship: authorize }
`,
  "payments/project.yaml": "id: payments\nname: Payments\nowner: payments-team\n",
  "payments/model.yaml": `systems:
  payments:
    name: Payments
    services:
      payments-api:
        name: Payments API
        technology: Go
        relationships:
          - { to: fraud-scorer, description: Scores transactions, technology: gRPC }
          - { to: stripe, description: Creates and captures payment intents, technology: HTTPS }
          - { to: ledger-db, description: Records ledger entries, technology: SQL }
      fraud-scorer:
        name: Fraud Scorer
        technology: Python
      ledger-db:
        name: Ledger DB
        type: datastore
        technology: Postgres
  stripe:
    name: Stripe
    external: true
`,
  "identity/project.yaml": "id: identity\nname: Identity\nowner: identity-team\n",
  "identity/model.yaml": `systems:
  identity:
    name: Identity
    services:
      auth: { name: Auth Service, technology: Go }
      profile: { name: Profile Service, technology: Kotlin }
`,
  "platform/project.yaml": "id: platform\nname: Platform\nowner: platform-team\n",
  "platform/model.yaml": "services:\n  event-bus:\n    name: Event Bus\n    type: broker\n    technology: Kafka\n",
  "fulfilment/project.yaml": "id: fulfilment\nname: Fulfilment\nowner: fulfilment-team\n",
  "fulfilment/model.yaml": `systems:
  fulfilment:
    name: Fulfilment
    services:
      inventory-api: { name: Inventory API, technology: Java }
      shipping-api:
        name: Shipping API
        technology: Java
        relationships:
          - { to: carrier-gateway, description: Requests carrier rates and labels, technology: HTTPS }
  carrier-gateway:
    name: Carrier Gateway (DHL, UPS)
    external: true
`,
};

/**
 * A prod Environment over nested Targets (region › cluster › namespace in
 * two regions, plus a separate data-centre), for Deployment Views: Web and
 * Cart run in both regions, Payments API in its own namespace and in the US,
 * Analytics only in the data-centre, Search nowhere, and Stripe is External.
 */
export const deploymentViewWorkspace: Files = {
  "workspace.yaml": `teams:
  storefront-team:
    name: Storefront
  payments-team:
    name: Payments
  platform-team:
    name: Platform
environments:
  prod:
    name: Production
  staging:
    name: Staging
`,
  "platform/project.yaml": `id: platform
name: Platform
owner: platform-team
`,
  "platform/targets.yaml": `targets:
  aws-eu:
    name: AWS eu-west-1
    kind: region
    targets:
      eks-eu:
        name: EKS eu
        kind: cluster
        targets:
          ns-shop:
            name: shop namespace
            kind: namespace
          ns-pay:
            name: payments namespace
            kind: namespace
  aws-us:
    name: AWS us-east-1
    kind: region
    targets:
      eks-us:
        name: EKS us
        kind: cluster
  dc:
    name: Data centre
    kind: datacentre
`,
  "shop/project.yaml": `id: shop
name: Shop
owner: storefront-team
`,
  "shop/model.yaml": `people:
  shopper:
    name: Shopper
    relationships:
      - to: web
        description: Shops
systems:
  checkout:
    name: Checkout
    services:
      web:
        name: Web
        technology: Next.js
        relationships:
          - to: cart
            description: Reads the basket
          - to: search
            description: Searches products
      cart:
        name: Cart
        technology: Go
        components:
          cart-api:
            name: Cart API
            relationships:
              - to: payments:payments-api
                description: Takes payment
services:
  search:
    name: Search
  analytics:
    name: Analytics
    relationships:
      - to: payments:payments-api
        description: Reads payments
deployments:
  - { service: web, environment: prod, target: platform:ns-shop, url: https://shop.example.com }
  - { service: web, environment: prod, target: platform:eks-us }
  - { service: cart, environment: prod, target: platform:ns-shop }
  - { service: cart, environment: prod, target: platform:eks-us }
  - { service: analytics, environment: prod, target: platform:dc }
  - { service: web, environment: staging, target: platform:eks-eu }
`,
  "payments/project.yaml": `id: payments
name: Payments
owner: payments-team
`,
  "payments/model.yaml": `services:
  payments-api:
    name: Payments API
    relationships:
      - to: stripe
        description: Charges cards
  stripe:
    name: Stripe
    external: true
deployments:
  - { service: payments-api, environment: prod, target: platform:ns-pay }
  - { service: payments-api, environment: prod, target: platform:eks-us }
`,
};
