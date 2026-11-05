import { getWorkspace } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function GET(request: Request, ctx: RouteContext<"/api/workspaces/[workspace]">) {
  return getWorkspace(request, getHttpDeps(), await ctx.params);
}
