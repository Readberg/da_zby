"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { tournamentFieldsSchema } from "@/lib/admin-schema";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";
import type { Tournament } from "@/server/api/v1/schemas/admin-catalog";

type Errors = Partial<Record<"name" | "slug" | "pointsExact" | "pointsOutcome", string>>;
type Status = "idle" | "saving" | "saved" | "failed";

/** Create form (no `tournament`) and edit form of one tournament, with the re-grade button. */
export function TournamentForm({
  tournament,
  onCreated,
}: {
  tournament?: Tournament;
  /** Called with the new tournament as soon as the server confirmed it. */
  onCreated?: (tournament: Tournament) => void;
}) {
  const router = useRouter();
  const editing = Boolean(tournament);
  const [name, setName] = useState(tournament?.name ?? "");
  const [slug, setSlug] = useState(tournament?.slug ?? "");
  const [pointsExact, setPointsExact] = useState(String(tournament?.pointsExact ?? 3));
  const [pointsOutcome, setPointsOutcome] = useState(String(tournament?.pointsOutcome ?? 1));
  const [isActive, setIsActive] = useState(tournament?.isActive ?? true);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [recalc, setRecalc] = useState<"idle" | "running" | string>("idle");
  const prefix = tournament ? `t-${tournament.id}` : "t-new";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;

    const parsed = tournamentFieldsSchema.safeParse({
      name,
      slug,
      pointsExact: pointsExact.trim() === "" ? NaN : Number(pointsExact),
      pointsOutcome: pointsOutcome.trim() === "" ? NaN : Number(pointsOutcome),
      isActive,
    });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Errors | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setStatus("failed");
      return;
    }

    setErrors({});
    setStatus("saving");
    try {
      if (tournament) {
        await api("/admin/tournaments", {
          method: "PATCH",
          json: { id: tournament.id, ...parsed.data },
        });
      } else {
        const created = await api<Tournament>("/admin/tournaments", {
          method: "POST",
          json: parsed.data,
        });
        onCreated?.(created);
        setName("");
        setSlug("");
      }
      setStatus("saved");
      router.refresh();
    } catch (cause) {
      const next: Errors = {};
      if (cause instanceof ApiClientError) {
        for (const key of ["name", "slug", "pointsExact", "pointsOutcome"] as const) {
          const message = cause.fieldError(key);
          if (message) next[key] = message;
        }
      }
      setErrors(next);
      setStatus("failed");
    }
  }

  async function recalculate() {
    if (!tournament) return;
    setRecalc("running");
    try {
      const result = await api<{ seasons: number }>("/admin/tournaments/recalculate", {
        method: "POST",
        json: { tournamentId: tournament.id },
      });
      setRecalc(ru.admin.tournaments.recalculated.replace("{n}", String(result.seasons)));
      router.refresh();
    } catch {
      setRecalc(ru.admin.tournaments.recalculateFailed);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`${prefix}-name`}
          label={ru.admin.tournaments.name}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus("idle");
          }}
          error={errors.name}
        />
        <TextField
          id={`${prefix}-slug`}
          label={ru.admin.tournaments.slug}
          hint={ru.admin.tournaments.slugHint}
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setStatus("idle");
          }}
          error={errors.slug}
        />
        <TextField
          id={`${prefix}-exact`}
          label={ru.admin.tournaments.pointsExact}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={pointsExact}
          onChange={(e) => {
            setPointsExact(e.target.value);
            setStatus("idle");
          }}
          error={errors.pointsExact}
        />
        <TextField
          id={`${prefix}-outcome`}
          label={ru.admin.tournaments.pointsOutcome}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={pointsOutcome}
          onChange={(e) => {
            setPointsOutcome(e.target.value);
            setStatus("idle");
          }}
          error={errors.pointsOutcome}
        />
      </div>

      <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => {
            setIsActive(e.target.checked);
            setStatus("idle");
          }}
          className="h-5 w-5 accent-ink"
        />
        {ru.admin.tournaments.active}
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={status === "saving"}>
          {editing ? ru.admin.save : ru.admin.tournaments.create}
        </Button>
        {editing && (
          <Button
            type="button"
            variant="secondary"
            onClick={recalculate}
            loading={recalc === "running"}
          >
            {ru.admin.tournaments.recalculate}
          </Button>
        )}
        <p role="status" aria-live="polite" className="text-sm">
          {status === "saved" && <span>{ru.admin.saved}</span>}
          {status === "failed" && <span className="text-danger">{ru.admin.checkFields}</span>}
          {recalc !== "idle" && recalc !== "running" && <span>{recalc}</span>}
        </p>
      </div>
    </form>
  );
}
