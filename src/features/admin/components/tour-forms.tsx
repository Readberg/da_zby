"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { localInputToUtcIso, utcIsoToLocalInput } from "@/lib/local-time";
import { ru } from "@/messages/ru";

type Errors = { number?: string; title?: string; deadline?: string };

type TourValues = { number: number; title: string | null; deadlineOverride: string | null };

/**
 * Create form (no `tour`) and edit form of one tour. The deadline field is optional: empty means
 * "10 minutes before the first match"; a value pins the deadline (shown in the admin's time zone).
 */
export function TourForm({
  seasonId,
  tour,
  offsetMinutes,
  disabled = false,
}: {
  seasonId: string;
  tour?: { id: string } & TourValues;
  offsetMinutes: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [number, setNumber] = useState(tour ? String(tour.number) : "");
  const [title, setTitle] = useState(tour?.title ?? "");
  const [deadline, setDeadline] = useState(
    utcIsoToLocalInput(tour?.deadlineOverride, offsetMinutes),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const prefix = tour ? `tour-${tour.id}` : "tour-new";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const next: Errors = {};
    const parsedNumber = number.trim() === "" ? undefined : Number(number);
    if (
      parsedNumber !== undefined &&
      (!Number.isInteger(parsedNumber) || parsedNumber < 1 || parsedNumber > 500)
    ) {
      next.number = ru.admin.tours.numberError;
    }
    if (tour && parsedNumber === undefined) next.number = ru.admin.tours.numberError;
    const deadlineIso = deadline.trim() === "" ? null : localInputToUtcIso(deadline, offsetMinutes);
    if (deadline.trim() !== "" && !deadlineIso) next.deadline = ru.admin.tours.deadlineError;
    if (title.trim().length > 100) next.title = ru.admin.tours.titleError;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    setBusy(true);
    setSaved(false);
    try {
      const fields = {
        title: title.trim() === "" ? null : title.trim(),
        deadlineOverride: deadlineIso,
      };
      if (tour) {
        await api("/admin/tours", {
          method: "PATCH",
          json: { id: tour.id, number: parsedNumber, ...fields },
        });
      } else {
        await api("/admin/tours", {
          method: "POST",
          json: {
            seasonId,
            ...(parsedNumber !== undefined ? { number: parsedNumber } : {}),
            ...fields,
          },
        });
        setNumber("");
        setTitle("");
        setDeadline("");
      }
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setErrors({
        number:
          cause instanceof ApiClientError
            ? (cause.fieldError("number") ?? ru.admin.checkFields)
            : ru.admin.checkFields,
      });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!tour) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await api("/admin/tours", { method: "DELETE", json: { id: tour.id } });
      router.push(`/admin/seasons/${seasonId}`);
      router.refresh();
    } catch (cause) {
      const inUse = cause instanceof ApiClientError && cause.problem.code === "admin.in_use";
      setRemoveError(inUse ? ru.admin.tours.inUse : ru.admin.tours.deleteFailed);
      setRemoving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
        <TextField
          id={`${prefix}-number`}
          label={ru.admin.tours.number}
          hint={tour ? undefined : ru.admin.tours.numberHint}
          type="number"
          inputMode="numeric"
          min={1}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          error={errors.number}
        />
        <TextField
          id={`${prefix}-title`}
          label={ru.admin.tours.titleLabel}
          hint={ru.admin.tours.titleHint}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
        />
        <TextField
          id={`${prefix}-deadline`}
          label={ru.admin.tours.deadline}
          hint={ru.admin.tours.deadlineHint}
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          error={errors.deadline}
        />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={busy} disabled={disabled}>
          {tour ? ru.admin.save : ru.admin.tours.create}
        </Button>
        {tour && (
          <Button
            type="button"
            variant="text"
            loading={removing}
            disabled={disabled}
            onClick={remove}
          >
            {ru.admin.tours.delete}
          </Button>
        )}
        {saved && <span className="text-sm">{ru.admin.saved}</span>}
      </div>
      {removeError && (
        <p role="alert" className="text-sm text-danger">
          {removeError}
        </p>
      )}
    </form>
  );
}
