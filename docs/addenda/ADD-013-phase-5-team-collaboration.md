# ADD-013: Phase 5 requirements: team collaboration

| Field | Value |
|---|---|
| **Status** | Proposed |
| **Type** | Addition |
| **Proposed** | 2026-11-10 by Claude (Product Analyst agent) |
| **Decided** | |
| **Baseline** | PRD v1.7 |
| **Affected IDs** | TEAM-01..10, SEC-15..16, TEST-11, E2E-15..17, VR-17..18, BENCH-10, PH5-EXIT (all new); PH5-01..05, SEC-01, SEC-07, SEC-08, SEC-09, SEC-10, SEC-13, RELI-11, GIT-08 (ADD-012, Proposed) |
| **PRD sections** | §1, §5, §6, §7, §11, §13 |

## Context

PRD §11 outlines Phase 5 in one line: "Authentication, RBAC, workspace permissions, team sharing, and multi-tenant capabilities." Checklist 09 requires each later phase to be broken into detailed requirements by an addendum before work starts. This addendum does that for Phase 5.

What exists today:

- The app is local-first and single-user. It binds to loopback (SEC-01), and SEC-10 forbids exposing an unauthenticated instance as a public service.
- Hosted read-only mode (SEC-13, ADD-010) is the one exception: anyone who can reach the deployment can read everything, and the README recommends Vercel Deployment Protection, which the app doesn't enforce.
- Drafts (RELI-11) and editor state belong to the single local user. Writes are limited to `.layout.yaml` files and drafts, plus whole-file restores and commits if ADD-012 (Phase 4, Proposed) is accepted.
- ADD-012 leaves "committing or pushing from a hosted deployment" to Phase 5, because it needs authentication.

§13 lists "Authentication and RBAC" and "Hosted multi-tenant deployments" as outside the MVP. This addendum moves them into scope for Phase 5, within the limits below. "Real-time collaboration" stays out of scope.

The design keeps the principles of Phases 0–4: YAML is canonical, invalid data never overwrites valid data, and all filesystem access goes through server-side repository services restricted to workspace roots. There is no schema or model change. Local single-user use keeps working exactly as today, without signing in.

Where this addendum refers to GIT-* requirements, those clauses apply only if ADD-012 is accepted.

**Open questions** are listed at the end, each with the default this addendum assumes. Accepting the addendum accepts those defaults unless the decision says otherwise.

## Change

### Deployment modes and authentication

**TEAM-01** (new): Deployment modes. The server runs in one of three modes, chosen by configuration (`ARCHIDOC_MODE`): — P1, Phase 5

- **local** (default): today's behaviour. No sign-in, bound to loopback (SEC-01), one implicit user with every permission.
- **team**: sign-in required (TEAM-02). The server may bind to any interface. It runs as a long-running Node server (the repository provides a container image) with writable workspace checkouts.
- **hosted read-only** (SEC-13): unchanged, with optional sign-in (SEC-13 amended below).
- The server refuses to start when it would listen on a non-loopback address in local mode, or in team mode without a complete authentication configuration. The error names the missing setting.

**TEAM-02** (new): Sign-in with OpenID Connect. — P1, Phase 5

- In team mode, users sign in through one configured OpenID Connect provider (issuer URL, client ID, client secret), using the authorization code flow with PKCE, `state` and `nonce`. Any standards-compliant provider works (for example Microsoft Entra ID, Google Workspace, Okta, Keycloak, or GitHub through an OIDC bridge).
- A user is identified by issuer and subject. Email, display name and the configured groups claim are read from the ID token for display and for access rules (TEAM-05).
- Access is denied by default: a signed-in user with no role on any workspace sees a "No access" page that names their identity and tells them to ask an administrator.
- The app has no local passwords, sign-up or password reset.
- Every page and API route except sign-in, the OIDC callback and the health check requires a session. An unauthenticated page request redirects to sign-in and returns to the requested URL afterwards. An unauthenticated API request gets `401`.

**TEAM-03** (new): Sessions. — P1, Phase 5

- The session is an encrypted, signed cookie (`HttpOnly`, `Secure`, `SameSite=Lax`) whose key comes from `ARCHIDOC_SESSION_SECRET` (at least 32 bytes; the server refuses to start in team mode without it). The server needs no database for sessions.
- Sessions expire after 12 hours by default (configurable). Signing out clears the session and offers a link to the provider's sign-out.
- Provider tokens are never sent to browser JavaScript, written to logs, or stored in workspace files.
- Roles are re-evaluated on every request against the current access configuration (TEAM-06), so removing a user's access takes effect on their next request without waiting for the session to expire.

### Roles and workspace permissions

**TEAM-04** (new): Roles. There are three fixed roles per workspace. Each includes the permissions of the ones above it: — P1, Phase 5

| Role | Can |
|---|---|
| `viewer` | View diagrams, documents, decisions, flows and entities; search; export PNG/SVG; view history, revisions and diffs (GIT-02..05); copy share links |
| `editor` | Also save layouts and use drafts (LAYOUT-08, RELI-11); restore files (GIT-06); create and switch branches, commit and push (GIT-07..09) |
| `admin` | Also view the workspace's effective access and its audit log (TEAM-06, TEAM-09) |

- Permissions are enforced by the server on every request, before any repository access (SEC-15). The UI hides or disables actions the user can't perform and gives the reason (for example "Edit layout" disabled with "You have view access to this workspace"). A request for an action the role doesn't allow gets `403`.
- In local mode the single user has `admin` on every workspace.

**TEAM-05** (new): Workspace permissions. — P1, Phase 5

- Roles are granted per workspace root, to users (by email or by issuer and subject) or to groups (values of the configured groups claim). A deployment-wide rule may grant a role on every workspace.
- When several rules match, the highest role wins. No rule grants less than another, so there are no deny rules.
- A user sees only the workspaces they have a role on. Every other workspace, and every resource, file, event, search result or link inside it, behaves as if it didn't exist: `404`, never `403`, so its existence isn't revealed.
- Change events (RELI-01..05) are delivered only for workspaces the user can view.

**TEAM-06** (new): Access configuration. — P1, Phase 5

- Users, groups, role bindings (and tenants, TEAM-10) are defined in a server-side access file (`ARCHIDOC_ACCESS_FILE`, default `archidoc.access.yaml`) that must be outside every workspace root. It is validated against its own versioned schema (`apiVersion: archidoc.access/v1`). It holds no secrets: the client secret and session secret come only from environment variables (SEC-08).
- An invalid access file never replaces a valid one: the server keeps the last valid configuration and reports the diagnostics to admins and in the server log. When there is no valid configuration at startup, team mode refuses to start.
- The file is reloaded when it changes, without restarting.
- Admins can view the effective access for their workspaces in the app (who has which role, and through which rule). Access is changed by editing the file, not in the app.

### Team sharing

**TEAM-07** (new): Share links. — P1, Phase 5

- Every diagram, document, decision, flow and entity page has a stable URL that includes the view state needed to reproduce what the user sees: selected entity, flow overlay (DIAG-15), revision (GIT-03), and the open document heading. A **Copy link** action copies it.
- Opening a share link requires sign-in and a role on the workspace. Without one, the recipient gets the `404` of TEAM-05, not the content.
- Share links grant no access by themselves. There are no anonymous or public links outside hosted read-only mode.

**TEAM-08** (new): Per-user state and concurrent editing. — P1, Phase 5

- Drafts (RELI-11), unsaved editor state and preferences belong to the signed-in user. No user sees, restores or discards another user's draft.
- When another user saves a layout or file that a user has open, the user is told who saved it and when. The existing conflict detection and resolution (RELI-06..08, RELI-12) applies unchanged: a save against an outdated revision is refused, and the user's changes are kept as a recoverable draft.
- There is no real-time co-editing, presence, cursors or comments (§13, "Real-time collaboration").

**TEAM-09** (new): Attribution and audit log. — P1, Phase 5

- Every state-changing operation (layout save, draft save or discard, restore, branch, commit, push) and every sign-in and denied request is recorded with time, user, workspace, file or resource, operation and outcome. Records are appended as JSON lines to an audit log in the app's state directory, outside every workspace root. Records contain no file contents, tokens or secrets.
- Workspace admins can view and filter their workspace's audit records in the app. Deployment-wide records (sign-ins, denials) are visible to deployment admins only.
- In team mode, commits made from the app (GIT-08) use the signed-in user's name and email as author and the server's configured Git identity as committer (GIT-08 amended below).

### Multi-tenancy

**TEAM-10** (new): Tenants. One team-mode deployment can serve several isolated tenants (for example separate organizations or business units). — P2, Phase 5

- A tenant has its own workspace roots, role bindings, audit log and admins, defined in the access file. Workspace roots of different tenants must not overlap or nest. The server refuses a configuration where they do.
- Tenants share the deployment's identity provider. A user may belong to several tenants and chooses between them. Tenant URLs carry a prefix (`/t/<tenant>/…`).
- Nothing crosses tenants: workspaces, resources, search results, change events, caches, drafts, audit records and error messages of one tenant are never visible to users of another (SEC-16).
- Creating tenants in the app, self-service sign-up, billing, quotas and a per-tenant identity provider are out of scope.

### Security

**SEC-15** (new): Authorization is enforced on the server. — P1, Phase 5

- Authentication and authorization are checked in one server-side layer that every page, server action and API route goes through, before any repository service is called (SEC-09). Repository services receive the caller's identity and workspace and refuse requests without them in team mode. A route that skips the check fails a test (TEST-11).
- State-changing requests need a valid session and still need the request-origin checks of SEC-07.
- The OIDC flow validates issuer, audience, signature, expiry, `nonce` and `state`, and only redirects to same-origin return URLs after sign-in.
- Sign-in attempts and OIDC callbacks are rate-limited per client address.
- Session, identity and access errors are logged without tokens or cookies.

**SEC-16** (new): Tenant isolation. Every repository call, cache entry, event subscription, draft and audit record is keyed by tenant. Tests prove that a user of one tenant can't read, list, search, subscribe to or infer the existence of another tenant's data through any route. — P2, Phase 5

**SEC-10** (amended):

> **Before (SEC-10, as amended by ADD-010):** An unauthenticated instance must not be exposed as a public service, except in hosted read-only mode (SEC-13), which can't modify anything.

> **After (SEC-10):** An instance may be reachable beyond loopback only in team mode with authentication (TEAM-01..03), or in hosted read-only mode (SEC-13). An unauthenticated instance that can modify files must never be exposed.

**SEC-01** (clarified): Loopback binding remains the default and is required in local mode. Team mode may bind to other interfaces (TEAM-01).

**SEC-13** (amended): Hosted read-only mode may optionally require sign-in (TEAM-02, TEAM-03) and apply `viewer` access per workspace (TEAM-05). Without that configuration it behaves as today: anyone who can reach it can read everything. Writes stay refused in hosted read-only mode whatever the user's role.

**SEC-08** (clarified): The access file (TEAM-06) and the audit log (TEAM-09) are app configuration and state, not architecture YAML, and must be outside every workspace root. Neither contains secrets.

### Reliability

**RELI-11** (amended): In team mode, drafts are stored per user (TEAM-08) in the app's state directory, keyed by tenant, user and file. Local mode is unchanged.

**GIT-08** (amended, if ADD-012 is accepted): In team mode, the author of a commit from the app is the signed-in user, and the committer is the Git identity configured for the server. If no server identity is configured, commits are refused with instructions. Pushes (GIT-09) use the server's credentials and are allowed for `editor` and `admin` only. Local mode is unchanged.

### Testing and performance

**TEST-11** (new): Phase 5 test categories:

- Mode selection and startup refusals: non-loopback without authentication, missing secrets, invalid or missing access file.
- OIDC: authorization code flow with PKCE, invalid issuer, audience, signature, `nonce`, `state` and expired tokens, open-redirect attempts on the return URL. Tests use a mock OIDC provider, never a real one.
- Sessions: expiry, tampered or foreign cookies, sign-out, access removed while a session is active.
- Authorization: a role-by-operation matrix test over every API route and server action, generated from the route list so a new unprotected route fails it; `404` versus `403`; change events filtered per workspace.
- Access file: schema validation, last valid configuration kept, reload, overlapping tenant roots.
- Per-user drafts, concurrent-save notifications and audit records (no secrets or contents in them).
- Tenant isolation (SEC-16) across every route, search, events and caches.

New Playwright workflows:

- **E2E-15:** Sign in as a viewer, open a diagram, see **Edit layout** disabled with the reason, and get `403` from a direct layout save request.
- **E2E-16:** Two editors open the same diagram; one saves a layout; the other sees who saved it, and their own conflicting save is refused and kept as a draft.
- **E2E-17:** A user without access to a workspace doesn't see it in the workspace list, and opening a share link to one of its diagrams shows "not found" after sign-in.

New visual regression snapshots: **VR-17** sign-in and "No access" pages, **VR-18** effective access and audit log views.

**BENCH-10** (new): With 50 workspaces, 1,000 role bindings and 20 tenants, authentication and authorization add less than 10 ms at p95 to a model API request on the reference machine (PERF-05).

### Phase 5 exit criterion

**PH5-EXIT** (new): A team can run one shared Archidoc server where members sign in with their organization's identity provider, see only the workspaces they are granted, view or edit according to their role, share links with each other and see who changed what, while tenants stay isolated and local single-user use keeps working without signing in.

The outline items in checklist 09 map to these requirements: PH5-01 → TEAM-01, TEAM-02, TEAM-03, SEC-15; PH5-02 → TEAM-04; PH5-03 → TEAM-05, TEAM-06; PH5-04 → TEAM-07, TEAM-08, TEAM-09; PH5-05 → TEAM-10, SEC-16.

### Out of scope for Phase 5

- Real-time co-editing, presence, cursors, comments and notifications outside the app (§13).
- Local passwords, self-service sign-up, invitations by email, SCIM or other user provisioning, and more than one identity provider per deployment.
- Editing access rules in the app (they live in the access file, TEAM-06), custom roles and per-resource or per-diagram permissions.
- Tenant creation in the app, billing and quotas.
- API tokens or service accounts for machines. The validation CLI (GIT-10) runs against files, not against the server.
- Writes from a Vercel deployment (SEC-13 still refuses them).
- Visual entity and relationship creation (§13).

## Open questions

Each has the default this addendum assumes.

1. **Identity.** Default: one generic OpenID Connect provider. Alternatives: GitHub sign-in only (simpler, but ties identity to GitHub), or trusting identity headers from a reverse proxy such as oauth2-proxy (no OIDC code in the app, but secure only if the proxy is the only way in).
2. **Where access rules live.** Default: a versioned YAML access file outside the workspaces, read-only in the app, with no database. The alternative is a database with in-app user and role management, which is friendlier for admins but adds a stateful dependency to a file-based app.
3. **Roles.** Default: three fixed roles per workspace. The alternative is custom roles or per-diagram permissions, which are more flexible but much harder to test and explain.
4. **Multi-tenancy.** Default: included as P2 (TEAM-10, SEC-16), with tenants defined in the access file and sharing one identity provider. The alternative is to defer multi-tenancy to a later addendum and exit Phase 5 with one team per deployment.
5. **Hosting for team mode.** Default: a long-running Node server with a container image and writable workspace checkouts. Vercel keeps hosted read-only mode only, because its filesystem can't persist writes.
6. **Commit attribution** (only if ADD-012 is accepted). Default: signed-in user as author, server identity as committer, server credentials for pushes. The alternative is to disable commits and pushes in team mode and leave them to users' own clones.
7. **Priorities.** Default: everything P1 except multi-tenancy (TEAM-10, SEC-16), which is P2. Phase 5 can exit without a P2 item only if a later addendum defers it.

## Consequences

- **Schema and model:** no change to `archdocs/v1`. The access file has its own schema (`archidoc.access/v1`) and is not part of any workspace.
- **Architecture:** a new authentication and authorization layer in front of every route; repository services take a caller context (tenant, user, workspace). The app gets its first outbound network calls (to the identity provider) and its first per-user state.
- **Local use:** unchanged. Local mode needs no configuration and no sign-in.
- **Hosted read-only mode:** unchanged unless sign-in is configured.
- **Dependencies:** builds on ADD-012 for the Git clauses (GIT-08 amendment, history permissions). If ADD-012 is rejected or changed, those clauses are dropped or adjusted on acceptance.
- **Risks:** a missed authorization check is the main risk, so SEC-15 requires a single enforcement layer and TEST-11 a generated route matrix. Cross-tenant leaks through caches and change events are the second, covered by SEC-16. Misconfigured OIDC providers are a likely support issue, so startup errors must name the missing or wrong setting.

## Checklist updates

To do on acceptance (Product Analyst, in a follow-up PR):

- [ ] In `09-later-phases.md`, add TEAM-01..10 and PH5-EXIT "(added by ADD-013)", and point PH5-01..05 at the new items
- [ ] Add SEC-15..16 to `05-security.md`, and note "(amended by ADD-013)" on SEC-01, SEC-08, SEC-10 and SEC-13
- [ ] Note "(amended by ADD-013)" on RELI-11 in `04-reliability.md`, and on GIT-08 if ADD-012 is accepted
- [ ] Add TEST-11, E2E-15..17 and VR-17..18 to `06-testing.md`, and BENCH-10 to `07-performance.md`
- [ ] Record the new IDs in the allocated-IDs table in `addenda/README.md` as allocated (they are reserved while this is Proposed)
- [ ] Run `scripts/prd-progress.sh --write`
