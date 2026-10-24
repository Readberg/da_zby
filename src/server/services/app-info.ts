import { version } from "../../../package.json";
import { SUPPORTED_API_VERSIONS } from "@/server/api/versions";

export type AppInfo = {
  version: string;
  apiVersions: string[];
  buildDate: string | null;
};

export function getAppInfo(): AppInfo {
  return {
    version,
    apiVersions: [...SUPPORTED_API_VERSIONS],
    // Set once at build time in next.config.ts.
    buildDate: process.env.APP_BUILD_DATE ?? null,
  };
}
