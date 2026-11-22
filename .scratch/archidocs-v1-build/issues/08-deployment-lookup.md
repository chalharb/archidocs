# 08: Deployment and URL lookup

Status: ready-for-agent
Blocked by: 05, 06
Spec: [Archidocs v1](../../archidocs-v1/spec.md)

## What to build

The Solutions Architect and QA Tester questions can be answered through MCP.

- `get_deployments(service, environment?)`: per Deployment, the Environment, the full Deployment Target chain, `url` and `endpoints`.
- `search_elements` also matches URLs and hosts, returning the Service.
- `get_element` gains Deployments with their URLs.

## Acceptance criteria

- [ ] Acceptance tests answer "where is a Service deployed?" and "what is a Service's URL in staging?" on the fixture.
- [ ] Searching for a URL or host finds its Service.
