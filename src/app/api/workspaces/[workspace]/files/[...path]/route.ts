import { getWorkspaceFile } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/files/[...path]">,
) {
  return getWorkspaceFile(request, getHttpDeps(), await ctx.params);
}
