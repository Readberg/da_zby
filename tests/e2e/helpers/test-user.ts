import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

// Local runs: pick up .env.local (Node 24). CI passes the variables directly.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the process environment.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

/** Admin-API tests run only when the dev project's secret key is available (docs/OWNER_TODO.md, A7). */
export const hasAdminAccess = Boolean(url && secret);

function admin() {
  return createClient(url!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string };

/** Creates a confirmed user with an `e2e-` email; remove it with `deleteTestUser`. */
export async function createTestUser(): Promise<TestUser> {
  const email = `e2e-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email };
}

export async function deleteTestUser(user: TestUser): Promise<void> {
  // Profile rows are removed by the foreign key cascade.
  await admin().auth.admin.deleteUser(user.id);
}

/** Signs the browser in through the same token-hash route that the email link uses. */
export async function signInAs(page: Page, user: TestUser, next = "/"): Promise<void> {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error || !data.properties?.hashed_token)
    throw new Error(`generateLink failed: ${error?.message}`);
  const token = data.properties.hashed_token;
  await page.goto(`/auth/confirm?token_hash=${token}&type=email&next=${encodeURIComponent(next)}`);
}

/** Service-role client for test set-up and clean-up (never used by the app code under test). */
export function serviceClient() {
  return admin();
}

/** Gives a test user a nickname (and optionally the admin role) without going through the UI. */
export async function setProfile(
  user: TestUser,
  patch: { nickname?: string; role?: "admin" | "user" },
): Promise<void> {
  const { error } = await admin().from("profiles").update(patch).eq("id", user.id);
  if (error) throw new Error(`profile update failed: ${error.message}`);
}

const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** A client that acts like a guest: the publishable key only, no session. */
export function guestClient() {
  return createClient(url!, publishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client that acts like the signed-in test user: the database sees their session and nothing else. */
export async function signedInClient(user: TestUser) {
  const { data, error } = await admin().auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (error || !data.properties?.hashed_token)
    throw new Error(`generateLink failed: ${error?.message}`);
  const client = guestClient();
  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (verifyError) throw new Error(`verifyOtp failed: ${verifyError.message}`);
  return client;
}
