/** Roles of the staff and what each may do in the admin console (docs/ADMIN.md, D-139). */
export type Role = "user" | "moderator" | "admin";

const RANK: Record<Role, number> = { user: 0, moderator: 1, admin: 2 };

export function rank(role: string | null | undefined): number {
  return role && role in RANK ? RANK[role as Role] : 0;
}

/** Is `role` at least `min`? The database checks the same again (adm_require). */
export function atLeast(role: string | null | undefined, min: Role): boolean {
  return rank(role) >= rank(min);
}

export const isStaff = (role: string | null | undefined) => atLeast(role, "moderator");

export type ActionKey =
  | "freeze_market"
  | "unfreeze_market"
  | "remove_logo"
  | "adjust_budget"
  | "make_bot"
  | "reactivate_club"
  | "set_role"
  | "delete_profile"
  | "play_rounds";

export type ActionDef = {
  min: Role;
  entity: "clubs" | "profiles" | "leagues";
  /** May be applied to many rows at once from the list. */
  bulk: boolean;
  /** Needs a typed confirmation (the nickname or the club name). */
  confirm?: boolean;
};

/** A moderator handles names, pictures and the market freeze; money, roles and rounds are admin only. */
export const ACTIONS: Record<ActionKey, ActionDef> = {
  freeze_market: { min: "moderator", entity: "clubs", bulk: true },
  unfreeze_market: { min: "moderator", entity: "clubs", bulk: true },
  remove_logo: { min: "moderator", entity: "clubs", bulk: true },
  adjust_budget: { min: "admin", entity: "clubs", bulk: false },
  make_bot: { min: "admin", entity: "clubs", bulk: false, confirm: true },
  reactivate_club: { min: "admin", entity: "clubs", bulk: false },
  set_role: { min: "admin", entity: "profiles", bulk: false },
  delete_profile: { min: "admin", entity: "profiles", bulk: false, confirm: true },
  play_rounds: { min: "admin", entity: "leagues", bulk: false },
};

export const ACTION_KEYS = Object.keys(ACTIONS) as [ActionKey, ...ActionKey[]];

export function canRun(role: string | null | undefined, action: ActionKey): boolean {
  return atLeast(role, ACTIONS[action].min);
}
