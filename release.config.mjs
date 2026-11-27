// semantic-release, run by .github/workflows/publish.yml once CI passes for a push to `main` or `beta`
// (docs/adr/0002-beta-branch-with-semantic-release.md, docs/adr/0003-release-gated-on-ci.md,
// docs/adr/0006-promote-by-fast-forward.md).
//
// - `beta` releases X.Y.Z-beta.N to the npm `beta` dist-tag. It commits package.json with that
//   version as `chore(release): X.Y.Z-beta.N [skip ci]` and tags that commit.
// - `main` releases X.Y.Z to the npm `latest` dist-tag and commits nothing. It only ever
//   fast-forwards to the commit the Promote workflow (.github/workflows/promote.yml) makes on
//   `beta`, `chore(release): X.Y.Z`, which already holds the version: the release tags that
//   commit, and refuses to publish unless package.json says X.Y.Z, so a wrong version never ships.
//
// So package.json in git is right at every release tag: the CLI reads it at runtime. There is no
// changelog file; release notes live in GitHub Releases (https://github.com/chalharb/archidocs/releases).
//
// Both publish to npm with trusted publishing (OIDC, no token) and make a GitHub Release, marked
// as a prerelease on `beta`. The version comes from the Conventional Commit titles since the last
// release on the branch: fix → patch, feat → minor, `!` or BREAKING CHANGE → major.

import process from "node:process";

// The release-notes sections release-please used. Only feat, fix, perf and breaking changes make a release.
const types = [
  { type: "feat", section: "Features" },
  { type: "fix", section: "Bug fixes" },
  { type: "perf", section: "Performance" },
  { type: "revert", section: "Reverts" },
  { type: "docs", section: "Documentation", hidden: true },
  { type: "style", section: "Styles", hidden: true },
  { type: "refactor", section: "Refactoring", hidden: true },
  { type: "test", section: "Tests", hidden: true },
  { type: "ci", section: "CI", hidden: true },
  { type: "chore", section: "Chores", hidden: true },
];
const conventional = { preset: "conventionalcommits", presetConfig: { types } };

// publish.yml sets it to the branch CI tested.
const branch = process.env.GITHUB_REF_NAME;

// Tells the workflow what was released: its smoke check, `v1` tag and site deploys read these.
// On `main` it first checks the Promote workflow's commit holds the version about to be released.
const outputs = [
  "@semantic-release/exec",
  {
    successCmd: 'echo "published=true" >> "$GITHUB_OUTPUT" && echo "version=${nextRelease.version}" >> "$GITHUB_OUTPUT"',
    ...(branch === "main" && {
      verifyReleaseCmd:
        'v=$(node -p "require(\'./package.json\').version") && [ "$v" = "${nextRelease.version}" ] || { echo "package.json says $v, but this release is ${nextRelease.version}: promote beta with the Promote workflow" >&2; exit 1; }',
    }),
  },
];

// Only `beta` commits its version; on `main` the Promote workflow already has.
const git = ["@semantic-release/git", { assets: ["package.json"], message: "chore(release): ${nextRelease.version} [skip ci]" }];

export default {
  branches: ["main", { name: "beta", prerelease: true }],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", conventional],
    ["@semantic-release/release-notes-generator", conventional],
    "@semantic-release/npm",
    ...(branch === "beta" ? [git] : []),
    ["@semantic-release/github", { successComment: false, releasedLabels: false }],
    outputs,
  ],
};
