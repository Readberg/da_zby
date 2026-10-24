import { z } from "zod";
import type { EndpointDef } from "./endpoint";
import { endpoints } from "./endpoints";
import { problemSchema } from "./problem";

type JsonSchema = Record<string, unknown>;

function toSchema(schema: z.ZodType, io: "input" | "output" = "output"): JsonSchema {
  const json: JsonSchema = z.toJSONSchema(schema, { io, unrepresentable: "any" });
  delete json.$schema;
  return json;
}

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  503: "Service Unavailable",
};

const problemRef = {
  content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
};

function queryParameters(endpoint: EndpointDef) {
  if (!endpoint.query) return undefined;
  return Object.entries(endpoint.query.shape).map(([name, field]) => {
    const schema = toSchema(field as z.ZodType, "input");
    return {
      name,
      in: "query",
      required: !(field as z.ZodType).safeParse(undefined).success,
      ...(typeof schema.description === "string" ? { description: schema.description } : {}),
      schema,
    };
  });
}

function operation(name: string, endpoint: EndpointDef) {
  const isRaw = endpoint === endpoints.openapi;
  const successSchema = isRaw
    ? toSchema(endpoint.output)
    : {
        type: "object",
        properties: {
          data: toSchema(endpoint.output),
          meta: endpoint.meta ? toSchema(endpoint.meta) : { type: "object" },
        },
        required: ["data", "meta"],
      };

  const errorStatuses = [...new Set([...(endpoint.errors ?? []), 500])].sort();
  const parameters = queryParameters(endpoint);

  return {
    operationId: name,
    summary: endpoint.summary,
    ...(endpoint.description ? { description: endpoint.description } : {}),
    tags: endpoint.tags,
    ...(parameters ? { parameters } : {}),
    ...(endpoint.auth === "public" ? { security: [] } : {}),
    "x-auth-level": endpoint.auth,
    responses: {
      "200": {
        description: "OK",
        headers: {
          "X-Request-Id": { schema: { type: "string" } },
          "API-Version": { schema: { type: "string", const: "1" } },
        },
        content: { "application/json": { schema: successSchema } },
      },
      ...Object.fromEntries(
        errorStatuses.map((status) => [
          String(status),
          { description: STATUS_TITLES[status] ?? "Error", ...problemRef },
        ]),
      ),
    },
  };
}

/** Builds the OpenAPI 3.1 document of API v1 from the endpoint registry and Zod schemas. */
export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [name, endpoint] of Object.entries(endpoints) as [string, EndpointDef][]) {
    paths[endpoint.path] = {
      ...paths[endpoint.path],
      [endpoint.method]: operation(name, endpoint),
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Да забей — internal API",
      version: "1",
      description:
        "Versioned internal API. Errors use RFC 9457 problem+json with a stable `code`. See docs/API.md.",
    },
    servers: [{ url: "/api/v1" }],
    paths,
    components: {
      schemas: { Problem: toSchema(problemSchema) },
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "sb-<project-ref>-auth-token" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  };
}
