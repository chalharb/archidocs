# How existing tools model architecture

Type: research
Status: resolved
Blocked by: –
Map: [Archidocs v1](../map.md)

## Question

How do LikeC4, Structurizr, Backstage's software catalog, IcePanel and Ilograph model Elements (including nesting and C1–C3 levels), Relationships, Deployments and Deployment Targets, Dynamic Views and View definitions (include/exclude rules), and ownership? What do they do well, and where do they fail the six persona questions? And what evidence is there on how reliably LLMs author YAML vs TypeScript vs custom grammars?

## Answer

**None of the five tools answers all six persona questions.** Only LikeC4 and Structurizr have a full model: a logical model, deployments built with `instanceOf`, Views defined by queries, and Dynamic Views. Backstage, IcePanel and Ilograph each lack deployments, query-based Views, or a single place where Relationships are stored.

Four gaps recur:
- **Ownership** is first-class only in Backstage (a required `spec.owner`) and IcePanel (teams, paid plans).
- **URL per Environment** is typed only in Structurizr (`url` and `healthCheck` on a deployed instance).
- **Upstream/Downstream:** no tool has a transitive query.
- **Across repos:** only Backstage really supports one model per repo; LikeC4's cross-project `import` needs every project loaded together.

**How reliably LLMs write each format:** the evidence is thin, with no study comparing formats for architecture models. Frontier models produce valid YAML and JSON almost always (StructEval). Custom grammars need the grammar in the prompt. Type checking catches most TypeScript errors. The main failure in LLM-written architecture is invented Relationships, not bad syntax (R2ABench).

**Recommendations to weigh in later tickets** (not decided here):
- *Domain model:* fixed C1–C3 Element kinds; store Relationships as declared and derive higher-level edges when queried; stable global ids; one required Owner; a typed `url` on Deployment; Dynamic View steps must point to existing Relationships; default Views per level; a transitive Upstream/Downstream query.
- *Authoring format:* YAML 1.2 checked against a JSON Schema generated from the TypeScript types, with the same schema used for MCP tool inputs. Avoid TypeScript authoring, because it means running code from about 50 repos. Put the validation effort into checking references between Elements, with did-you-mean suggestions.

Findings: [research/01-prior-art-modelling.md](../research/01-prior-art-modelling.md)
