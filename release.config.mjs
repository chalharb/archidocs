// semantic-release, run by .github/workflows/publish.yml once CI passes for a push to `main` or `beta`
// (docs/adr/0002-beta-branch-with-semantic-release.md, docs/adr/0003-release-gated-on-ci.md).
//
// - `main` releases X.Y.Z to the npm `latest` dist-tag, writes CHANGELOG.md and commits it with
//   package.json as `chore(release): X.Y.Z [skip ci]`, so the tag (and the `v1` Action tag the
//   workflow moves to it) carries the right version: the CLI reads package.json at runtime.
// - `beta` releases X.Y.Z-beta.N to the npm `beta` dist-tag and commits nothing back, so merging
//   `main` into `beta` never conflicts on those two files.
//
// Both publish to npm with trusted publishing (OIDC, no token) and make a GitHub Release, marked
// as a prerelease on `beta`. The version comes from the Conventional Commit titles since the last
// release on the branch: fix → patch, feat → minor, `!` or BREAKING CHANGE → major.

import process from "node:process";

const branch = process.env.GITHUB_REF_NAME;
const stable = branch === "main";

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

// Tells the workflow what was released: its smoke check, `v1` tag, site deploys and back-merge read these.
const outputs = [
  "@semantic-release/exec",
  {
    successCmd: 'echo "published=true" >> "$GITHUB_OUTPUT" && echo "version=${nextRelease.version}" >> "$GITHUB_OUTPUT"',
  },
];

export default {
  branches: ["main", { name: "beta", prerelease: true }],
  tagFormat: "v${version}",
  plugins: [
    ["@semantic-release/commit-analyzer", conventional],
    ["@semantic-release/release-notes-generator", conventional],
    ...(stable ? [["@semantic-release/changelog", { changelogFile: "CHANGELOG.md", changelogTitle: "# Changelog" }]] : []),
    "@semantic-release/npm",
    ...(stable
      ? [
          [
            "@semantic-release/git",
            { assets: ["package.json", "CHANGELOG.md"], message: "chore(release): ${nextRelease.version} [skip ci]" },
          ],
        ]
      : []),
    ["@semantic-release/github", { successComment: false, failComment: false, releasedLabels: false }],
    outputs,
  ],
};
