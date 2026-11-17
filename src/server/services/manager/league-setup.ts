import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLUB_COLORS } from "@/lib/manager/palette";
import { buildSchedule, firstKickoff } from "@/lib/manager/schedule";
import type { Database, Json } from "@/types/database";
import { generateSquad } from "./squad";
import { makeRandom } from "./random";

type Db = SupabaseClient<Database>;

const BOT_SUFFIXES = [
  "Сокол",
  "Вымпел",
  "Гранит",
  "Метеор",
  "Ураган",
  "Маяк",
  "Орбита",
  "Прибой",
  "Рассвет",
  "Таран",
  "Факел",
  "Янтарь",
  "Ястреб",
  "Бастион",
  "Атлант",
  "Зубр",
];

/** 20 bot clubs with squads of the same kind as everyone's. */
function makeBots(cities: { id: number; name: string }[]) {
  const random = makeRandom(randomBytes(16).toString("hex"));
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
  return Array.from({ length: 20 }, () => {
    const seed = randomBytes(16).toString("hex");
    const city = pick(cities);
    const primary = pick(CLUB_COLORS);
    const secondary = pick(CLUB_COLORS.filter((c) => c !== primary));
    return {
      name: `${pick(BOT_SUFFIXES)} ${city.name}`,
      city_id: city.id,
      primary_color: primary,
      secondary_color: secondary,
      seed,
      players: generateSquad(seed, "BY").map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        position: p.position,
        age: p.age,
        potential: p.potential,
        ovr: p.ovr,
        attributes: p.attributes,
      })),
    };
  });
}

/**
 * Puts a club that has no league into one: the place of a bot of an existing league, or a new
 * league of 20 bots (made in one transaction together with the club's place in it).
 */
export async function placeClub(admin: Db, clubId: string): Promise<string> {
  const joined = await admin.rpc("mgr_join_league", { p_club: clubId });
  if (joined.error) throw joined.error;
  if (joined.data) return joined.data;

  const { data: cities, error } = await admin.from("mgr_cities").select("id, name");
  if (error) throw error;
  const opened = await admin.rpc("mgr_open_league", {
    p_club: clubId,
    p_first_kickoff: firstKickoff(new Date()).toISOString(),
    p_bots: makeBots(cities ?? []) as unknown as Json,
    p_matches: buildSchedule() as unknown as Json,
  });
  if (opened.error) throw opened.error;
  return opened.data;
}
