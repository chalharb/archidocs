# Run without a global install

Archidocs must work in a repo where it is not installed globally. Three setups are supported: a global install, on demand through `npx`, and a local `dependencies`/`devDependencies` entry. `archidocs init` never installs a package or edits `package.json`; it writes Workspace files only.

Every command `init` prints or writes (the MCP server command, and the `check` and `guide` commands in the skill stub and the `## Architecture model` pointer) uses the form that matches how the repo runs archidocs, chosen in this order:

1. **`package.json` at the repo root lists `archidocs`**: `npx archidocs`. npx resolves the local copy (npm and pnpm `node_modules/.bin` alike), and `package.json` already pins the version.
2. **`init` ran through a package runner** (`npx`, `pnpm dlx`; detected by `npm_config_user_agent`): `npx -y archidocs@<the version that ran init>`. `-y` is required: without it npx asks "Ok to proceed?" before downloading, which hangs an MCP server on stdio and an agent's non-interactive shell. Pinning keeps the server, skill and schemas on one version and avoids a registry lookup each time the server starts; upgrading means re-running `init`.
3. **Otherwise** (a global bin): bare `archidocs`.

Non-global forms always use `npx`, even for pnpm users: npx ships with Node, which archidocs already requires, so there is one form to document and test.

The full guide shipped in the package (`guide/SKILL.md`) cannot know the repo, so it keeps `archidocs <command>` and tells agents to run it the way the repo's AGENTS.md says. Re-running `init` replaces its `## Architecture model` section in place, so the pointer follows a change of setup.

The GitHub Action is unaffected: it installs its own copy inside the runner.
