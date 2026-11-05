import { reloadWorkspace } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/reload">,
) {
  return reloadWorkspace(request, getHttpDeps(), await ctx.params);
}
