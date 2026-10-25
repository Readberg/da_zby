import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { TelegramUser } from "./login-tokens";

/**
 * Telegram gives no email, but Supabase accounts need one. Each Telegram id maps to a fixed
 * synthetic address that never receives mail (reserved `.invalid` TLD).
 */
export function telegramEmail(telegramId: string): string {
  return `tg${telegramId}@telegram.invalid`;
}

export function parseAdminIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Makes sure the Telegram user has an account and returns a one-time token hash that the caller
 * exchanges for a session (`auth.verifyOtp`). Admins listed in TELEGRAM_ADMIN_IDS are registered in
 * `admin_bootstrap` first, so the existing database trigger promotes them on account creation.
 */
export async function prepareTelegramSession(
  admin: SupabaseClient<Database>,
  user: TelegramUser,
  adminIds: string[],
): Promise<string> {
  const email = telegramEmail(user.id);

  if (adminIds.includes(user.id)) {
    const { error } = await admin
      .from("admin_bootstrap")
      .upsert({ email, nickname: null }, { onConflict: "email" });
    if (error) throw new Error(`admin bootstrap failed: ${error.message}`);
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { telegram_id: user.id, telegram_username: user.username, full_name: fullName },
  });
  // An existing account is the normal case on every later login.
  if (created.error && created.error.code !== "email_exists") {
    throw new Error(`create user failed: ${created.error.message}`);
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error || !tokenHash) {
    throw new Error(`generate link failed: ${link.error?.message ?? "no token"}`);
  }
  return tokenHash;
}
