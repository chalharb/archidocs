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
| [`duplicate-id`](#duplicate-id) | error | An Element id is declared twice in a Project, across files too. |

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

An Element id is declared twice in a Project, across files too.

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
