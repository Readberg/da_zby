import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/log";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  ConsoleActionBody,
  ConsoleActionResult,
  ConsoleEditBody,
  ConsoleList,
  ConsoleListQuery,
  SuspiciousItem,
} from "@/server/api/v1/schemas/admin-console";
import { ACTIONS, canRun, type ActionKey } from "@/server/admin/permissions";
import { entityByKey, type Entity } from "@/server/admin/registry";
import { runRounds } from "./manager/season";
import type { Database } from "@/types/database";

/**
 * The console reads any table and calls the adm_* functions, so it works on a loosely typed client
 * (the secret key). Nothing here trusts the caller: the role is looked up from the database by the
 * user id the server authenticated, and the adm_* functions check it again.
 */
type Row = Record<string, unknown>;
type Result = {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
};
export type Loose = {
  from(table: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc(fn: string, args?: object): PromiseLike<Result>;
  auth: SupabaseClient<Database>["auth"];
  storage: SupabaseClient<Database>["storage"];
};
export const loose = (client: unknown): Loose => client as Loose;

const SQL_STATE_STATUS: Record<string, [number, string]> = {
  "42501": [403, ERROR_CODES.forbidden],
  "22023": [422, ERROR_CODES.validationFailed],
  P0002: [404, ERROR_CODES.notFound],
  "23505": [409, ERROR_CODES.duplicate],
  "23514": [422, ERROR_CODES.validationFailed],
  "0A000": [409, ERROR_CODES.seasonState],
};

/** Turns an error of an adm_* function into an API problem. */
export function toApiError(error: { code?: string; message: string }): ApiError {
  if (error.message.includes("last admin")) {
    return new ApiError(
      409,
      ERROR_CODES.lastAdmin,
      "Conflict",
      "The last admin cannot be demoted.",
    );
  }
  const mapped = error.code ? SQL_STATE_STATUS[error.code] : undefined;
  if (mapped) return new ApiError(mapped[0], mapped[1], "Request refused", error.message);
  throw error;
}

/** The staff role of a user from the database, or null for everybody else. */
export async function getStaffRole(admin: Loose, userId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  const role = (data as { role?: string } | null)?.role;
  return role === "admin" || role === "moderator" ? role : null;
}

function requireEntity(key: string): Entity {
  const entity = entityByKey(key);
  if (!entity) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", `Unknown entity ${key}.`);
  return entity;
}

const clean = (s: string) =>
  s
    .replace(/[%_*,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseFilters(entity: Entity, raw: string | undefined): [string, string][] {
  if (!raw) return [];
  const out: [string, string][] = [];
  for (const part of raw.split(";")) {
    const at = part.indexOf(":");
    if (at < 1) continue;
    const name = part.slice(0, at);
    const value = part.slice(at + 1);
    const field = entity.fields.find((f) => f.name === name && f.filter);
    if (!field || value === "") continue;
    if (field.type === "bool" && value !== "true" && value !== "false") continue;
    if (field.type === "enum" && !field.options?.includes(value)) continue;
    out.push([name, value]);
  }
  return out;
}

/** A page of one entity: search, filters, sorting and paging all come from the registry. */
export async function listRecords(admin: Loose, q: ConsoleListQuery): Promise<ConsoleList> {
  const entity = requireEntity(q.entity);
  const columns = entity.fields
    .filter((f) => f.list || f.name === entity.idColumn)
    .map((f) => f.name);
  const from = (q.page - 1) * q.pageSize;
  let query = admin.from(entity.table).select([...new Set(columns)].join(", "), { count: "exact" });
  if (entity.baseNotNull) query = query.not(entity.baseNotNull, "is", null);

  for (const [name, value] of parseFilters(entity, q.filters)) query = query.eq(name, value);

  const term = q.q ? clean(q.q) : "";
  const searchable = entity.fields.filter((f) => f.search);
  if (term && searchable.length) {
    query = query.or(searchable.map((f) => `${f.name}.ilike.%${term}%`).join(","));
  }

  const sortField = entity.fields.find((f) => f.name === q.sort && f.sortable);
  const column = sortField?.name ?? entity.sort.column;
  const ascending = sortField ? q.dir === "asc" : entity.sort.asc;
  query = query.order(column, { ascending }).range(from, from + q.pageSize - 1);

  const { data, count, error } = await query;
  if (error) throw error;
  return { items: (data ?? []) as Row[], total: count ?? 0, page: q.page, pageSize: q.pageSize };
}

export async function getRecord(admin: Loose, entityKey: string, id: string): Promise<Row | null> {
  const entity = requireEntity(entityKey);
  if (entity.noCard) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "No card.");
  const { data, error } = await admin
    .from(entity.table)
    .select(entity.fields.map((f) => f.name).join(", "))
    .eq(entity.idColumn, id)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

/** Changes fields of one row. The role per field and the audit row are the database's job (adm_edit). */
export async function editRecord(
  admin: Loose,
  actorId: string,
  body: ConsoleEditBody,
): Promise<{ before: Row; after: Row }> {
  const entity = requireEntity(body.entity);
  // The registry knows which fields are editable at all; the database decides who may.
  for (const key of Object.keys(body.patch)) {
    if (!entity.fields.some((f) => f.name === key && f.editMin)) {
      throw new ApiError(
        422,
        ERROR_CODES.validationFailed,
        "Unprocessable Content",
        `Field ${key} is not editable.`,
        [{ field: key, message: "Поле нельзя менять" }],
      );
    }
  }
  const { data, error } = await admin.rpc("adm_edit", {
    p_actor: actorId,
    p_entity: body.entity,
    p_id: body.id,
    p_patch: body.patch,
    p_reason: body.reason,
  });
  if (error) throw toApiError(error);
  return data as { before: Row; after: Row };
}

type Params = NonNullable<ConsoleActionBody["params"]>;

async function removeLogoFile(admin: Loose, clubId: string): Promise<void> {
  const { data } = await admin.from("mgr_clubs").select("logo_path").eq("id", clubId).maybeSingle();
  const path = (data as { logo_path?: string | null } | null)?.logo_path;
  if (path)
    await admin.storage
      .from("club-logos")
      .remove([path])
      .catch(() => undefined);
}

async function runOne(
  admin: Loose,
  actorId: string,
  action: ActionKey,
  target: string,
  reason: string,
  params: Params,
): Promise<void> {
  const call = async (fn: string, args: object) => {
    const { error } = await admin.rpc(fn, { p_actor: actorId, ...args });
    if (error) throw toApiError(error);
  };
  switch (action) {
    case "freeze_market":
    case "unfreeze_market":
      return call("adm_set_frozen", {
        p_club: target,
        p_frozen: action === "freeze_market",
        p_reason: reason,
      });
    case "remove_logo": {
      await removeLogoFile(admin, target);
      return call("adm_edit", {
        p_entity: "clubs",
        p_id: target,
        p_patch: { logo_path: null },
        p_reason: reason,
      });
    }
    case "adjust_budget": {
      const amount = Number(params.amount);
      if (!Number.isInteger(amount) || amount === 0) {
        throw new ApiError(
          422,
          ERROR_CODES.validationFailed,
          "Unprocessable Content",
          "amount must be a non-zero integer.",
          [{ field: "amount", message: "Нужна ненулевая целая сумма" }],
        );
      }
      return call("adm_adjust_budget", { p_club: target, p_amount: amount, p_reason: reason });
    }
    case "make_bot":
    case "reactivate_club": {
      if (action === "make_bot") await confirmName(admin, "mgr_clubs", "name", target, params);
      return call(action === "make_bot" ? "adm_make_bot" : "adm_reactivate_club", {
        p_club: target,
        p_reason: reason,
      });
    }
    case "set_role": {
      const role = String(params.role);
      if (!["user", "moderator", "admin"].includes(role)) {
        throw new ApiError(
          422,
          ERROR_CODES.validationFailed,
          "Unprocessable Content",
          "Unknown role.",
          [{ field: "role", message: "Неизвестная роль" }],
        );
      }
      return call("adm_set_role", { p_target: target, p_role: role, p_reason: reason });
    }
    case "delete_profile": {
      if (target === actorId) {
        throw new ApiError(
          422,
          ERROR_CODES.validationFailed,
          "Unprocessable Content",
          "You cannot delete yourself.",
        );
      }
      const { data } = await admin.from("profiles").select("role").eq("id", target).maybeSingle();
      if (!data)
        throw new ApiError(404, ERROR_CODES.profileNotFound, "Not Found", "User does not exist.");
      if ((data as { role: string }).role === "admin") {
        throw new ApiError(409, ERROR_CODES.forbidden, "Conflict", "Demote the admin first.");
      }
      await confirmName(admin, "profiles", "nickname", target, params);
      // Written first: the actor must exist when the row is made, and the log must survive the deletion.
      await call("adm_log", {
        p_action: "delete_profile",
        p_entity: "profiles",
        p_entity_id: target,
        p_before: null,
        p_after: null,
        p_reason: reason,
      });
      const { error } = await admin.auth.admin.deleteUser(target);
      if (error) throw error;
      return;
    }
    case "play_rounds": {
      // The same safe-to-repeat step the scheduler runs: every match is written once by the database.
      const done = await runRounds(admin as unknown as SupabaseClient<Database>);
      await call("adm_log", {
        p_action: "play_rounds",
        p_entity: "leagues",
        p_entity_id: target,
        p_before: null,
        p_after: null,
        p_reason: reason,
        p_meta: done,
      });
      return;
    }
  }
}

/** The typed confirmation must equal the name (or the nickname) of the target. */
async function confirmName(
  admin: Loose,
  table: string,
  column: string,
  id: string,
  params: Params,
) {
  const { data } = await admin.from(table).select(column).eq("id", id).maybeSingle();
  const name = (data as Row | null)?.[column];
  if (!data || String(params.confirm ?? "").trim() !== String(name ?? id)) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "Confirmation does not match.",
      [{ field: "confirm", message: "Подтверждение не совпадает" }],
    );
  }
}

/** Runs one action for one or many targets; each target has its own result, none stops the others. */
export async function runAction(
  admin: Loose,
  actorId: string,
  body: ConsoleActionBody,
): Promise<ConsoleActionResult> {
  const role = await getStaffRole(admin, actorId);
  if (!role || !canRun(role, body.action)) {
    throw new ApiError(403, ERROR_CODES.forbidden, "Forbidden", "Your role cannot do this.");
  }
  const def = ACTIONS[body.action];
  if (body.targets.length > 1 && !def.bulk) {
    throw new ApiError(
      422,
      ERROR_CODES.validationFailed,
      "Unprocessable Content",
      "This action works on one row.",
    );
  }
  const results: ConsoleActionResult["results"] = [];
  for (const target of body.targets) {
    try {
      await runOne(admin, actorId, body.action, target, body.reason, body.params ?? {});
      results.push({ target, ok: true });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      results.push({ target, ok: false, error: error.detail ?? error.title });
    }
  }
  log("info", "admin.action", {
    actor: actorId,
    action: body.action,
    targets: body.targets.length,
  });
  return { results };
}

/** The signals of suspicious activity with the club names; nothing here punishes anybody. */
export async function listSuspicious(admin: Loose): Promise<SuspiciousItem[]> {
  const { data, error } = await admin.rpc("adm_suspicious");
  if (error) throw error;
  const rows = (data ?? []) as {
    kind: string;
    subject: string;
    club_ids: string[];
    score: number;
    details: Row;
    reviewed_at: string | null;
  }[];
  const ids = [...new Set(rows.flatMap((r) => r.club_ids))];
  const names = new Map<string, string>();
  if (ids.length) {
    const clubs = await admin.from("mgr_clubs").select("id, name").in("id", ids);
    if (clubs.error) throw clubs.error;
    for (const c of (clubs.data ?? []) as { id: string; name: string }[]) names.set(c.id, c.name);
  }
  return rows.map((r) => ({
    kind: r.kind,
    subject: r.subject,
    clubIds: r.club_ids,
    score: r.score,
    details: r.details,
    reviewedAt: r.reviewed_at,
    clubs: r.club_ids.map((id) => ({ id, name: names.get(id) ?? id })),
  }));
}

export async function markReviewed(
  admin: Loose,
  actorId: string,
  body: { kind: string; subject: string; note?: string },
): Promise<void> {
  const { error } = await admin.rpc("adm_mark_reviewed", {
    p_actor: actorId,
    p_kind: body.kind,
    p_subject: body.subject,
    p_note: body.note ?? null,
  });
  if (error) throw toApiError(error);
}
