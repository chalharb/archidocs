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
| [`unknown-team`](#unknown-team) | error | An `owner`, or a Saved View's `{team}` selector or Team Lens, names no Team. |
| [`duplicate-id`](#duplicate-id) | error | An Element or Deployment Target id is declared twice in a Project, across files too, whatever its kind or nesting. |
| [`invalid-nesting`](#invalid-nesting) | error | System > Service > Component is broken, by nesting or `in:`. |
| [`external-with-components`](#external-with-components) | error | An External System or Service declares Components. |
| [`unknown-element`](#unknown-element) | error | A reference names no Element: in `to`, `via`, `in`, a Deployment's `service`, or a Saved View's selectors, `expand`, `collapse` or Lens. |
| [`unknown-project`](#unknown-project) | error | A `project:` prefix names no Project. |
| [`own-project-prefix`](#own-project-prefix) | error | A Project qualifies its own ids. |
| [`duplicate-relationship-id`](#duplicate-relationship-id) | error | A Relationship `id` repeats in a Project. |
| [`self-relationship`](#self-relationship) | error | An Element has a Relationship to itself. |
| [`person-as-provider`](#person-as-provider) | error | The provider of a Relationship is a Person. |
| [`ancestor-descendant-relationship`](#ancestor-descendant-relationship) | error | An Element is linked to its own ancestor or descendant. |
| [`via-on-sync`](#via-on-sync) | error | `via` or `channel` on a sync Relationship. |
| [`via-not-broker`](#via-not-broker) | error | `via` names a Service that isn't `type: broker`. |
| [`duplicate-deployment`](#duplicate-deployment) | error | The same Service, Environment and Target appear twice. |
| [`unknown-environment`](#unknown-environment) | error | A Deployment, or a Saved Deployment View, names no Environment. |
| [`unknown-target`](#unknown-target) | error | A Deployment, or a Saved Deployment View's `targets`, names no Deployment Target. |
| [`wrong-kind`](#wrong-kind) | error | An id resolves to a kind the field doesn't accept, such as a Deployment's `service` naming a Component or System, or a Relationship's `via` naming something other than a Service. |
| [`oversized-view`](#oversized-view) | warning | A View has more than 150 nodes, too many for a readable diagram. A Generated View is reported at its System or Service, or at `workspace.yaml` for the Landscapes; a Saved View at its id. |
| [`duplicate-view-id`](#duplicate-view-id) | error | A Saved View id repeats in a Project, across files too. |
| [`missing-step`](#missing-step) | error | A Dynamic View Step has no Relationship or derived edge between `from` and `to` (nor a `via` subscription of `to` to `from`), or the named `relationship` doesn't connect them. |
| [`ambiguous-step`](#ambiguous-step) | error | Several Relationships match a Dynamic View Step (several between the pair, or both a call and an event) and no `relationship` names one. |
| [`return-without-relationship`](#return-without-relationship) | error | A Dynamic View return Step has no Relationship the other way, from its `to` to its `from`. |
| [`return-on-async`](#return-on-async) | error | A Dynamic View return Step resolves to an async Relationship, which has no reply. |
| [`ancestor-descendant-participants`](#ancestor-descendant-participants) | error | An Element and its own ancestor are both participants of a Dynamic View. |
| [`target-outside-environment`](#target-outside-environment) | error | A Saved Deployment View's `targets` entry has no Deployment in the View's `environment`, on it or on any Target inside it. |
| [`bad-expand`](#bad-expand) | error | A Saved View's `expand` or `collapse` id is not a node of the View once collapsed to its `level`, or has no children. |
| [`empty-view`](#empty-view) | warning | A Saved View resolves to no nodes. |
| [`unresolved-path`](#unresolved-path) | warning | A Saved View's path selector, or path Lens, finds no path between its two Elements. |
| [`invalid-adr-frontmatter`](#invalid-adr-frontmatter) | error | An ADR has no frontmatter, frontmatter that isn't valid YAML, or a field that is unknown, missing (`status`, `date`) or invalid, such as a `status` outside proposed, accepted, rejected, deprecated and superseded. |
| [`missing-adr-title`](#missing-adr-title) | error | An ADR's body has no `# ` heading to take its title from. |
| [`bad-adr-filename`](#bad-adr-filename) | error | A file in a Project's `adr/` folder isn't named `NNNN-slug.md` (and isn't `template.md`). |
| [`duplicate-adr-number`](#duplicate-adr-number) | error | Two ADRs in a Project share a number, as when two pull requests each take the next free one. |
| [`unknown-adr-link`](#unknown-adr-link) | error | An ADR's `elements` names no Element or Deployment Target, its `views` no Saved View, or its `supersedes` no ADR. |
| [`hand-written-superseded`](#hand-written-superseded) | error | An ADR's `status` is written as `superseded`; that status is derived once an accepted ADR lists it in `supersedes`. |
| [`supersedes-cycle`](#supersedes-cycle) | error | ADRs supersede each other in a cycle, directly or through others. Reported once, at the cycle's last file. |
| [`superseded-twice`](#superseded-twice) | warning | An ADR is superseded by more than one accepted ADR. Reported at the last of them. |
| [`supersedes-unaccepted`](#supersedes-unaccepted) | warning | An ADR supersedes one that isn't accepted or deprecated, such as a proposed or rejected ADR. |

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

An `owner`, or a Saved View's `{team}` selector or Team Lens, names no Team.

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

An Element or Deployment Target id is declared twice in a Project, across files too, whatever its kind or nesting.

**Failing example**

`shop/more.yaml`:

```yaml
services:
  web:
    name: Web v2
```

**Fix:** Rename one of the Elements or Targets, or remove the second declaration.

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

**Fix:** Remove the Components, or drop `external` if the organization runs the Element itself.

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

A reference names no Element: in `to`, `via`, `in`, a Deployment's `service`, or a Saved View's selectors, `expand`, `collapse` or Lens.

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

## `duplicate-deployment`

**Severity:** error

The same Service, Environment and Target appear twice.

**Failing example**

`shop/more.yaml`:

```yaml
deployments:
  - { service: web, environment: prod, target: eks-prod, url: https://www.shop.example.com }
```

**Fix:** Remove the second Deployment, or merge its `url` and `endpoints` into the first.

**Fixed**

`shop/more.yaml`: removed.

## `unknown-environment`

**Severity:** error

A Deployment, or a Saved Deployment View, names no Environment.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: web, environment: production, target: eks-prod }
```

**Fix:** Use the id of an Environment defined in `workspace.yaml`, or define the Environment there.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: web, environment: prod, target: eks-prod }
```

## `unknown-target`

**Severity:** error

A Deployment, or a Saved Deployment View's `targets`, names no Deployment Target.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: web, environment: prod, target: eks-prd }
```

**Fix:** Use the id of a Target declared in the Project, or `project:id` for one declared in another Project.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: web, environment: prod, target: eks-prod }
```

## `wrong-kind`

**Severity:** error

An id resolves to a kind the field doesn't accept, such as a Deployment's `service` naming a Component or System, or a Relationship's `via` naming something other than a Service.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: cart, environment: prod, target: eks-prod }
```

**Fix:** Point the field at an id of the kind it accepts: a Deployment's `service` and a Relationship's `via` each name a Service.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
  checkout:
    name: Checkout
    components:
      cart:
        name: Cart
targets:
  eks-prod:
    name: EKS prod
    kind: cluster
deployments:
  - { service: web, environment: prod, target: eks-prod }
```

## `oversized-view`

**Severity:** warning

A View has more than 150 nodes, too many for a readable diagram. A Generated View is reported at its System or Service, or at `workspace.yaml` for the Landscapes; a Saved View at its id.

**Failing example**

`shop/services.yaml`:

```yaml
systems:
  big:
    name: Big
    services:
      s1: { name: S1 }
      s2: { name: S2 }
      s3: { name: S3 }
      s4: { name: S4 }
      s5: { name: S5 }
      s6: { name: S6 }
      s7: { name: S7 }
      s8: { name: S8 }
      s9: { name: S9 }
      s10: { name: S10 }
      s11: { name: S11 }
      s12: { name: S12 }
      s13: { name: S13 }
      s14: { name: S14 }
      s15: { name: S15 }
      s16: { name: S16 }
      s17: { name: S17 }
      s18: { name: S18 }
      s19: { name: S19 }
      s20: { name: S20 }
      s21: { name: S21 }
      s22: { name: S22 }
      s23: { name: S23 }
      s24: { name: S24 }
      s25: { name: S25 }
      s26: { name: S26 }
      s27: { name: S27 }
      s28: { name: S28 }
      s29: { name: S29 }
      s30: { name: S30 }
      s31: { name: S31 }
      s32: { name: S32 }
      s33: { name: S33 }
      s34: { name: S34 }
      s35: { name: S35 }
      s36: { name: S36 }
      s37: { name: S37 }
      s38: { name: S38 }
      s39: { name: S39 }
      s40: { name: S40 }
      s41: { name: S41 }
      s42: { name: S42 }
      s43: { name: S43 }
      s44: { name: S44 }
      s45: { name: S45 }
      s46: { name: S46 }
      s47: { name: S47 }
      s48: { name: S48 }
      s49: { name: S49 }
      s50: { name: S50 }
      s51: { name: S51 }
      s52: { name: S52 }
      s53: { name: S53 }
      s54: { name: S54 }
      s55: { name: S55 }
      s56: { name: S56 }
      s57: { name: S57 }
      s58: { name: S58 }
      s59: { name: S59 }
      s60: { name: S60 }
      s61: { name: S61 }
      s62: { name: S62 }
      s63: { name: S63 }
      s64: { name: S64 }
      s65: { name: S65 }
      s66: { name: S66 }
      s67: { name: S67 }
      s68: { name: S68 }
      s69: { name: S69 }
      s70: { name: S70 }
      s71: { name: S71 }
      s72: { name: S72 }
      s73: { name: S73 }
      s74: { name: S74 }
      s75: { name: S75 }
      s76: { name: S76 }
      s77: { name: S77 }
      s78: { name: S78 }
      s79: { name: S79 }
      s80: { name: S80 }
      s81: { name: S81 }
      s82: { name: S82 }
      s83: { name: S83 }
      s84: { name: S84 }
      s85: { name: S85 }
      s86: { name: S86 }
      s87: { name: S87 }
      s88: { name: S88 }
      s89: { name: S89 }
      s90: { name: S90 }
      s91: { name: S91 }
      s92: { name: S92 }
      s93: { name: S93 }
      s94: { name: S94 }
      s95: { name: S95 }
      s96: { name: S96 }
      s97: { name: S97 }
      s98: { name: S98 }
      s99: { name: S99 }
      s100: { name: S100 }
      s101: { name: S101 }
      s102: { name: S102 }
      s103: { name: S103 }
      s104: { name: S104 }
      s105: { name: S105 }
      s106: { name: S106 }
      s107: { name: S107 }
      s108: { name: S108 }
      s109: { name: S109 }
      s110: { name: S110 }
      s111: { name: S111 }
      s112: { name: S112 }
      s113: { name: S113 }
      s114: { name: S114 }
      s115: { name: S115 }
      s116: { name: S116 }
      s117: { name: S117 }
      s118: { name: S118 }
      s119: { name: S119 }
      s120: { name: S120 }
      s121: { name: S121 }
      s122: { name: S122 }
      s123: { name: S123 }
      s124: { name: S124 }
      s125: { name: S125 }
      s126: { name: S126 }
      s127: { name: S127 }
      s128: { name: S128 }
      s129: { name: S129 }
      s130: { name: S130 }
      s131: { name: S131 }
      s132: { name: S132 }
      s133: { name: S133 }
      s134: { name: S134 }
      s135: { name: S135 }
      s136: { name: S136 }
      s137: { name: S137 }
      s138: { name: S138 }
      s139: { name: S139 }
      s140: { name: S140 }
      s141: { name: S141 }
      s142: { name: S142 }
      s143: { name: S143 }
      s144: { name: S144 }
      s145: { name: S145 }
      s146: { name: S146 }
      s147: { name: S147 }
      s148: { name: S148 }
      s149: { name: S149 }
      s150: { name: S150 }
```

**Fix:** Split the System, or group top-level Services and Systems, so each Generated View stays within the limit; narrow a Saved View's selectors or raise its `level`.

**Fixed**

`shop/services.yaml`:

```yaml
systems:
  big:
    name: Big
    services:
      s1: { name: S1 }
      s2: { name: S2 }
      s3: { name: S3 }
      s4: { name: S4 }
      s5: { name: S5 }
      s6: { name: S6 }
      s7: { name: S7 }
      s8: { name: S8 }
      s9: { name: S9 }
      s10: { name: S10 }
      s11: { name: S11 }
      s12: { name: S12 }
      s13: { name: S13 }
      s14: { name: S14 }
      s15: { name: S15 }
      s16: { name: S16 }
      s17: { name: S17 }
      s18: { name: S18 }
      s19: { name: S19 }
      s20: { name: S20 }
      s21: { name: S21 }
      s22: { name: S22 }
      s23: { name: S23 }
      s24: { name: S24 }
      s25: { name: S25 }
      s26: { name: S26 }
      s27: { name: S27 }
      s28: { name: S28 }
      s29: { name: S29 }
      s30: { name: S30 }
      s31: { name: S31 }
      s32: { name: S32 }
      s33: { name: S33 }
      s34: { name: S34 }
      s35: { name: S35 }
      s36: { name: S36 }
      s37: { name: S37 }
      s38: { name: S38 }
      s39: { name: S39 }
      s40: { name: S40 }
      s41: { name: S41 }
      s42: { name: S42 }
      s43: { name: S43 }
      s44: { name: S44 }
      s45: { name: S45 }
      s46: { name: S46 }
      s47: { name: S47 }
      s48: { name: S48 }
      s49: { name: S49 }
      s50: { name: S50 }
      s51: { name: S51 }
      s52: { name: S52 }
      s53: { name: S53 }
      s54: { name: S54 }
      s55: { name: S55 }
      s56: { name: S56 }
      s57: { name: S57 }
      s58: { name: S58 }
      s59: { name: S59 }
      s60: { name: S60 }
      s61: { name: S61 }
      s62: { name: S62 }
      s63: { name: S63 }
      s64: { name: S64 }
      s65: { name: S65 }
      s66: { name: S66 }
      s67: { name: S67 }
      s68: { name: S68 }
      s69: { name: S69 }
      s70: { name: S70 }
      s71: { name: S71 }
      s72: { name: S72 }
      s73: { name: S73 }
      s74: { name: S74 }
      s75: { name: S75 }
  more:
    name: More
    services:
      s76: { name: S76 }
      s77: { name: S77 }
      s78: { name: S78 }
      s79: { name: S79 }
      s80: { name: S80 }
      s81: { name: S81 }
      s82: { name: S82 }
      s83: { name: S83 }
      s84: { name: S84 }
      s85: { name: S85 }
      s86: { name: S86 }
      s87: { name: S87 }
      s88: { name: S88 }
      s89: { name: S89 }
      s90: { name: S90 }
      s91: { name: S91 }
      s92: { name: S92 }
      s93: { name: S93 }
      s94: { name: S94 }
      s95: { name: S95 }
      s96: { name: S96 }
      s97: { name: S97 }
      s98: { name: S98 }
      s99: { name: S99 }
      s100: { name: S100 }
      s101: { name: S101 }
      s102: { name: S102 }
      s103: { name: S103 }
      s104: { name: S104 }
      s105: { name: S105 }
      s106: { name: S106 }
      s107: { name: S107 }
      s108: { name: S108 }
      s109: { name: S109 }
      s110: { name: S110 }
      s111: { name: S111 }
      s112: { name: S112 }
      s113: { name: S113 }
      s114: { name: S114 }
      s115: { name: S115 }
      s116: { name: S116 }
      s117: { name: S117 }
      s118: { name: S118 }
      s119: { name: S119 }
      s120: { name: S120 }
      s121: { name: S121 }
      s122: { name: S122 }
      s123: { name: S123 }
      s124: { name: S124 }
      s125: { name: S125 }
      s126: { name: S126 }
      s127: { name: S127 }
      s128: { name: S128 }
      s129: { name: S129 }
      s130: { name: S130 }
      s131: { name: S131 }
      s132: { name: S132 }
      s133: { name: S133 }
      s134: { name: S134 }
      s135: { name: S135 }
      s136: { name: S136 }
      s137: { name: S137 }
      s138: { name: S138 }
      s139: { name: S139 }
      s140: { name: S140 }
      s141: { name: S141 }
      s142: { name: S142 }
      s143: { name: S143 }
      s144: { name: S144 }
      s145: { name: S145 }
      s146: { name: S146 }
      s147: { name: S147 }
      s148: { name: S148 }
      s149: { name: S149 }
      s150: { name: S150 }
```

## `duplicate-view-id`

**Severity:** error

A Saved View id repeats in a Project, across files too.

**Failing example**

`shop/more.yaml`:

```yaml
views:
  structural:
    front:
      title: Front again
      level: c2
```

**Fix:** Give one of the Views a different id.

**Fixed**

`shop/more.yaml`:

```yaml
views:
  structural:
    front-v2:
      title: Front again
      level: c2
```

## `missing-step`

**Severity:** error

A Dynamic View Step has no Relationship or derived edge between `from` and `to` (nor a `via` subscription of `to` to `from`), or the named `relationship` doesn't connect them.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: cart, to: web }
```

**Fix:** Point the Step at two Elements a Relationship connects, declare the Relationship, or name one that connects them.

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
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: web, to: cart }
```

## `ambiguous-step`

**Severity:** error

Several Relationships match a Dynamic View Step (several between the pair, or both a call and an event) and no `relationship` names one.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
    relationships:
      - id: notify
        to: mailer
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: orders, to: mailer }
```

**Fix:** Name the Relationship the Step takes with `relationship: <id>`.

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
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
    relationships:
      - id: notify
        to: mailer
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: orders, to: mailer, relationship: notify }
```

## `return-without-relationship`

**Severity:** error

A Dynamic View return Step has no Relationship the other way, from its `to` to its `from`.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: web, to: cart, return: true }
```

**Fix:** Turn the Step round, or remove `return: true` if it is a call of its own.

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
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: web, to: cart }
        - { from: cart, to: web, return: true }
```

## `return-on-async`

**Severity:** error

A Dynamic View return Step resolves to an async Relationship, which has no reply.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: orders, to: mailer, return: true }
```

**Fix:** Remove the return Step, or model the callback as a Relationship of its own and add a Step for it.

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
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      steps:
        - { from: orders, to: mailer }
```

## `ancestor-descendant-participants`

**Severity:** error

An Element and its own ancestor are both participants of a Dynamic View.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      participants: [cart]
      steps:
        - { from: web, to: cart-api }
```

**Fix:** Tell the scenario at one level: use the ancestor throughout, or its descendants throughout.

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
    components:
      cart-api:
        name: Cart API
  orders:
    name: Orders
  events:
    name: Events
    type: broker
  mailer:
    name: Mailer
    relationships:
      - to: orders
        interaction: async
        via: events
        channel: order-placed
views:
  dynamic:
    purchase:
      title: Purchase
      participants: [cart]
      steps:
        - { from: web, to: cart }
```

## `target-outside-environment`

**Severity:** error

A Saved Deployment View's `targets` entry has no Deployment in the View's `environment`, on it or on any Target inside it.

**Failing example**

`shop/views.yaml`:

```yaml
targets:
  eks-staging:
    name: EKS staging
    kind: cluster
views:
  structural:
    runtime:
      title: Runtime
      level: deployment
      environment: prod
      targets: [eks-staging]
```

**Fix:** Remove the Target from `targets`, or point the View at the Environment that runs on it.

**Fixed**

`shop/views.yaml`:

```yaml
targets:
  eks-staging:
    name: EKS staging
    kind: cluster
views:
  structural:
    runtime:
      title: Runtime
      level: deployment
      environment: prod
      targets: [eks-prod]
```

## `bad-expand`

**Severity:** error

A Saved View's `expand` or `collapse` id is not a node of the View once collapsed to its `level`, or has no children.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  search:
    name: Search
views:
  structural:
    front:
      title: Front
      level: c2
      include: [web]
      expand: [web]
```

**Fix:** Remove the id, include the Element in the View, or name an Element that has children.

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
    components:
      cart-api:
        name: Cart API
  search:
    name: Search
views:
  structural:
    front:
      title: Front
      level: c2
      include: [web, cart]
      expand: [cart]
```

## `empty-view`

**Severity:** warning

A Saved View resolves to no nodes.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  search:
    name: Search
views:
  structural:
    front:
      title: Front
      level: c2
      include: [{ tag: storefront }]
```

**Fix:** Correct the selectors so they name Elements, or remove the View.

**Fixed**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    tags: [storefront]
views:
  structural:
    front:
      title: Front
      level: c2
      include: [{ tag: storefront }]
```

## `unresolved-path`

**Severity:** warning

A Saved View's path selector, or path Lens, finds no path between its two Elements.

**Failing example**

`shop/services.yaml`:

```yaml
services:
  web:
    name: Web
    relationships:
      - to: cart
  cart:
    name: Cart
    components:
      cart-api:
        name: Cart API
  search:
    name: Search
views:
  structural:
    front:
      title: Front
      level: c2
      include: [{ from: web, to: search }]
```

**Fix:** Check the Relationships between the two Elements, or raise `paths`; remove the selector if the path is gone for good.

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
    components:
      cart-api:
        name: Cart API
  search:
    name: Search
views:
  structural:
    front:
      title: Front
      level: c2
      include: [{ from: web, to: cart }]
```

## `invalid-adr-frontmatter`

**Severity:** error

An ADR has no frontmatter, frontmatter that isn't valid YAML, or a field that is unknown, missing (`status`, `date`) or invalid, such as a `status` outside proposed, accepted, rejected, deprecated and superseded.

**Failing example**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: approved
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

**Fix:** Start the file with `---`, `status` and `date` (YYYY-MM-DD), then `---`; use only the MADR fields and the `elements`, `views` and `supersedes` links.

**Fixed**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

## `missing-adr-title`

**Severity:** error

An ADR's body has no `# ` heading to take its title from.

**Failing example**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

We publish domain events on Kafka.
````

**Fix:** Start the body with a `# ` heading naming the decision.

**Fixed**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

## `bad-adr-filename`

**Severity:** error

A file in a Project's `adr/` folder isn't named `NNNN-slug.md` (and isn't `template.md`).

**Failing example**

`shop/adr/use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

**Fix:** Rename it to the next free four-digit number and a lowercase slug, such as `0002-use-kafka.md`.

**Fixed**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

`shop/adr/use-kafka.md`: removed.

## `duplicate-adr-number`

**Severity:** error

Two ADRs in a Project share a number, as when two pull requests each take the next free one.

**Failing example**

`shop/adr/0001-use-redis.md`:

````markdown
---
status: proposed
date: 2026-03-02
---

# Use Redis for carts

We publish domain events on Kafka.
````

**Fix:** Renumber the later ADR to the next free number, and update any `supersedes` that meant it.

**Fixed**

`shop/adr/0002-use-redis.md`:

````markdown
---
status: proposed
date: 2026-03-02
---

# Use Redis for carts

We publish domain events on Kafka.
````

`shop/adr/0001-use-redis.md`: removed.

## `unknown-adr-link`

**Severity:** error

An ADR's `elements` names no Element or Deployment Target, its `views` no Saved View, or its `supersedes` no ADR.

**Failing example**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
elements: [wbe]
---

# Use Kafka for events

We publish domain events on Kafka.
````

**Fix:** Use an id declared in the ADR's Project, or `project:id` (`project:NNNN` for an ADR) for one in another Project.

**Fixed**

`shop/adr/0001-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
elements: [web]
---

# Use Kafka for events

We publish domain events on Kafka.
````

## `hand-written-superseded`

**Severity:** error

An ADR's `status` is written as `superseded`; that status is derived once an accepted ADR lists it in `supersedes`.

**Failing example**

`shop/adr/0001-use-rabbitmq.md`:

````markdown
---
status: superseded
date: 2025-01-10
---

# Use RabbitMQ

We publish domain events on Kafka.
````

`shop/adr/0002-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````

**Fix:** Give the old ADR back the status it had (usually accepted), and declare `supersedes` on the new ADR instead.

**Fixed**

`shop/adr/0001-use-rabbitmq.md`:

````markdown
---
status: accepted
date: 2025-01-10
---

# Use RabbitMQ

We publish domain events on Kafka.
````

`shop/adr/0002-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
supersedes: ["0001"]
---

# Use Kafka for events

We publish domain events on Kafka.
````

## `supersedes-cycle`

**Severity:** error

ADRs supersede each other in a cycle, directly or through others. Reported once, at the cycle's last file.

**Failing example**

`shop/adr/0001-use-rabbitmq.md`:

````markdown
---
status: accepted
date: 2025-01-10
supersedes: ["0002"]
---

# Use RabbitMQ

We publish domain events on Kafka.
````

**Fix:** Remove the `supersedes` entry that points back to a newer ADR.

**Fixed**

`shop/adr/0001-use-rabbitmq.md`:

````markdown
---
status: accepted
date: 2025-01-10
---

# Use RabbitMQ

We publish domain events on Kafka.
````

## `superseded-twice`

**Severity:** warning

An ADR is superseded by more than one accepted ADR. Reported at the last of them.

**Failing example**

`shop/adr/0003-use-nats.md`:

````markdown
---
status: accepted
date: 2026-04-01
supersedes: ["0001"]
---

# Use NATS for events

We publish domain events on Kafka.
````

**Fix:** Keep `supersedes` on the one ADR that replaces it; have the later one supersede that ADR instead, if it replaces it in turn.

**Fixed**

`shop/adr/0003-use-nats.md`:

````markdown
---
status: accepted
date: 2026-04-01
supersedes: ["0002"]
---

# Use NATS for events

We publish domain events on Kafka.
````

## `supersedes-unaccepted`

**Severity:** warning

An ADR supersedes one that isn't accepted or deprecated, such as a proposed or rejected ADR.

**Failing example**

`shop/adr/0002-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
supersedes: ["0001"]
---

# Use Kafka for events

We publish domain events on Kafka.
````

**Fix:** Remove the entry from `supersedes`, or point it at the accepted ADR this one replaces.

**Fixed**

`shop/adr/0002-use-kafka.md`:

````markdown
---
status: accepted
date: 2026-03-01
---

# Use Kafka for events

We publish domain events on Kafka.
````
