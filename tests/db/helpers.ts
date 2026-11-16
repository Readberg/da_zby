import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type Db = SupabaseClient<Database>;
export type TestUser = { id: string; email: string; password: string };
export type World = {
  users: { a: TestUser; b: TestUser; outsider: TestUser; admin: TestUser };
  clubs: { a: string; b: string };
  leagueId: string;
  predictions: { matchId: string; tourId: string; seasonId: string };
};

export const TEST_EMAIL_DOMAIN = "dbtest.example";

export function dbEnv() {
  const url = process.env.DB_TEST_URL;
  const anon = process.env.DB_TEST_ANON_KEY;
  const service = process.env.DB_TEST_SERVICE_KEY;
  if (!url || !anon || !service) {
    throw new Error(
      "DB_TEST_URL / DB_TEST_ANON_KEY / DB_TEST_SERVICE_KEY are not set: run `pnpm test:db`.",
    );
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`Refusing to run db tests against a non-local URL: ${url}`);
  }
  return { url, anon, service };
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient(): Db {
  const env = dbEnv();
  return createClient<Database>(env.url, env.anon, options);
}

/** service_role: bypasses RLS, may call the server-only functions. */
export function serviceClient(): Db {
  const env = dbEnv();
  return createClient<Database>(env.url, env.service, options);
}

export async function createTestUser(label: string): Promise<TestUser> {
  const email = `${label}-${Math.random().toString(36).slice(2, 8)}@${TEST_EMAIL_DOMAIN}`;
  const password = `Pw-${Math.random().toString(36).slice(2)}-x1`;
  const { data, error } = await serviceClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`cannot create test user: ${error?.message}`);
  return { id: data.user.id, email, password };
}

export async function signedInClient(user: TestUser): Promise<Db> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`cannot sign in: ${error.message}`);
  return client;
}

/** Runs SQL in the local database container (for catalog checks PostgREST cannot do). */
export function psql(sql: string): string[][] {
  const container = process.env.DB_TEST_DB_CONTAINER ?? "supabase_db_da_zby";
  const out = execFileSync(
    "docker",
    ["exec", container, "psql", "-U", "postgres", "-At", "-F", "|", "-c", sql],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("|"));
}
