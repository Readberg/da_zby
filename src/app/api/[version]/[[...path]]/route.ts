import type { NextRequest } from "next/server";
import { notFoundError, problemResponse, resolveRequestId } from "@/server/api/v1/http";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import { SUPPORTED_API_VERSIONS, isSupportedApiVersion } from "@/server/api/versions";

// Catches everything under /api that no versioned route handles:
// an unknown version (/api/v9/...) or an unknown resource of a known version (/api/v1/nope).
async function handle(request: NextRequest, ctx: RouteContext<"/api/[version]/[[...path]]">) {
  const { version } = await ctx.params;
  const requestId = resolveRequestId(request.headers);
  const instance = new URL(request.url).pathname;

  if (!isSupportedApiVersion(version)) {
    return problemResponse(
      new ApiError(
        404,
        ERROR_CODES.versionUnsupported,
        "Unsupported API version",
        `API version "${version}" is not supported. Supported: ${SUPPORTED_API_VERSIONS.join(", ")}.`,
        undefined,
        { supportedVersions: [...SUPPORTED_API_VERSIONS] },
      ),
      requestId,
      instance,
    );
  }

  return problemResponse(notFoundError(instance), requestId, instance);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
