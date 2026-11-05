/**
 * Process-wide registry of workspace repositories. Route handlers and server
 * components obtain repositories only through here (SEC-09).
 */
import { DEFAULT_PARSE_LIMITS } from "@/domain/parse";
import { DEFAULT_LOAD_OPTIONS } from "./workspace/loader";
import { WorkspaceRepository, type RepositoryOptions } from "./workspace/repository";
import { readConfig, type AppConfig } from "./config";

export interface WorkspaceEntry {
  key: string;
  status: "ready" | "error";
  error?: string;
  repository?: WorkspaceRepository;
}

export class WorkspaceService {
  private readonly entries = new Map<string, Promise<WorkspaceEntry>>();

  constructor(
    readonly config: AppConfig,
    private readonly repoOptions: RepositoryOptions = {},
  ) {}

  keys(): string[] {
    return this.config.workspaces.map((w) => w.key);
  }

  /** Open (once) and return the workspace; never throws. Unknown keys return null. */
  get(key: string): Promise<WorkspaceEntry> | null {
    const ws = this.config.workspaces.find((w) => w.key === key);
    if (!ws) return null;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = (async (): Promise<WorkspaceEntry> => {
        try {
          const repository = await WorkspaceRepository.open(key, ws.root, {
            load: {
              ...DEFAULT_LOAD_OPTIONS,
              parseLimits: { ...DEFAULT_PARSE_LIMITS, maxBytes: this.config.maxFileBytes },
            },
            ...this.repoOptions,
          });
          if (this.config.watch) await repository.startWatching();
          return { key, status: "ready", repository };
        } catch (err) {
          this.entries.delete(key); // allow a retry once the root is fixed
          return { key, status: "error", error: (err as Error).message };
        }
      })();
      this.entries.set(key, entry);
    }
    return entry;
  }

  async list(): Promise<WorkspaceEntry[]> {
    return Promise.all(this.keys().map((k) => this.get(k)!));
  }

  async close(): Promise<void> {
    const entries = await Promise.all(this.entries.values());
    this.entries.clear();
    await Promise.all(entries.map((e) => e.repository?.close()));
  }
}

const GLOBAL_KEY = Symbol.for("archidoc.workspaceService");
type GlobalWithService = typeof globalThis & { [GLOBAL_KEY]?: WorkspaceService };

/** Singleton that survives Next.js dev-mode module reloads. */
export function getWorkspaceService(): WorkspaceService {
  const g = globalThis as GlobalWithService;
  g[GLOBAL_KEY] ??= new WorkspaceService(readConfig());
  return g[GLOBAL_KEY];
}

/** Dependencies for HTTP handlers, built from the singleton service. */
export function getHttpDeps(): { service: WorkspaceService; allowedHosts: readonly string[] } {
  const service = getWorkspaceService();
  return { service, allowedHosts: service.config.allowedHosts };
}
