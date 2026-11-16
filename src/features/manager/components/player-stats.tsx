import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Dictionary } from "@/i18n/dictionaries";
import type { PlayerStats } from "@/server/api/v1/schemas/manager-stats";

/** Statistics of one player by season and for the career. It knows nothing about the server. */
export function PlayerStatsBlock({
  stats,
  t,
  headingLevel = 3,
}: {
  stats: PlayerStats;
  t: Dictionary["manager"];
  headingLevel?: 2 | 3 | 4;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const s = t.stats;
  const keeper = stats.position === "GK";
  const lines = [
    ...stats.seasons.map((row) => ({
      key: `${row.season}:${row.clubName}`,
      label: s.season.replace("{n}", String(row.season)),
      club: row.clubName,
      line: row,
    })),
    ...(stats.seasons.length > 1
      ? [{ key: "career", label: s.career, club: "", line: stats.career }]
      : []),
  ];
  return (
    <section aria-labelledby="stats-title" className="flex flex-col gap-3">
      <Heading id="stats-title" className="text-lg">
        {s.title}
      </Heading>
      {lines.length === 0 ? (
        <p className="text-muted">{s.empty}</p>
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{s.columns.season}</TH>
                <TH className="hidden sm:table-cell">{s.columns.club}</TH>
                <TH className="text-right">{s.columns.matches}</TH>
                <TH className="text-right">{s.columns.goals}</TH>
                <TH className="text-right">{s.columns.assists}</TH>
                <TH className="hidden text-right sm:table-cell">{s.columns.shots}</TH>
                <TH className="hidden text-right sm:table-cell">{s.columns.injuries}</TH>
                {keeper && <TH className="text-right">{s.columns.cleanSheets}</TH>}
              </tr>
            </THead>
            <TBody>
              {lines.map(({ key, label, club, line }) => (
                <TR key={key}>
                  <TD>{label}</TD>
                  <TD className="hidden sm:table-cell">{club}</TD>
                  <TD className="text-right">{line.matches}</TD>
                  <TD className="text-right">{line.goals}</TD>
                  <TD className="text-right">{line.assists}</TD>
                  <TD className="hidden text-right sm:table-cell">{line.shots}</TD>
                  <TD className="hidden text-right sm:table-cell">{line.injuries}</TD>
                  {keeper && <TD className="text-right">{line.cleanSheets}</TD>}
                </TR>
              ))}
            </TBody>
          </Table>
          <p className="text-sm text-muted">{s.hint}</p>
        </>
      )}
    </section>
  );
}
