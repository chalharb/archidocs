import { workspaceEvents } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/events">,
) {
  return workspaceEvents(request, getHttpDeps(), await ctx.params);
}
