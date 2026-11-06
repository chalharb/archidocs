// @ts-check
// Mirrors agent workflow labels onto the GitHub Project board (docs/agents.md).
// Labels are the source of truth; the board is a view. Runs from
// .github/workflows/agent-project-sync.yml through actions/github-script.

/** Project "Status" option names, in workflow order. */
export const STATUS = {
  backlog: "Backlog",
  ready: "Ready",
  inProgress: "In Progress",
  inReview: "In Review",
  qa: "QA",
  readyToMerge: "Ready to Merge",
  done: "Done",
};

/** PR label → Status, highest precedence first. */
const PR_STATUS = [
  ["status:ready-to-merge", STATUS.readyToMerge],
  ["status:needs-qa", STATUS.qa],
  ["status:changes-requested", STATUS.inProgress],
  ["status:qa-failed", STATUS.inProgress],
  ["status:needs-review", STATUS.inReview],
];

/**
 * Board status for an issue, from its state, its labels and the labels of the
 * open pull requests that will close it. Recomputed from scratch on every event,
 * so label races and missed events self-heal on the next change.
 *
 * @param {{ state: string, labels: string[], openPrs: { labels: string[] }[] }} issue
 * @returns {string}
 */
export function computeStatus({ state, labels, openPrs }) {
  if (state.toUpperCase() === "CLOSED") return STATUS.done;
  for (const [label, status] of PR_STATUS) {
    if (openPrs.some((pr) => pr.labels.includes(label))) return status;
  }
  if (openPrs.length > 0) return STATUS.inReview;
  if (labels.includes("status:in-progress")) return STATUS.inProgress;
  if (labels.includes("status:ready")) return STATUS.ready;
  return STATUS.backlog;
}

/**
 * Value of a prefixed label for a single-select field, e.g. "agent:dev-1" → "Dev 1",
 * "size:xs" → "XS". Returns undefined when the issue has no such label.
 *
 * @param {string[]} labels
 * @param {"agent" | "size"} field
 * @returns {string | undefined}
 */
export function fieldValue(labels, field) {
  const label = labels.find((l) => l.startsWith(`${field}:`));
  if (!label) return undefined;
  const value = label.slice(field.length + 1);
  if (field === "size") return value.toUpperCase();
  const dev = /^dev-(\d+)$/.exec(value);
  return dev ? `Dev ${dev[1]}` : undefined;
}

/**
 * Case-insensitive lookup of a single-select option id.
 *
 * @param {{ options: { id: string, name: string }[] } | undefined} field
 * @param {string | undefined} name
 */
export function optionId(field, name) {
  if (!field || !name) return undefined;
  return field.options.find((o) => o.name.toLowerCase() === name.toLowerCase())?.id;
}

const ISSUE_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        state
        labels(first: 50) { nodes { name } }
        closedByPullRequestsReferences(first: 10, includeClosedPrs: false) {
          nodes { state labels(first: 50) { nodes { name } } }
        }
      }
    }
  }`;

const PR_ISSUES_QUERY = `
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        closingIssuesReferences(first: 10) { nodes { number repository { nameWithOwner } } }
      }
    }
  }`;

const PROJECT_QUERY = `
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) {
        id
        fields(first: 50) {
          nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
        }
      }
    }
  }`;

const ADD_ITEM = `
  mutation($project: ID!, $content: ID!) {
    addProjectV2ItemById(input: { projectId: $project, contentId: $content }) { item { id } }
  }`;

const SET_FIELD = `
  mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $option }
    }) { projectV2Item { id } }
  }`;

/**
 * @param {{ github: any, context: any, core: any, projectOwner: string, projectNumber: number }} args
 */
export async function run({ github, context, core, projectOwner, projectNumber }) {
  const { owner, repo } = context.repo;
  const repoName = `${owner}/${repo}`;

  /** @type {number[]} */
  let issueNumbers = [];
  if (context.payload.issue) {
    if (context.payload.issue.pull_request) return; // PR comments arrive as issues
    issueNumbers = [context.payload.issue.number];
  } else if (context.payload.pull_request) {
    const data = await github.graphql(PR_ISSUES_QUERY, {
      owner,
      repo,
      number: context.payload.pull_request.number,
    });
    issueNumbers = data.repository.pullRequest.closingIssuesReferences.nodes
      .filter((/** @type {any} */ n) => n.repository.nameWithOwner === repoName)
      .map((/** @type {any} */ n) => n.number);
  } else if (context.payload.inputs?.issue) {
    issueNumbers = [Number(context.payload.inputs.issue)];
  }
  if (issueNumbers.length === 0) {
    core.info("No linked issues to sync.");
    return;
  }

  const projectData = await github.graphql(PROJECT_QUERY, {
    owner: projectOwner,
    number: projectNumber,
  });
  const project = projectData.user.projectV2;
  /** @type {Record<string, { id: string, name: string, options: { id: string, name: string }[] }>} */
  const fields = {};
  for (const f of project.fields.nodes) if (f?.name) fields[f.name.toLowerCase()] = f;

  for (const number of issueNumbers) {
    const data = await github.graphql(ISSUE_QUERY, { owner, repo, number });
    const issue = data.repository.issue;
    const labels = issue.labels.nodes.map((/** @type {any} */ l) => l.name);
    const openPrs = issue.closedByPullRequestsReferences.nodes
      .filter((/** @type {any} */ pr) => pr.state === "OPEN")
      .map((/** @type {any} */ pr) => ({
        labels: pr.labels.nodes.map((/** @type {any} */ l) => l.name),
      }));

    const added = await github.graphql(ADD_ITEM, { project: project.id, content: issue.id });
    const item = added.addProjectV2ItemById.item.id;

    const wanted = {
      status: computeStatus({ state: issue.state, labels, openPrs }),
      agent: fieldValue(labels, "agent"),
      size: fieldValue(labels, "size"),
    };
    for (const [name, value] of Object.entries(wanted)) {
      if (!value) continue;
      const field = fields[name];
      const option = optionId(field, value);
      if (!field || !option) {
        core.warning(`Project field "${name}" has no option "${value}"; skipping (#${number}).`);
        continue;
      }
      await github.graphql(SET_FIELD, {
        project: project.id,
        item,
        field: field.id,
        option,
      });
    }
    core.info(`#${number} → ${wanted.status}`);
  }
}
