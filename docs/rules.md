# Check rules

<!-- Generated from the rule registry in src/core/rules.ts by `pnpm rules:catalogue`. Do not edit by hand. -->

`archidocs check` reports each issue with one of these rule ids. Errors fail the check; warnings fail it only with `--strict`.

| Rule | Severity | Meaning |
| --- | --- | --- |
| [`yaml-syntax`](#yaml-syntax) | error | A file can't be parsed as YAML. |
| [`unknown-field`](#unknown-field) | error | A key isn't in the schema. |
| [`missing-field`](#missing-field) | error | A required field is absent. |
| [`invalid-value`](#invalid-value) | error | A value has the wrong type, a bad enum value or a malformed URL. |
| [`nested-project`](#nested-project) | error | A `project.yaml` sits inside another Project's folder. |
| [`file-outside-project`](#file-outside-project) | error | A model file is under no Project. |
| [`duplicate-project-id`](#duplicate-project-id) | error | Two Projects share an id. |
| [`definition-outside-workspace`](#definition-outside-workspace) | error | `teams` or `environments` declared outside `workspace.yaml`. |
| [`unknown-team`](#unknown-team) | error | An `owner` names no Team. |
| [`duplicate-id`](#duplicate-id) | error | An Element id is declared twice in a Project, across files too, whatever its kind or nesting. |
| [`invalid-nesting`](#invalid-nesting) | error | System > Service > Component is broken, by nesting or `in:`. |
| [`external-with-components`](#external-with-components) | error | An External System or Service declares Components. |
| [`unknown-element`](#unknown-element) | error | A reference names no Element: in `to`, `via` or `in`. |
| [`unknown-project`](#unknown-project) | error | A `project:` prefix names no Project. |
| [`own-project-prefix`](#own-project-prefix) | error | A Project qualifies its own ids. |
| [`wrong-kind`](#wrong-kind) | error | An id resolves to a kind the field doesn't accept, such as a `via` naming something other than a Service. |
| [`duplicate-relationship-id`](#duplicate-relationship-id) | error | A Relationship `id` repeats in a Project. |
| [`self-relationship`](#self-relationship) | error | An Element has a Relationship to itself. |
| [`person-as-provider`](#person-as-provider) | error | The provider of a Relationship is a Person. |
| [`ancestor-descendant-relationship`](#ancestor-descendant-relationship) | error | An Element is linked to its own ancestor or descendant. |
| [`via-on-sync`](#via-on-sync) | error | `via` or `channel` on a sync Relationship. |
| [`via-not-broker`](#via-not-broker) | error | `via` names a Service that isn't `type: broker`. |

## `yaml-syntax`

**Severity:** error

A file can't be parsed as YAML.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: [Web
```

**Fix:** Correct the YAML syntax at the reported position.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
```

## `unknown-field`

**Severity:** error

A key isn't in the schema.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    techology: Go
```

**Fix:** Remove the key, or correct its spelling to the suggested field.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    technology: Go
```

## `missing-field`

**Severity:** error

A required field is absent.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    technology: Go
```

**Fix:** Add the missing field.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    technology: Go
```

## `invalid-value`

**Severity:** error

A value has the wrong type, a bad enum value or a malformed URL.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  orders-db:
    name: Orders DB
    type: database
```

**Fix:** Change the value to one the field accepts.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  orders-db:
    name: Orders DB
    type: datastore
```

## `nested-project`

**Severity:** error

A `project.yaml` sits inside another Project's folder.

**Failing example**

`shop/legacy/project.yaml`:

```yaml
id: legacy
name: Legacy
owner: core
```

**Fix:** Move the inner Project's folder out of the outer Project's folder.

**Fixed**

`legacy/project.yaml`:

```yaml
id: legacy
name: Legacy
owner: core
```

`shop/legacy/project.yaml`: removed.

## `file-outside-project`

**Severity:** error

A model file is under no Project.

**Failing example**

`services.yaml`:

```yaml
services:
  web:
    name: Web
```

**Fix:** Move the file into a Project folder (one with a `project.yaml`).

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
```

`services.yaml`: removed.

## `duplicate-project-id`

**Severity:** error

Two Projects share an id.

**Failing example**

`shop-admin/project.yaml`:

```yaml
id: shop
name: Shop admin
owner: core
```

**Fix:** Give one of the Projects a different id.

**Fixed**

`shop-admin/project.yaml`:

```yaml
id: shop-admin
name: Shop admin
owner: core
```

## `definition-outside-workspace`

**Severity:** error

`teams` or `environments` declared outside `workspace.yaml`.

**Failing example**

`shop/services.yaml`:

```yaml
teams:
  web-team:
    name: Web
```

`workspace.yaml`:

```yaml
teams:
  core:
    name: Core
environments:
  prod:
    name: Production
```

**Fix:** Move the definitions into `workspace.yaml` at the Workspace root.

**Fixed**

`workspace.yaml`:

```yaml
teams:
  core:
    name: Core
  web-team:
    name: Web
environments:
  prod:
    name: Production
```

`shop/services.yaml`: removed.

## `unknown-team`

**Severity:** error

An `owner` names no Team.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    owner: cor
```

**Fix:** Use the id of a Team defined in `workspace.yaml`, or define the Team there.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    owner: core
```

## `duplicate-id`

**Severity:** error

An Element id is declared twice in a Project, across files too, whatever its kind or nesting.

**Failing example**

`shop/more.yaml`:

```yaml
services:
  web:
    name: Web v2
```

**Fix:** Rename one of the Elements, or remove the second declaration.

**Fixed**

`shop/more.yaml`:

```yaml
services:
  web-v2:
    name: Web v2
```

## `invalid-nesting`

**Severity:** error

System > Service > Component is broken, by nesting or `in:`.

**Failing example**

`shop/services.yaml`:

```yaml
systems:
  checkout:
    name: Checkout
    components:
      cart-api:
        name: Cart API
```

**Fix:** Move the Element under a parent of the right kind (a Service under a System, a Component under a Service), or point `in:` at one.

**Fixed**

`shop/services.yaml`:

```yaml
systems:
  checkout:
    name: Checkout
    services:
      cart:
        name: Cart
        components:
          cart-api:
            name: Cart API
```

## `external-with-components`

**Severity:** error

An External System or Service declares Components.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  stripe:
    name: Stripe
    external: true
    components:
      stripe-sdk:
        name: Stripe SDK
```

**Fix:** Remove the Components, or drop `external` if the organisation runs the Element itself.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  stripe:
    name: Stripe
    external: true
```

## `unknown-element`

**Severity:** error

A reference names no Element: in `to`, `via` or `in`.

**Failing example**

`shop/cart.yaml`:

```yaml
services:
  cart:
    name: Cart
    in: chekout
```

**Fix:** Use the id of an Element declared in the Project, or declare it.

**Fixed**

`shop/cart.yaml`:

```yaml
services:
  cart:
    name: Cart
    in: checkout
```

## `unknown-project`

**Severity:** error

A `project:` prefix names no Project.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: paymnts:payments-api
```

**Fix:** Correct the prefix to the id of an existing Project.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: payments:payments-api
```

## `own-project-prefix`

**Severity:** error

A Project qualifies its own ids.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: shop:cart
  cart:
    name: Cart
```

**Fix:** Drop the `project:` prefix; within its own Project an id is written bare.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
```

## `wrong-kind`

**Severity:** error

An id resolves to a kind the field doesn't accept, such as a `via` naming something other than a Service.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        interaction: async
        via: checkout
  cart:
    name: Cart
systems:
  checkout:
    name: Checkout
```

**Fix:** Point the field at an Element of the kind it accepts.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        interaction: async
        via: events
  cart:
    name: Cart
  events:
    name: Events
    type: broker
```

## `duplicate-relationship-id`

**Severity:** error

A Relationship `id` repeats in a Project.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - id: add-item
        to: cart
      - id: add-item
        to: cart
        description: Adds a gift card
  cart:
    name: Cart
```

**Fix:** Give one of the Relationships a different id.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - id: add-item
        to: cart
      - id: add-gift-card
        to: cart
        description: Adds a gift card
  cart:
    name: Cart
```

## `self-relationship`

**Severity:** error

An Element has a Relationship to itself.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: web
  cart:
    name: Cart
```

**Fix:** Point `to` at the Element depended on, or remove the Relationship.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
```

## `person-as-provider`

**Severity:** error

The provider of a Relationship is a Person.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: shopper
people:
  shopper:
    name: Shopper
```

**Fix:** A Person is only ever a consumer: declare the Relationship under the Person, pointing at what it uses.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
people:
  shopper:
    name: Shopper
    relationships:
      - to: web
```

## `ancestor-descendant-relationship`

**Severity:** error

An Element is linked to its own ancestor or descendant.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    components:
      web-ui:
        name: Web UI
        relationships:
          - to: web
```

**Fix:** Point `to` at an Element outside the consumer's own branch, such as a sibling.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    components:
      web-ui:
        name: Web UI
        relationships:
          - to: web-api
      web-api:
        name: Web API
```

## `via-on-sync`

**Severity:** error

`via` or `channel` on a sync Relationship.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        via: events
        channel: cart.updated
  cart:
    name: Cart
  events:
    name: Events
    type: broker
```

**Fix:** Set `interaction: async` if the Relationship runs through a broker, or remove `via` and `channel`.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        interaction: async
        via: events
        channel: cart.updated
  cart:
    name: Cart
  events:
    name: Events
    type: broker
```

## `via-not-broker`

**Severity:** error

`via` names a Service that isn't `type: broker`.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        interaction: async
        via: events
  cart:
    name: Cart
  events:
    name: Events
    type: app
```

**Fix:** Point `via` at a broker Service, or mark the Service `type: broker`.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
        interaction: async
        via: events
  cart:
    name: Cart
  events:
    name: Events
    type: broker
```
