import Link from "next/link";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getMessages } from "@/i18n/server";
import type { ManagerClubView } from "@/server/api/v1/schemas/manager";

/** The colours of a club as two stripes; they are content of the club, so they come from the data. */
export function ClubColors({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 overflow-hidden rounded-full border border-line"
    >
      <span className="w-1/2" style={{ backgroundColor: primary }} />
      <span className="w-1/2" style={{ backgroundColor: secondary }} />
    </span>
  );
}

/** My club: its name, city and the squad ordered by position and rating. */
export function ClubView({ view }: { view: ManagerClubView }) {
  const t = getMessages().manager;
  const { club, players } = view;
  if (!club) return null;
  const country = t.countries[club.country as keyof typeof t.countries] ?? club.country;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <ClubColors primary={club.primaryColor} secondary={club.secondaryColor} />
        <div>
          <h2 className="text-h3 sm:text-h2">{club.name}</h2>
          <p className="text-muted">
            {t.clubFrom.replace("{city}", club.city.name).replace("{country}", country)}
          </p>
        </div>
      </div>

      <section aria-labelledby="squad-title" className="flex flex-col gap-3">
        <h3 id="squad-title" className="text-lg">
          {t.squadTitle}
        </h3>
        <p className="text-sm text-muted">{t.squadCount.replace("{n}", String(players.length))}</p>
        <Table>
          <THead>
            <tr>
              <TH>{t.columns.player}</TH>
              <TH>{t.columns.position}</TH>
              <TH>{t.columns.age}</TH>
              <TH className="text-right">{t.columns.overall}</TH>
              <TH className="text-right">{t.columns.real}</TH>
            </tr>
          </THead>
          <TBody>
            {players.map((player) => (
              <TR key={player.id}>
                <TD>
                  <Link href={`/manager/players/${player.id}`} className="font-semibold underline">
                    {player.firstName} {player.lastName}
                  </Link>
                </TD>
                <TD title={t.positions[player.position]}>{t.positionShort[player.position]}</TD>
                <TD>{player.age}</TD>
                <TD className="text-right font-display text-lg text-accent">{player.overall}</TD>
                <TD className="text-right text-muted">{player.real.toFixed(1)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
