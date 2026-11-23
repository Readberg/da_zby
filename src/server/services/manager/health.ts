import { serverEnv } from "@/lib/env.server";
import { errorFields, log } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTelegramBot } from "../telegram-bot";
import { parseAdminIds } from "../telegram-login";
import type { WebhookState } from "../webhook-health";

export type ManagerState = WebhookState;

/** A match (or a lot) that waits longer than this after its time means the rounds are not played. */
export const OVERDUE_MINUTES = 30;
const CACHE_MS = 60_000;
/** The admins hear about a change at most this often. */
export const ALERT_MIN_SECONDS = 60 * 60;

let cached: { at: number; state: ManagerState } | null = null;

type Deps = {
  now?: () => number;
  overdue?: () => Promise<number>;
  changed?: (state: "ok" | "error") => Promise<boolean>;
  notify?: (text: string) => Promise<void>;
};

async function overdueCount(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("mgr_overdue_count", {
    p_minutes: OVERDUE_MINUTES,
  });
  if (error) throw error;
  return data ?? 0;
}

async function announcedChange(state: "ok" | "error"): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("mgr_alert_change", {
    p_name: "manager",
    p_state: state,
    p_min_seconds: ALERT_MIN_SECONDS,
  });
  if (error) throw error;
  return Boolean(data);
}

async function tellAdmins(text: string): Promise<void> {
  const token = serverEnv.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const bot = createTelegramBot(token);
  for (const id of parseAdminIds(serverEnv.TELEGRAM_ADMIN_IDS)) {
    await bot.sendMessage(Number(id), text).catch((error) => {
      log("warn", "manager.alert_failed", errorFields(error));
    });
  }
}

/**
 * "error" when a match is overdue (the scheduler and the visits are not playing the rounds),
 * "skipped" where the section cannot be checked (no service key). Cached for a minute; the admins
 * get a Telegram message when the state changes (once in an hour at most).
 */
export async function checkManager(deps: Deps = {}): Promise<ManagerState> {
  const now = deps.now ?? Date.now;
  if (!deps.overdue && !serverEnv.SUPABASE_SECRET_KEY) return "skipped";
  if (cached && now() - cached.at < CACHE_MS) return cached.state;
  let state: ManagerState;
  try {
    state = (await (deps.overdue ?? overdueCount)()) > 0 ? "error" : "ok";
  } catch (error) {
    log("warn", "manager.health_failed", errorFields(error));
    return "skipped";
  }
  cached = { at: now(), state };
  try {
    if (await (deps.changed ?? announcedChange)(state)) {
      await (deps.notify ?? tellAdmins)(
        state === "error"
          ? "⚠️ Менеджер: матчи или торги не рассчитаны больше 30 минут после времени. Проверьте планировщик (manager-rounds) и CRON_SECRET."
          : "✅ Менеджер: расчёт туров снова работает.",
      );
    }
  } catch (error) {
    log("warn", "manager.alert_failed", errorFields(error));
  }
  return state;
}

/** For tests. */
export function resetManagerHealth() {
  cached = null;
}
