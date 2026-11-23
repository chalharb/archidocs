import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseAllDocuments } from "yaml";
import { SCHEMA_VERSION } from "../../src/schema/bundle.ts";

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("the CI integrations", () => {
  // GitLab can't compute a cache key in the job, so the template names the schemaVersion itself.
  it("the GitLab template keys its cache by the current Bundle schemaVersion", async () => {
    const [spec, jobs] = parseAllDocuments(await read("templates/gitlab/archidocs.gitlab-ci.yml")).map((d) => d.toJS());

    expect(Object.keys(spec.spec.inputs).sort()).toEqual(["image", "images", "keep", "preview", "version", "working-directory"]);
    expect(jobs[".archidocs"].cache).toEqual({ key: `archidocs-bundles-schema-${SCHEMA_VERSION}`, paths: [".archidocs/cache/"] });
  });
});
