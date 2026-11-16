import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { findConfigFile } from "../../core/config.js";
import type { Io } from "../io.js";

function workspaceName(dir: string): string {
  const slug = path
    .basename(dir)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "my-architecture";
}

function starterConfig(name: string): string {
  return `import { defineConfig } from "archidocs";

export default defineConfig({
  name: ${JSON.stringify(name)},
  title: ${JSON.stringify(name)},
  model: "architectures/*.json",
  site: { base: "/" },
});
`;
}

export const starterModel = {
  metadata: {
    views: [{ id: "context", title: "System context", group: "Overview" }],
  },
  nodes: [
    {
      "unique-id": "customer",
      "node-type": "actor",
      name: "Customer",
      description: "Someone who uses the system.",
    },
    {
      "unique-id": "web-app",
      "node-type": "system",
      name: "Web app",
      description: "The application customers use.",
    },
  ],
  relationships: [
    {
      "unique-id": "customer-uses-web-app",
      "relationship-type": { interacts: { actor: "customer", nodes: ["web-app"] } },
    },
  ],
};

/** Writes a starter config and a tiny valid CALM file. Never overwrites existing files. */
export async function runInit(dir: string, io: Io): Promise<number> {
  const existing = findConfigFile(dir);
  if (existing) {
    io.error(`${path.basename(existing)} already exists; nothing was written.`);
    return 1;
  }
  const modelFile = path.join(dir, "architectures", "example.json");
  if (existsSync(modelFile)) {
    io.error("architectures/example.json already exists; nothing was written.");
    return 1;
  }
  await mkdir(path.dirname(modelFile), { recursive: true });
  await writeFile(path.join(dir, "archidocs.config.ts"), starterConfig(workspaceName(dir)));
  await writeFile(modelFile, `${JSON.stringify(starterModel, null, 2)}\n`);
  io.log("Created archidocs.config.ts and architectures/example.json");
  io.log('Next: run "archidocs build" to produce the site.');
  return 0;
}
