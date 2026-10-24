import type { z } from "zod";

export type AuthLevel = "public" | "user" | "admin";

/**
 * Declarative description of one API v1 endpoint. The same object drives request handling
 * (`withApi`) and the OpenAPI document, so the contract cannot drift from the code.
 */
export type EndpointDef<
  Query extends z.ZodObject = z.ZodObject,
  Output extends z.ZodType = z.ZodType,
  Body extends z.ZodType = z.ZodType,
> = {
  method: "get" | "post" | "put" | "patch" | "delete";
  /** Path relative to `/api/v1`, e.g. `/health`. */
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  auth: AuthLevel;
  query?: Query;
  /** JSON request body (POST/PUT/PATCH); invalid JSON is 400, schema violations are 422. */
  body?: Body;
  /** Schema of `data` in the success envelope. */
  output: Output;
  /** Schema of `meta` in the success envelope (defaults to an empty object). */
  meta?: z.ZodObject;
  cacheControl: string;
  /** Error statuses this endpoint can return besides 500. */
  errors?: number[];
};

export function defineEndpoint<
  Query extends z.ZodObject,
  Output extends z.ZodType,
  Body extends z.ZodType = z.ZodType,
>(def: EndpointDef<Query, Output, Body>): EndpointDef<Query, Output, Body> {
  return def;
}
