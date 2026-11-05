/** Application configuration from environment variables (SEC-02: explicit workspace roots). */
import path from "node:path";
import { idSchema } from "@/domain/schema/resource-schemas";
import { DEFAULT_PARSE_LIMITS } from "@/domain/parse";

export interface WorkspaceConfig {
  key: string;
  root: string;
}

export interface AppConfig {
  workspaces: WorkspaceConfig[];
  /** Extra hostnames accepted besides loopback (SEC-10). Empty by default. */
  allowedHosts: string[];
  watch: boolean;
  maxFileBytes: number;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const DEFAULT_WORKSPACE = "examples/sample-workspace";

/**
 * ARCHIDOC_WORKSPACES: comma-separated `key=path` entries, or bare paths (key = directory name).
 * ARCHIDOC_ALLOWED_HOSTS: comma-separated extra hostnames.
 * ARCHIDOC_WATCH: "0"/"false" disables file watching.
 * ARCHIDOC_MAX_FILE_BYTES: per-file size limit.
 */
export function readConfig(
  env: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
): AppConfig {
  const spec = env.ARCHIDOC_WORKSPACES?.trim() || DEFAULT_WORKSPACE;
  const workspaces: WorkspaceConfig[] = [];
  for (const raw of spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = raw.indexOf("=");
    const rootSpec = eq >= 0 ? raw.slice(eq + 1).trim() : raw;
    const root = path.resolve(cwd, rootSpec);
    const key = eq >= 0 ? raw.slice(0, eq).trim() : path.basename(root);
    if (!idSchema.safeParse(key).success)
      throw new ConfigError(`Invalid workspace key '${key}' in ARCHIDOC_WORKSPACES`);
    if (workspaces.some((w) => w.key === key))
      throw new ConfigError(`Duplicate workspace key '${key}' in ARCHIDOC_WORKSPACES`);
    workspaces.push({ key, root });
  }
  const maxFileBytes = env.ARCHIDOC_MAX_FILE_BYTES
    ? Number(env.ARCHIDOC_MAX_FILE_BYTES)
    : DEFAULT_PARSE_LIMITS.maxBytes;
  if (!Number.isInteger(maxFileBytes) || maxFileBytes <= 0 || maxFileBytes > 64 * 1024 * 1024) {
    throw new ConfigError("ARCHIDOC_MAX_FILE_BYTES must be a positive integer up to 64 MiB");
  }
  return {
    workspaces,
    allowedHosts: (env.ARCHIDOC_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
    watch: !["0", "false", "no"].includes((env.ARCHIDOC_WATCH ?? "").trim().toLowerCase()),
    maxFileBytes,
  };
}
