// semantic-release, run by .github/workflows/publish.yml once CI passes for a push to `main` or `beta`
// (docs/adr/0002-beta-branch-with-semantic-release.md, docs/adr/0003-release-gated-on-ci.md).
//
// - `main` releases X.Y.Z to the npm `latest` dist-tag.
// - `beta` releases X.Y.Z-beta.N to the npm `beta` dist-tag.
//
// Both channels commit package.json with the released version as `chore(release): X.Y.Z [skip ci]`
// and tag that commit, so the file in git is right at every release tag: the CLI reads
// package.json at runtime. There is no changelog file; release notes live in GitHub Releases
// (https://github.com/chalharb/archidocs/releases).
//
// Both publish to npm with trusted publishing (OIDC, no token) and make a GitHub Release, marked
// as a prerelease on `beta`. The version comes from the Conventional Commit titles since the last
// release on the branch: fix → patch, feat → minor, `!` or BREAKING CHANGE → major.

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

// Tells the workflow what was released: its smoke check, `v1` tag and site deploys read these.
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
    "@semantic-release/npm",
    ["@semantic-release/git", { assets: ["package.json"], message: "chore(release): ${nextRelease.version} [skip ci]" }],
    ["@semantic-release/github", { successComment: false, releasedLabels: false }],
    outputs,
  ],
};
