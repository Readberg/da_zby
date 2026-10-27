import { version } from "../../../package.json";
import { SUPPORTED_API_VERSIONS } from "@/server/api/versions";

export type AppInfo = {
  version: string;
  apiVersions: string[];
  buildDate: string | null;
  /** Git commit of the running build (Railway sets it); null elsewhere. */
  commit: string | null;
};

export function getAppInfo(): AppInfo {
  return {
    version,
    apiVersions: [...SUPPORTED_API_VERSIONS],
    // Set once at build time in next.config.ts.
    buildDate: process.env.APP_BUILD_DATE ?? null,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
  };
}
