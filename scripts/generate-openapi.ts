// Regenerates the committed OpenAPI snapshot: `pnpm api:openapi`.
import { writeFileSync } from "node:fs";
import { buildOpenApiDocument } from "../src/server/api/v1/openapi";

const target = new URL("../docs/api/openapi.v1.json", import.meta.url);
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.log(`OpenAPI snapshot written to ${target.pathname}`);
