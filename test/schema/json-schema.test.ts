import { readFile } from "node:fs/promises";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { deploymentWorkspace, elementTreeWorkspace, relationshipWorkspace, validWorkspace } from "../support/fixtures.ts";
import { jsonSchemas, serializeJsonSchema } from "../../src/schema/index.ts";

/** The JSON Schemas shipped for editors, as published in the package. */
const shipped = async (name: string) => JSON.parse(await readFile(new URL(`../../schemas/${name}.schema.json`, import.meta.url), "utf8"));

const validator = async (name: string) => {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats.default(ajv);
  return ajv.compile(await shipped(name));
};

const schemaFor = (path: string) => (path === "workspace.yaml" ? "workspace" : path.endsWith("/project.yaml") ? "project" : "model");

describe("shipped JSON Schemas", () => {
  it.each([...Object.entries(validWorkspace), ...Object.entries(elementTreeWorkspace), ...Object.entries(relationshipWorkspace), ...Object.entries(deploymentWorkspace)])("accept the fixture file %s", async (path, text) => {
    const validate = await validator(schemaFor(path));
    expect(validate(parse(text)), JSON.stringify(validate.errors)).toBe(true);
  });

  it("reject an unknown key on a nested Element", async () => {
    const validate = await validator("model");
    const file = parse("systems:\n  checkout:\n    name: Checkout\n    services:\n      cart:\n        name: Cart\n        techology: Go\n");
    expect(validate(file)).toBe(false);
    expect(validate.errors).toContainEqual(
      expect.objectContaining({ instancePath: "/systems/checkout/services/cart", keyword: "additionalProperties", params: { additionalProperty: "techology" } }),
    );
  });

  it("reject an unknown key on a nested Deployment Target and a malformed Deployment url", async () => {
    const validate = await validator("model");
    expect(validate(parse("targets:\n  dc:\n    name: DC\n    kind: datacenter\n    targets:\n      rack:\n        name: Rack\n        knd: rack\n"))).toBe(false);
    expect(validate.errors).toContainEqual(expect.objectContaining({ keyword: "additionalProperties", params: { additionalProperty: "knd" } }));
    expect(validate(parse("deployments:\n  - { service: web, environment: prod, target: eks, url: not-a-url }\n"))).toBe(false);
  });

  it("reject an unknown key in project.yaml and workspace.yaml", async () => {
    expect((await validator("project"))(parse("id: shop\nname: Shop\nowner: core\nowners: [core]\n"))).toBe(false);
    expect((await validator("workspace"))(parse("teams:\n  core:\n    name: Core\n    colour: red\n"))).toBe(false);
  });
});

describe("schemas/ in the package", () => {
  it("is up to date with the zod types (run `pnpm schemas` after changing them)", async () => {
    for (const [name, schema] of Object.entries(jsonSchemas())) {
      expect(await readFile(new URL(`../../schemas/${name}.schema.json`, import.meta.url), "utf8"), name).toBe(serializeJsonSchema(schema));
    }
  });
});
