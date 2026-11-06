import { describe, expect, it, vi } from "vitest";
import {
  STATUS,
  computeStatus,
  fieldValue,
  optionId,
  run,
} from "../../../.github/scripts/project-sync.mjs";
import { checkSubject } from "../../../.github/scripts/conventional-commits.mjs";

describe("computeStatus", () => {
  const open = (labels: string[] = [], openPrs: { labels: string[] }[] = []) =>
    computeStatus({ state: "OPEN", labels, openPrs });

  it("maps closed issues to Done regardless of labels", () => {
    expect(computeStatus({ state: "CLOSED", labels: ["status:ready"], openPrs: [] })).toBe(
      STATUS.done,
    );
  });

  it("uses issue labels when no PR is open", () => {
    expect(open()).toBe(STATUS.backlog);
    expect(open(["status:ready"])).toBe(STATUS.ready);
    expect(open(["status:ready", "status:in-progress"])).toBe(STATUS.inProgress);
  });

  it("treats an unlabelled open PR as In Review", () => {
    expect(open(["status:in-progress"], [{ labels: [] }])).toBe(STATUS.inReview);
  });

  it.each([
    ["status:needs-review", STATUS.inReview],
    ["status:changes-requested", STATUS.inProgress],
    ["status:needs-qa", STATUS.qa],
    ["status:qa-failed", STATUS.inProgress],
    ["status:ready-to-merge", STATUS.readyToMerge],
  ])("maps PR label %s", (label, status) => {
    expect(open(["status:in-progress"], [{ labels: [label] }])).toBe(status);
  });

  it("prefers the most advanced PR label", () => {
    expect(open([], [{ labels: ["status:needs-review"] }, { labels: ["status:needs-qa"] }])).toBe(
      STATUS.qa,
    );
  });
});

describe("fieldValue", () => {
  it("maps agent and size labels to board option names", () => {
    expect(fieldValue(["type:task", "agent:dev-2"], "agent")).toBe("Dev 2");
    expect(fieldValue(["size:xs"], "size")).toBe("XS");
  });

  it("returns undefined when absent or malformed", () => {
    expect(fieldValue(["type:task"], "agent")).toBeUndefined();
    expect(fieldValue(["agent:qa"], "agent")).toBeUndefined();
    expect(fieldValue([], "size")).toBeUndefined();
  });
});

describe("optionId", () => {
  const field = { options: [{ id: "o1", name: "In Progress" }] };
  it("matches case-insensitively", () => {
    expect(optionId(field, "in progress")).toBe("o1");
  });
  it("returns undefined for missing fields, names or options", () => {
    expect(optionId(undefined, "x")).toBeUndefined();
    expect(optionId(field, undefined)).toBeUndefined();
    expect(optionId(field, "Done")).toBeUndefined();
  });
});

describe("run", () => {
  const project = {
    user: {
      projectV2: {
        id: "P",
        fields: {
          nodes: [
            {},
            { id: "FS", name: "Status", options: [{ id: "s-qa", name: "QA" }] },
            { id: "FA", name: "Agent", options: [{ id: "a1", name: "Dev 1" }] },
          ],
        },
      },
    },
  };
  const issue = {
    repository: {
      issue: {
        id: "I",
        state: "OPEN",
        labels: { nodes: [{ name: "agent:dev-1" }, { name: "size:s" }] },
        closedByPullRequestsReferences: {
          nodes: [
            { state: "OPEN", labels: { nodes: [{ name: "status:needs-qa" }] } },
            { state: "MERGED", labels: { nodes: [{ name: "status:ready-to-merge" }] } },
          ],
        },
      },
    },
  };

  function fakeGithub(prIssues: { number: number; repository: { nameWithOwner: string } }[]) {
    return {
      graphql: vi.fn(async (query: string, _vars?: Record<string, unknown>) => {
        if (query.includes("closingIssuesReferences"))
          return { repository: { pullRequest: { closingIssuesReferences: { nodes: prIssues } } } };
        if (query.includes("projectV2(number")) return project;
        if (query.includes("closedByPullRequestsReferences")) return issue;
        if (query.includes("addProjectV2ItemById"))
          return { addProjectV2ItemById: { item: { id: "ITEM" } } };
        return {};
      }),
    };
  }
  const core = { info: vi.fn(), warning: vi.fn() };
  const args = { projectOwner: "me", projectNumber: 2 };

  it("syncs status and agent for issues linked to a PR and warns on missing options", async () => {
    const github = fakeGithub([
      { number: 7, repository: { nameWithOwner: "o/r" } },
      { number: 8, repository: { nameWithOwner: "other/repo" } },
    ]);
    const context = { repo: { owner: "o", repo: "r" }, payload: { pull_request: { number: 3 } } };
    await run({ github, context, core, ...args });

    const sets = github.graphql.mock.calls.filter(([q]) => q.includes("updateProjectV2Item"));
    expect(sets.map(([, v]) => v?.option)).toEqual(["s-qa", "a1"]);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining('"size" has no option "S"'));
    expect(github.graphql.mock.calls.filter(([, v]) => v?.number === 8)).toHaveLength(0);
  });

  it("syncs a single issue from an issue event or manual input", async () => {
    for (const payload of [{ issue: { number: 7 } }, { inputs: { issue: "7" } }]) {
      const github = fakeGithub([]);
      await run({ github, context: { repo: { owner: "o", repo: "r" }, payload }, core, ...args });
      expect(github.graphql).toHaveBeenCalledWith(expect.any(String), {
        owner: "o",
        repo: "r",
        number: 7,
      });
    }
  });

  it("ignores PR comment events and events with no linked issue", async () => {
    for (const payload of [{ issue: { number: 1, pull_request: {} } }, {}]) {
      const github = fakeGithub([]);
      await run({ github, context: { repo: { owner: "o", repo: "r" }, payload }, core, ...args });
      expect(github.graphql).not.toHaveBeenCalled();
    }
  });
});

describe("checkSubject", () => {
  it.each([
    "feat(diagrams): add sequence view",
    "fix: handle empty layout",
    "refactor(server)!: drop legacy loader",
    "Merge branch 'main' into dev-1/12-x",
  ])("accepts %s", (subject) => {
    expect(checkSubject(subject)).toBeUndefined();
  });

  it.each([
    "Add feature",
    "feature: x",
    "feat(Diagrams): x",
    "feat:no space",
    `feat: ${"x".repeat(101)}`,
  ])("rejects %s", (subject) => {
    expect(checkSubject(subject)).toMatch(/is not/);
  });
});
