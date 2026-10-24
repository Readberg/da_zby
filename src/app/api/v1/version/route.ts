import { endpoints } from "@/server/api/v1/endpoints";
import { withApi } from "@/server/api/v1/with-api";
import { getAppInfo } from "@/server/services/app-info";

export const GET = withApi(endpoints.version, async () => ({ data: getAppInfo() }));
