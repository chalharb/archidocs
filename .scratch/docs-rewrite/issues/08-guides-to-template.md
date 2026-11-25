# 08: Guides rewritten to the how-to template

Status: done
Blocked by: 07
Spec: [Docs rewrite proposal](../spec.md)

## What to build

Rewrite the 18 guides to the how-to template in `website/README.md`.

- **Shape:** one-sentence outcome, Before you start, numbered steps, Check it worked, If it didn't, With an agent, Related.
- **Output:** show what a command prints wherever the reader acts on it. Only two pages do today.
- **No field lists:** replace restated field meanings with a link to the reference field. Keep one sample per step.
- **No explanation:** move "why" paragraphs to the matching concept and link it. `publish/github-pages` and `publish/other-hosts` open with explanation today.
- **Titles start with a verb:**

  | Now | Becomes |
  | --- | --- |
  | Dynamic Views | Write a Dynamic View |
  | GitHub Pages | Publish to GitHub Pages |
  | GitLab Pages | Publish to GitLab Pages |
  | Other hosts | Publish to another host |
  | PR previews | Preview pull requests |
  | Saved View images | Publish Saved View images |

- **URLs:** slugs stay, because `action.yml`, the GitLab template and released CLIs link them. The one exception is `guides/model/dynamic-views` → `write-a-dynamic-view`, with a redirect.
- **Group label:** "Review" becomes "Review and share".
- Keep each guide's "For agents" pointer and its tested failure samples.

## Acceptance criteria

- [ ] All 18 guides pass the template test, and the test's not-yet-migrated list holds no guide.
- [ ] Every guide title starts with a verb.
- [ ] `/docs/guides/model/dynamic-views/` redirects to the new URL.
- [ ] The failure-samples test still passes, with every sample still shown on a page.
- [ ] No guide repeats a list of field meanings that a reference page holds.
