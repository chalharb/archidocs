import { listWorkspaces } from "@/server/http/handlers";
import { getHttpDeps } from "@/server/service";

export async function GET(request: Request) {
  return listWorkspaces(request, getHttpDeps());
}
