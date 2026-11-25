# 19: Upgrading and versioning

Status: done
Blocked by: None (can start immediately)
Spec: [Docs rewrite proposal](../spec.md)

## What to build

A `help/upgrading` page that says what a version number promises and how to upgrade. The Changelog is the only version page today. If ticket 05 hasn't created the Help group yet, create it here.

The page states the policy below, one sentence per promise, then:

- how to upgrade the CLI and the Action or GitLab template together;
- what to re-run afterwards (`archidocs init`, to refresh the skill stubs);
- how to read the Changelog, and that release-please writes it from commit types.

## Policy

Answered by the maintainer on 2026-11-24.

**These break only in a major release:**

1. **CLI:** commands, flags and exit codes.
2. **Model YAML:** a Workspace that passes `check` keeps passing within a major. A new rule arrives as a warning first.
3. **MCP tools:** tool names, required inputs and existing output fields. New tools and optional fields can be added in a minor.
4. **Rule ids:** an id is never reused, and a removed rule keeps its stub page.
5. **Viewer URLs:** a shared link keeps opening the same screen within a major. See the exception below.
6. **Node.js:** every line in active or maintenance LTS is supported. Dropping one needs a major release.

**These carry no promise:**

7. **The Bundle `schemaVersion`:** the Bundle format is internal and may change in any release. Sites and caches rebuild from git, and the Changelog says when it happens.

**The Action:**

8. **`@v1`:** a moving tag that each 1.x release moves to itself (ticket [22](22-moving-v1-tag.md)). `@v1.2.0` pins one release.

**Exception, viewer URLs:** the maintainer plans to drop `/#/` from viewer URLs in a 1.x release. What an old `#/view/…` link does after that isn't decided: the maintainer's answer was to ignore the question for now. The page says the hash form will change within v1 and promises nothing about old links until that work is specified.

## Acceptance criteria

- [x] The eight answers are recorded in this ticket.
- [x] The page exists under Help and states each promise in one sentence.
- [x] The page states the viewer URL exception as written above, without promising a redirect.
- [x] The Installation page's upgrade section links it.
