---
name: archidocs-describe
description: Build the Archidocs Model from the user's own explanation of their architecture, iteratively, with no code needed. Use when the user describes how their systems fit together in prose, wants to talk through or sketch an architecture, or is documenting something whose code isn't available.
---

# Archidocs describe

Turn the user's explanation of their architecture into a Model, round by round. The user talks; you map what they said to Elements, Relationships, Deployment Targets and Deployments, play the whole draft back, and ask only what is ambiguous.

This skill writes the Model, so load `authoring` first: `get_guide("authoring")`, or `archidocs guide --skill authoring` without MCP. It holds the Model's rules and the edit loop this guide follows.

## Input

Use only what the user says. Never read code, even when it is in reach: the user is describing the architecture as they understand it, and that is what this skill records. Code is for `fill-gaps`, offered at the end.

Read the Model before the first round (`search_elements`, `list_teams`, `list_environments`), so a name the user mentions resolves to an Element that already exists instead of a duplicate.

## First round

Besides the round's own questions, ask once, in the first round only:

- **Project**: which Project this goes in. Propose one new Project, with an id and name drawn from the prose, unless an existing Project plainly fits.
- **Owner Team**: which Team owns it. Propose an existing Team if one fits; otherwise ask for the Team's name. Never make one up.

## Each round

1. **Map** the prose to the Model: Systems, Services, Components, Relationships (consumer `to` provider), Deployment Targets and Deployments. Keep every earlier answer; a round adds to the draft and corrects it, it never starts over.
2. **Play back the whole draft**, not only what changed, in two parts:
   - an **outline**: each Element on one line with its id, kind and the fields the user gave (`technology`, `type`, `external`, parent), nested as it will be in YAML; then the Deployment Targets and Deployments;
   - a **flow**: one line per path through the draft, arrows pointing from consumer to provider as Relationships do, such as `web → apigee → api → bigquery`. A provider with several consumers can be drawn with a reverse arrow on the same line: `api → bigquery ← etl`.
3. **Ask only the ambiguities**, as numbered questions, each with a proposed answer worded so "yes" accepts it. Don't ask what the user already said, and don't ask about fields they didn't mention: those stay gaps for `fill-gaps`. Keep a round to the questions that change the draft's shape, about five or fewer.

The user answers by number ("1 yes, 2 its own Service, 3 skip"), or keeps explaining. Fold both into the next round's draft.

## Mapping cues

| The user says | Map it to |
| --- | --- |
| A web app, an API, a worker | A Service, `technology` as named (`Next.js`). |
| A BFF (backend for frontend) | A Component of the web Service, or a Service of its own when it is deployed apart. Ask, proposing a Component. |
| A managed datastore (BigQuery, Cloud SQL, DynamoDB, S3) | A Service with `type: datastore` and `technology` as named. Ask whether it is `external`: propose not, when the organization owns the data in its own cloud account. |
| A broker or queue (Kafka, Pub/Sub, SQS) | A Service with `type: broker`; the Relationships through it follow authoring's `relationships` topic (`via`, `channel`). |
| A platform it runs on (Anthos, GKE, EKS, Cloud Run, a VM) | A Deployment Target with that `kind` (`kind: anthos`), and a Deployment of the Service on it once an Environment is known. |
| An ETL, a batch job, a cron job | A Service, with Relationships to what it reads and what it writes. |
| A black box | Always ask: run by a vendor, a System with `external: true`; or run inside the organization, a System with no Components, owned by the Team that runs it (asked, or left as a gap). The user's words about it go in `description`. |
| An API gateway or reverse proxy (Apigee, Kong, nginx) | A Service in the path, `technology` naming the product: `web → apigee → api`, owned by the Team that runs it. Mention the lighter option once: leave it out and write `HTTPS via Apigee` on the Relationship's `technology`. See authoring's `relationships` topic, "Gateways and proxies". |

## Never invent

- **Environments, URLs and Owners** come only from the user. A Deployment needs an Environment, so a named platform triggers one question: "Which Environments does this run in?". Until it is answered, draft the Deployment Target and leave the Deployments out.
- An Owner other than the Project's is set only when the user names the Team.
- Write what was said: `technology`, `type`, `external`, the platform's `kind`, and a `description` in the user's own words. Anything unsaid stays a gap.

## Writing

1. **Nothing is written until the user approves the first draft.** Approval covers the whole draft as played back; open questions they skipped stay out of it.
2. **First write**: follow authoring's `bootstrap` topic from step 5: `create_project` if the Project is new (`upsert_team` and `upsert_environment` first only for Teams and Environments the user named), then Systems, Services, Components (`upsert_element`), Deployment Targets (`upsert_target`), Deployments (`upsert_deployment`), then Relationships (`upsert_relationship`). Resolve refusals through the tools, as the edit loop says.
3. **Start the viewer**: after the first write, start `archidocs dev` in the background if you can, and give the user its URL. Otherwise print the command for them to run. Never wait on it.
4. **Each later round** writes its changes as soon as the user approves the round's draft, and shows the diffs.

## Cross-Project

When the prose clearly describes another Team's System ("the platform team runs Apigee for everyone"), propose it as its own Project owned by that Team, linked with `project:id` Relationships. If the user says to keep it all in one Project, do so, with `owner` set on those Elements when the Team was named.

## Finish

Finish as authoring's edit loop does: run `check`, then suggest a branch name, a PR title and a PR body listing what was written and the open gaps (fields left unsaid, Owners and Environments not given). Then offer `fill-gaps` (`get_guide("fill-gaps")`), which reads the code to propose the `technology`, `repository`, URLs and descriptions this conversation left open.

## Worked example

The user says:

> I have a next.js app that uses BFF to call an api that's running on anthos and is proxied through an apigee gateway. That API gets its data from BigQuery. The bigquery table is populated by an ETL from a black-boxed service

The Model has no Project for this yet. The first round plays back:

```text
Draft, Project `orders` (new)

Services
  web        Service              technology: Next.js
    bff      Component            (the BFF)
  apigee     Service              technology: Apigee        (API gateway)
  api        Service                                         (the API)
  bigquery   Service, datastore   technology: BigQuery
  etl        Service                                         (the ETL)
  source     System                                          (the black-boxed service)

Deployment Targets
  anthos     kind: anthos          api runs here; no Deployments until Environments are known

Flow
  web.bff → apigee → api → bigquery
  bigquery ← etl → source
```

```text
1. Project: put all of this in one new Project, `orders` ("Orders")?
2. Owner Team: which Team owns it? There is no Team in the Workspace that fits.
3. BFF: a Component of `web`, deployed with it? (Or its own Service, if it is deployed apart.)
4. Apigee: a Service in the path, `web → apigee → api`, owned by the Team that runs it?
   (The lighter option leaves it out and writes `HTTPS via Apigee` on the Relationship.)
   Who runs it: the same Team, or another (a platform Team, in its own Project)?
5. BigQuery: your own dataset in your Google Cloud project, so not `external`?
6. The black box: run by a vendor (`external: true`), or by a Team in the organization?
   What does it hold or do, in a sentence?
7. ETL: does it pull from the black box (`etl → source`), as drawn?
8. Anthos: which Environments does the API run in (for example `dev` and `prod`)?
```

Nothing is written yet. Say the user answers "1 yes, 2 checkout-team, 3 yes, 4 yes, platform-team runs it, 5 yes, 6 a vendor's CRM, 7 yes, 8 prod only". The second round plays back the full draft again: `apigee` proposed as a Service in a `platform` Project owned by `platform-team`, as Cross-Project above proposes, `source` as an External System described "A vendor's CRM", and a Deployment of `api` in `prod` on `anthos` with no `url`. Its only question is whether the `platform` Project is right, or to keep `apigee` in `orders` owned by `platform-team`. Once the user approves, write it, start `archidocs dev`, and carry on with whatever they explain next.
