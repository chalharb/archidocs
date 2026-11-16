import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, readFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStaticServer } from "../support/static-server.mjs";

const repo = path.resolve(".");
let work: string;
let project: string;
let server: Server | undefined;

const sh = (cmd: string, args: string[], cwd: string) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, CI: "1" } });

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), "archidocs-pack-"));
  const tarballName = sh("npm", ["pack", "--silent", "--pack-destination", work], repo)
    .trim()
    .split("\n")
    .pop()!;
  project = path.join(work, "consumer");
  sh("mkdir", [project], work);
  sh("npm", ["init", "-y"], project);
  sh("npm", ["install", path.join(work, tarballName)], project);
});

afterAll(() => {
  server?.close();
  rmSync(work, { recursive: true, force: true });
});

describe("packed package", () => {
  it("ships only the built output, the readme and package metadata", () => {
    const installed = path.join(project, "node_modules/archidocs");
    const entries = readdirSync(installed);
    expect(entries).not.toEqual(expect.arrayContaining(["src"]));
    expect(readdirSync(installed)).toEqual(expect.arrayContaining(["dist", "README.md"]));
    expect(readdirSync(installed)).not.toContain("src");
  });

  it("initialises, builds and serves a site that loads", async () => {
    const bin = path.join(project, "node_modules/.bin/archidocs");
    sh(bin, ["init"], project);
    sh(bin, ["build", "--out", "site"], project);

    server = await startStaticServer({ dir: path.join(project, "site"), mount: "/" });
    const base = `http://localhost:${(server.address() as AddressInfo).port}/`;

    const page = await fetch(base);
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('id="root"');

    const asset = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
    expect(asset).toBeTruthy();
    expect((await fetch(new URL(asset!, base))).status).toBe(200);

    const data = (await (await fetch(new URL("archidocs-data.json", base))).json()) as {
      files: { views: { title: string }[] }[];
    };
    expect(data.files[0]?.views[0]?.title).toBe("System context");
  });

  it("exposes the config schema and the typed config helper", () => {
    const installed = path.join(project, "node_modules/archidocs/dist");
    const schema = JSON.parse(readFileSync(path.join(installed, "config.schema.json"), "utf8")) as {
      required: string[];
    };
    expect(schema.required).toEqual(["name", "model"]);
    expect(readdirSync(installed)).toContain("index.d.ts");
  });
});
