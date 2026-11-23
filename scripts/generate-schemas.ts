// Writes the editor JSON Schemas to schemas/. Run with `pnpm schemas`.
import { mkdir, writeFile } from "node:fs/promises";
import { jsonSchemas, serializeJsonSchema } from "../src/schema/json-schema.ts";

const dir = new URL("../schemas/", import.meta.url);
await mkdir(dir, { recursive: true });
for (const [name, schema] of Object.entries(jsonSchemas())) {
  await writeFile(new URL(`${name}.schema.json`, dir), serializeJsonSchema(schema));
}
