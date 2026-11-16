import type { SupabaseClient } from "@supabase/supabase-js";
import { FALLBACK_COLORS } from "@/lib/manager/palette";
import { managerLogoUrl } from "@/lib/manager/logo-url";
import type { Rating, RatingQuery } from "@/server/api/v1/schemas/manager-rating";
import type { Database } from "@/types/database";
import { memberClub } from "./auction";

type Db = SupabaseClient<Database>;

/**
 * The rating of the real clubs by Elo (bots are not in it), with their league. Read with the service
 * role after the caller is known: the rating is open to every manager, the rest of other leagues is not.
 * Ties: by name, then id, so the order (and my place) is stable.
 */
export async function getRating(admin: Db, userId: string, query: RatingQuery): Promise<Rating> {
  const me = await memberClub(admin, userId);
  const mine = await admin.from("mgr_clubs").select("id, name, elo").eq("id", me.id).single();
  if (mine.error) throw mine.error;

  const from = (query.page - 1) * query.pageSize;
  let list = admin
    .from("mgr_clubs")
    .select(
      "id, name, elo, elo_peak, primary_color, secondary_color, logo_path, league:mgr_leagues(number)",
      { count: "exact" },
    )
    .eq("is_bot", false)
    .not("league_id", "is", null);
  if (query.scope === "league") {
    // No league yet: nobody to show.
    list = list.eq("league_id", me.league_id ?? "00000000-0000-0000-0000-000000000000");
  }
  const page = await list
    .order("elo", { ascending: false })
    .order("name")
    .order("id")
    .range(from, from + query.pageSize - 1);
  if (page.error) throw page.error;

  // My place in the whole rating: clubs above me by the same order.
  const above = await admin
    .from("mgr_clubs")
    .select("id", { count: "exact", head: true })
    .eq("is_bot", false)
    .not("league_id", "is", null)
    .or(
      `elo.gt.${mine.data.elo},and(elo.eq.${mine.data.elo},name.lt."${mine.data.name.replace(/"/g, '""')}"),and(elo.eq.${mine.data.elo},name.eq."${mine.data.name.replace(/"/g, '""')}",id.lt.${me.id})`,
    );
  if (above.error) throw above.error;

  return {
    items: (page.data ?? []).map((c, index) => ({
      rank: from + index + 1,
      clubId: c.id,
      name: c.name,
      primaryColor: c.primary_color ?? FALLBACK_COLORS.primary,
      secondaryColor: c.secondary_color ?? FALLBACK_COLORS.secondary,
      logoUrl: managerLogoUrl(c.logo_path),
      leagueNumber: (c.league as { number: number } | null)?.number ?? null,
      elo: c.elo,
      eloPeak: c.elo_peak,
      isMine: c.id === me.id,
    })),
    total: page.count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    mine: me.league_id ? { rank: (above.count ?? 0) + 1, elo: mine.data.elo } : null,
  };
}
