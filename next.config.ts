import path from "node:path";
import type { NextConfig } from "next";

/**
 * Workspace folders are read from disk at runtime, so the bundler can't see
 * them. List them for output file tracing so serverless deployments (Vercel)
 * ship them (ADD-010). Mirrors the ARCHIDOC_WORKSPACES parsing in
 * src/server/config.ts; roots outside the project can't be bundled.
 */
function workspaceRoots(): string[] {
  const spec = process.env.ARCHIDOC_WORKSPACES?.trim() || "examples/sample-workspace";
  const roots: string[] = [];
  for (const raw of spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = raw.indexOf("=");
    const root = path.resolve(eq >= 0 ? raw.slice(eq + 1).trim() : raw);
    const rel = path.relative(process.cwd(), root);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      roots.push(`./${rel.split(path.sep).join("/")}`);
    }
  }
  return roots;
}

const TRACED_EXTENSIONS = ["yaml", "yml", "md", "png", "jpg", "jpeg", "gif", "webp", "svg"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Only the file types the app reads, so local app state (drafts) never ships.
  // Images mirror IMAGE_CONTENT_TYPES in src/server/fs/images.ts (SEC-12).
  outputFileTracingIncludes: {
    "/**": workspaceRoots().flatMap((r) =>
      TRACED_EXTENSIONS.flatMap((ext) => [`${r}/**/*.${ext}`, `${r}/**/*.${ext.toUpperCase()}`]),
    ),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
