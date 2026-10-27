// Railway's GraphQL API, only what the release script needs (D-092): the newest deployment of the
// stand and a redeploy of a failed one. The token comes from RAILWAY_TOKEN (environment or
// .env.local) and is never printed.
import { existsSync, readFileSync } from "node:fs";

const ENDPOINT = "https://backboard.railway.com/graphql/v2";
// Identifiers of the project, not secrets (they are in every Railway link of the repository).
const PROJECT_ID = "3645f1bf-f415-4ef5-ba99-940540fee820";
const ENVIRONMENT_ID = "6d7c0581-c157-437d-9f3a-bba7b285ee4d";

export type Deployment = { id: string; status: string; commit: string | null };

function token(): string | null {
  if (process.env.RAILWAY_TOKEN) return process.env.RAILWAY_TOKEN;
  if (!existsSync(".env.local")) return null;
  const line = readFileSync(".env.local", "utf8").match(/^RAILWAY_TOKEN=(.*)$/m);
  return line?.[1]?.trim().replace(/^["']|["']$/g, "") || null;
}

async function query<T>(text: string): Promise<T> {
  const key = token();
  if (!key) throw new Error("RAILWAY_TOKEN is not set");
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "Project-Access-Token": key },
    body: JSON.stringify({ query: text }),
  });
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!body.data)
    throw new Error(body.errors?.[0]?.message ?? `Railway answered ${response.status}`);
  return body.data;
}

export const hasRailwayAccess = () => token() !== null;

/** The newest deployment of the stand. */
export async function latestDeployment(): Promise<Deployment | null> {
  const data = await query<{
    deployments: {
      edges: { node: { id: string; status: string; meta?: { commitHash?: string } } }[];
    };
  }>(
    `query { deployments(first: 1, input: { projectId: "${PROJECT_ID}", environmentId: "${ENVIRONMENT_ID}" }) { edges { node { id status meta } } } }`,
  );
  const node = data.deployments.edges[0]?.node;
  return node ? { id: node.id, status: node.status, commit: node.meta?.commitHash ?? null } : null;
}

/** Starts the same commit again (what the "Redeploy" button does). */
export async function redeploy(id: string): Promise<void> {
  await query(`mutation { deploymentRedeploy(id: "${id}") { id } }`);
}
