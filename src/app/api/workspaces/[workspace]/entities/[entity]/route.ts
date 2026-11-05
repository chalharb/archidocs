import { getEntity } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/workspaces/[workspace]/entities/[entity]">,
) {
  return getEntity(request, getHttpDeps(), await ctx.params);
}
