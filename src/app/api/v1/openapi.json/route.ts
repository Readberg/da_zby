import type { NextRequest } from "next/server";
import { endpoints } from "@/server/api/v1/endpoints";
import { jsonResponse, resolveRequestId } from "@/server/api/v1/http";
import { buildOpenApiDocument } from "@/server/api/v1/openapi";

export async function GET(request: NextRequest) {
  return jsonResponse(buildOpenApiDocument(), {
    requestId: resolveRequestId(request.headers),
    cacheControl: endpoints.openapi.cacheControl,
  });
}
