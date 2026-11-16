import { getMessages } from "@/i18n/server";
import { PredictionsTabsNav } from "./predictions-tabs-nav";

/** Predictions, the rating of the players and the table of the championship: one section, three tabs. */
export function PredictionsTabs() {
  const t = getMessages().nav;
  return (
    <PredictionsTabsNav
      label={t.predictionsTabs}
      tabs={[
        { href: "/predictions", label: t.predictions },
        { href: "/rating", label: t.rating },
        { href: "/standings", label: t.standings },
      ]}
    />
  );
}
