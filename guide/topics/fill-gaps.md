# Fill gaps

Interview the user about what the Model leaves empty, one Element at a time. You do the legwork before every question: dig the value out of the code the Workspace describes and put it forward with its source, so the user mostly confirms or corrects. Each confirmed answer is written straight away, so stopping halfway still leaves real progress.

## Steps

1. **Check.** Run `check` (or `archidocs check`) and fix its errors first: the gap scan reads the Bundle, which a failing Workspace doesn't build.
2. **Gap scan.** Build the Bundle with `archidocs build --bundle-only --out <tmp>` and run the query under Gap query over `<tmp>/workspace.bundle.json`. It prints every gap, grouped by Project and Owner Team. Over MCP alone, walk `list_owned` for each Team from `list_teams` and `get_element` each item, applying the same tests. Show the scan and agree with the user which Projects or Teams to work through.
3. **Codebases.** For each Project, find the checkout behind each Service: an existing `repository`, a `links` entry, the Workspace's own repo, or a path the user names. Ask once for any you can't find.
4. **Interview**, one round per Element, Services that others call first, then the rest of the Services, then Components. Within a round, ask that Element's gaps in this order: `repository`, API docs, `technology` and version, `description`, Owner, then its Relationships and Deployments. For each round:
   - **Legwork first.** Look where the table under Evidence points before you ask anything. Finding facts is your job; deciding them is the user's.
   - **Ask** the round as numbered questions, each with your proposed value and its source, worded so "yes" accepts it: "`Publishing.csproj:4` targets `Microsoft.AspNetCore.App` 8.0. Set `technology: ASP.NET Core 8`?" With no evidence, say where you looked and ask an open question.
   - **Push** on vague answers until a value fits the field: "it's the payments thing" is not a `description`; ask what it does for whom. Two sources that disagree (two Dockerfiles, two remotes) go to the user as a choice.
   - **Accept** `skip` and `unknown`: record the gap as open and move on.
   - **Write** the round's confirmed answers at once (see Writing), then run `check`. The round is done when every gap of the Element is written, skipped or unknown, and `check` passes.
5. **Metadata.** Once per Project, ask whether its Teams record facts the Model has no field for (`tier`, `on-call`, `pci-scope`). If they do, fill them Element by Element in the same way.
6. **Decisions.** An answer that is a decision rather than a fact ("it's External because a vendor runs it", "we deploy only to prod on purpose") goes to the user as a proposed ADR, following the `propose-adr` topic.
7. **Summary.** End with two lists: what was filled, each with its source, and what is still open, grouped by Owner Team so each list can go to its Team. Then the edit loop's finish: `check`, a branch name, a PR title, and a PR body that carries both lists.

## Writing

Write with `upsert_element`, `upsert_relationship` and `upsert_deployment`, passing only the fields you fill; fields not given are left as they are. A list field (`links`, `endpoints`) is set whole, so pass its existing entries with the new one, and `metadata` likewise with its existing keys. Without an MCP server, edit the YAML with your file tools.

Sources belong in the summary and the PR body, never in the Model: no evidence fields, no `inferred` tags, no source comments in the YAML.

## What counts as a gap

| Where | Field | A gap when |
| --- | --- | --- |
| Every Element | `description` | empty |
| Service, Component | `technology` | empty |
| Service you run (`type: app`, not `external`) | `repository` | empty |
| Service you run | Deployments | it has none in any Environment |
| Service you run that another Element calls | API docs | no `links` label and no Deployment `endpoints` name mentions api, openapi or swagger |
| Relationship | `description`, `technology` | empty |
| async Relationship | `channel` | empty |
| Deployment of a Service you run | `url` | empty |

Fields such as `tags`, `links`, `metadata` and `instances` are left out on purpose: they are optional by design, and an empty one says nothing is missing. An Owner is never a gap in the scan, because every Element inherits the Project's; ask about it only when evidence names another Team (a CODEOWNERS line, a team label in a Helm chart).

## Evidence

| Gap | Where to look | What to write |
| --- | --- | --- |
| `repository` | `git remote get-url origin` in the Service's checkout; the repo's URL plus `/tree/<branch>/<path>` when a monorepo holds several Services | the HTTPS URL, with `git@host:org/repo.git` rewritten to `https://host/org/repo` |
| `technology` | `package.json` with its lockfile, `*.csproj`, `pom.xml` / `build.gradle`, `go.mod`, `pyproject.toml`, `Gemfile`, the Dockerfile's `FROM` | the language or framework and its major version as pinned, such as `Node.js 22`, `Spring Boot 3.3`, `.NET 8`; for a datastore, the engine and version from compose, Helm values or IaC (`PostgreSQL 16`) |
| API docs | an OpenAPI or Swagger file (`openapi.yaml`, `swagger.json`), a springdoc / Swashbuckle / FastAPI setup, a route serving `/swagger`, `/docs` or `/openapi.json` | a served spec: a Deployment `endpoints` entry `{name: openapi, url}` per Environment; a spec file in the repo: an Element `links` entry `{label: OpenAPI, url}` pointing at it |
| Deployments, `url` | Terraform, Bicep, Pulumi, Helm values, Kubernetes ingress hosts, CI deploy jobs, per-Environment config files | Targets and Deployments, following the `deployments` topic |
| Relationship `technology`, `channel` | HTTP and gRPC clients, database drivers, broker producers and consumers, their topic and queue names | `JSON/HTTPS`, `gRPC`, `SQL`; the topic or queue as `channel` |
| `description` | a README's first paragraph, the OpenAPI `info.description` | a sentence or two in the user's words; offer the README text as a draft for them to confirm |

Versions finer than `technology` carries (a pinned patch version, a runtime image tag) go in `metadata`, keyed by what they are: `node: 22.11.0`. Other facts without a field, such as an API style or a spec version, go there too.

## Gap query

Needs `jq`. Prints Markdown: a `##` heading per Project, a `###` heading per Owner Team, and one line per Element, Relationship or Deployment naming its empty fields.

```jq
. as $b
| (reduce $b.elements[] as $e ({}; .[$e.id] = $e)) as $by
| def app: .kind == "service" and .external == false and .type == "app";
  def runs($id): [$b.deployments[] | select(.service == $id)];
  def called($id): [$b.relationships[] | select(.to == $id and $by[.from].kind != "person")] | length > 0;
  def gap($p; $o; $item; $m): select($m | length > 0) | {project: $p, owner: $o, item: $item, missing: $m};
  [ ( $b.elements[] as $e
      | gap($e.id | split(":")[0]; $e.owner; "\($e.kind) \($e.id)";
          [ if $e.description == null then "description" else empty end,
            if ($e.kind == "service" or $e.kind == "component") and $e.technology == null then "technology" else empty end,
            if ($e | app) and $e.repository == null then "repository" else empty end,
            if $e.kind == "service" and $e.external == false and (runs($e.id) | length) == 0 then "deployments" else empty end,
            if ($e | app) and called($e.id)
               and ([$e.links[].label, runs($e.id)[].endpoints[].name] | map(select(test("api|openapi|swagger"; "i"))) | length) == 0
            then "api-docs" else empty end ]) ),
    ( $b.relationships[] as $r
      | gap($r.from | split(":")[0]; $by[$r.from].owner; "relationship \($r.from) -> \($r.to)";
          [ if $r.description == null then "description" else empty end,
            if $r.technology == null then "technology" else empty end,
            if $r.interaction == "async" and $r.channel == null then "channel" else empty end ]) ),
    ( $b.deployments[] as $d
      | select($by[$d.service] | app)
      | gap($d.service | split(":")[0]; $d.owner; "deployment \($d.service) in \($d.environment) on \($d.target)";
          [ if $d.url == null then "url" else empty end ]) ) ]
| group_by(.project)[]
| "## \(.[0].project)", (group_by(.owner)[] | "### \(.[0].owner)", (.[] | "- \(.item): \(.missing | join(", "))"))
```

Save it as `gaps.jq` outside the Workspace and run `jq -r -f gaps.jq <tmp>/workspace.bundle.json`.
