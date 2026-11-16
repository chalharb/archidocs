# Archidocs

Archidocs turns a repository of [FINOS CALM](https://calm.finos.org) architecture files into a
read-only, linkable static site. It reads your files as they are and never writes to them.

> Status: foundation only. `init` and `build` produce a minimal site; `validate` and `dev` are
> placeholders.

## Quick start

```bash
npm install --save-dev archidocs
npx archidocs init     # writes archidocs.config.ts and architectures/example.json
npx archidocs build    # writes the site to archidocs-site/
```

Serve `archidocs-site/` with any static host, at the root or under a sub-path.

## Views

A view is declared in the CALM file under `metadata.views`:

```json
{ "metadata": { "views": [{ "id": "context", "title": "System context", "group": "Overview" }] } }
```

## Config

`archidocs.config.ts` (or `archidocs.config.json` with `"$schema": "archidocs/config.schema.json"`):

```ts
import { defineConfig } from "archidocs";

export default defineConfig({
  name: "big-bank",
  model: "architectures/*.json",
  site: { base: "/" },
});
```

Only `name` and `model` are required. Unknown keys are rejected.

## Contributing

See [AGENTS.md](AGENTS.md).
