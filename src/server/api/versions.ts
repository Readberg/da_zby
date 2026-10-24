/** All major API versions currently served by the app, oldest first. */
export const SUPPORTED_API_VERSIONS = ["v1"] as const;

export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

export function isSupportedApiVersion(value: string): value is ApiVersion {
  return (SUPPORTED_API_VERSIONS as readonly string[]).includes(value);
}
