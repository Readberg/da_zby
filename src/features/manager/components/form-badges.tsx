import { getMessages } from "@/i18n/server";
import { cx } from "@/lib/cx";
import type { FormResult } from "@/lib/manager/table";

const TONE: Record<FormResult, string> = {
  W: "border-success-ink text-success-ink",
  D: "border-line text-muted",
  L: "border-danger text-danger",
};

/** One result for my club: colour and a letter, with the full word for a screen reader. */
export function ResultMark({ result, className }: { result: FormResult; className?: string }) {
  const t = getMessages().manager.form;
  return (
    <span
      role="img"
      aria-label={t.words[result]}
      title={t.words[result]}
      className={cx(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border text-[11px] font-bold leading-none",
        TONE[result],
        className,
      )}
    >
      <span aria-hidden="true">{t.letters[result]}</span>
    </span>
  );
}

/** The last results of a club, oldest first. */
export function FormBadges({ results }: { results: FormResult[] }) {
  const t = getMessages().manager.form;
  if (results.length === 0) return <span className="text-muted">–</span>;
  return (
    <span role="group" aria-label={t.label} className="inline-flex gap-1">
      {results.map((result, index) => (
        <ResultMark key={index} result={result} />
      ))}
    </span>
  );
}
