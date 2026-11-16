import { randomBytes } from "node:crypto";
import { errorFields, log } from "@/lib/log";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLUB_COLORS } from "@/lib/manager/palette";
import { realRating } from "@/lib/manager/attributes";
import { ApiError, ERROR_CODES } from "@/server/api/v1/problem";
import type {
  Club,
  CreateClubBody,
  ManagerCities,
  ManagerClubView,
  Player,
  PlayerSummary,
} from "@/server/api/v1/schemas/manager";
import type { Database, Tables } from "@/types/database";
import { getNextMatch, placeClub } from "./league";
import { generateSquad } from "./squad";
import type { CountryCode } from "./names";

type Db = SupabaseClient<Database>;

/** Until more countries are open, every club is Belarusian (docs/MANAGER.md). */
const DEFAULT_COUNTRY: CountryCode = "BY";

type ClubRow = Tables<"mgr_clubs"> & { city: { id: number; name: string } | null };

function toClub(row: ClubRow): Club {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    city: { id: row.city?.id ?? row.city_id, name: row.city?.name ?? "" },
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toPlayerSummary(row: Tables<"mgr_players">): PlayerSummary {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    position: row.position as PlayerSummary["position"],
    age: row.age,
    citizenship: row.citizenship,
    overall: row.ovr,
    real: realRating(row.ovr, { form: row.form, fitness: row.fitness, morale: row.morale }),
    form: row.form,
    fitness: row.fitness,
    morale: row.morale,
    injuredUntil: row.injured_until ? new Date(row.injured_until).toISOString() : null,
    trainingFocus: row.training_focus,
  };
}

const POSITION_ORDER = { GK: 0, DEF: 1, MID: 2, FWD: 3 } as const;

export async function listCities(supabase: Db): Promise<ManagerCities> {
  const { data, error } = await supabase
    .from("mgr_cities")
    .select("id, name")
    .eq("country", DEFAULT_COUNTRY)
    .order("name");
  if (error) throw error;
  return { cities: data ?? [], colors: [...CLUB_COLORS] };
}

/** The caller's club and squad (RLS shows a user nothing else); club is null before they make one. */
export async function getMyClub(supabase: Db, userId: string): Promise<ManagerClubView> {
  const { data: club, error } = await supabase
    .from("mgr_clubs")
    .select("*, city:mgr_cities(id, name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!club) return { club: null, players: [], leagueNumber: null, nextMatch: null };

  const { data: players, error: playersError } = await supabase
    .from("mgr_players")
    .select("*")
    .eq("club_id", club.id);
  if (playersError) throw playersError;

  const squad = (players ?? [])
    .map(toPlayerSummary)
    .sort(
      (a, b) =>
        POSITION_ORDER[a.position] - POSITION_ORDER[b.position] ||
        b.overall - a.overall ||
        a.lastName.localeCompare(b.lastName, "ru"),
    );
  const [league, nextMatch] = await Promise.all([
    club.league_id
      ? supabase.from("mgr_leagues").select("number").eq("id", club.league_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    club.league_id ? getNextMatch(supabase, club.id) : Promise.resolve(null),
  ]);
  if (league.error) throw league.error;
  return {
    club: toClub(club as ClubRow),
    players: squad,
    leagueNumber: league.data?.number ?? null,
    nextMatch,
  };
}

/** A player of the caller's club with all attributes; someone else's player is 404 (RLS). */
export async function getMyPlayer(supabase: Db, playerId: string): Promise<Player> {
  const { data: row, error } = await supabase
    .from("mgr_players")
    .select("*, academy:mgr_clubs!mgr_players_academy_club_id_fkey(name)")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw error;
  if (!row) throw new ApiError(404, ERROR_CODES.notFound, "Not Found", "Player not found.");

  const { data: attributes, error: attributesError } = await supabase
    .from("mgr_player_attributes")
    .select("attribute, value")
    .eq("player_id", playerId);
  if (attributesError) throw attributesError;

  const academy = (row as { academy?: { name: string } | null }).academy;
  return {
    ...toPlayerSummary(row),
    academyClubName: academy?.name ?? null,
    attributes: (attributes ?? [])
      .map((a) => ({ key: a.attribute, value: a.value }))
      .sort((a, b) => b.value - a.value),
  };
}

/**
 * Makes the club and generates its squad once. The squad is built here and written in a single
 * transaction by `mgr_create_club`, which only the server may call, so nobody can write a squad of
 * their own or make the generator run again.
 */
export async function createClub(
  admin: Db,
  supabase: Db,
  userId: string,
  body: CreateClubBody,
): Promise<Club> {
  const seed = randomBytes(16).toString("hex");
  const squad = generateSquad(seed, DEFAULT_COUNTRY);

  const { data: clubId, error } = await admin.rpc("mgr_create_club", {
    p_user: userId,
    p_name: body.name,
    p_city: body.cityId,
    p_primary: body.primaryColor,
    p_secondary: body.secondaryColor,
    p_seed: seed,
    p_players: squad.map((p) => ({
      first_name: p.firstName,
      last_name: p.lastName,
      position: p.position,
      age: p.age,
      potential: p.potential,
      ovr: p.ovr,
      attributes: p.attributes,
    })),
  });
  if (error) {
    if (error.message.includes("manager.club_exists")) {
      throw new ApiError(
        409,
        ERROR_CODES.managerClubExists,
        "Conflict",
        "You already have a club.",
      );
    }
    if (error.message.includes("manager.name_taken")) {
      throw new ApiError(409, ERROR_CODES.managerNameTaken, "Conflict", "This club name is taken.");
    }
    if (error.message.includes("manager.city_unknown")) {
      throw new ApiError(
        422,
        ERROR_CODES.validationFailed,
        "Unprocessable Content",
        "Unknown city.",
        [{ field: "cityId", message: "Choose a city from the list." }],
      );
    }
    throw error;
  }

  // The league is part of making a club, but a failure here must not undo the club: the page
  // tries again on the next visit (placeClubQuietly).
  if (clubId) await placeClubQuietly(admin, clubId);

  const view = await getMyClub(supabase, userId);
  if (!view.club) throw new Error("club was created but cannot be read");
  return view.club;
}

/** Puts the club into a league; logs and goes on when it cannot (the next visit tries again). */
export async function placeClubQuietly(admin: Db, clubId: string): Promise<boolean> {
  try {
    await placeClub(admin, clubId);
    return true;
  } catch (error) {
    log("error", "manager.place_failed", { clubId, ...errorFields(error) });
    return false;
  }
}
