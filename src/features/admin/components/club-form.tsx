"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ClubLogo } from "@/components/ui/club-logo";
import { TextField } from "@/components/ui/field";
import { clubFieldsSchema } from "@/lib/admin-schema";
import { ApiClientError, api } from "@/lib/api-client";
import { fieldErrorsFromIssues } from "@/lib/form-errors";
import { CLUB_LOGO_ACCEPT, buildClubLogoPath, validateClubLogo } from "@/lib/club-logo";
import { normalizeClubLogo } from "@/lib/club-logo-normalize";
import { createClient } from "@/lib/supabase/client";
import { ru } from "@/messages/ru";
import type { Club } from "@/server/api/v1/schemas/admin-catalog";

type Errors = Partial<Record<"name" | "shortName" | "logo", string>>;
type Status = "idle" | "saving" | "saved" | "failed";

/** Create form (no `club`) and edit form of one club, with logo upload and delete. */
export function ClubForm({
  club,
  onCreated,
  onDeleted,
}: {
  club?: Club;
  onCreated?: (club: Club) => void;
  onDeleted?: (id: string) => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(club?.name ?? "");
  const [shortName, setShortName] = useState(club?.shortName ?? "");
  const [logoPath, setLogoPath] = useState<string | null>(club?.logoPath ?? null);
  const [logoUrl, setLogoUrl] = useState<string | null>(club?.logoUrl ?? null);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const prefix = club ? `club-${club.id}` : "club-new";

  async function onChooseLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;

    setErrors((current) => ({ ...current, logo: undefined }));
    setUploading(true);
    try {
      // Every logo is stored on a square canvas (see normalizeClubLogo), so all look alike.
      const isPicture = ["image/jpeg", "image/png", "image/webp"].includes(picked.type);
      const file = isPicture && picked.size > 0 ? await normalizeClubLogo(picked) : picked;
      const problem = validateClubLogo(file);
      if (problem) {
        setErrors((current) => ({ ...current, logo: ru.admin.clubs.logoErrors[problem] }));
        return;
      }
      const path = buildClubLogoPath(file.type, crypto.randomUUID());
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("club-logos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      setLogoPath(path);
      setLogoUrl(URL.createObjectURL(file));
      setStatus("idle");
    } catch {
      setErrors((current) => ({ ...current, logo: ru.admin.clubs.logoErrors.upload }));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;

    const parsed = clubFieldsSchema.safeParse({ name, shortName, logoPath });
    if (!parsed.success) {
      setErrors(fieldErrorsFromIssues<keyof Errors>(parsed.error.issues, ["logo"]));
      setStatus("failed");
      return;
    }

    setErrors({});
    setStatus("saving");
    try {
      if (club) {
        await api("/admin/clubs", { method: "PATCH", json: { id: club.id, ...parsed.data } });
      } else {
        const created = await api<Club>("/admin/clubs", { method: "POST", json: parsed.data });
        onCreated?.(created);
        setName("");
        setShortName("");
        setLogoPath(null);
        setLogoUrl(null);
      }
      setStatus("saved");
      router.refresh();
    } catch (cause) {
      const next: Errors = {};
      if (cause instanceof ApiClientError) {
        for (const key of ["name", "shortName"] as const) {
          const message = cause.fieldError(key);
          if (message) next[key] = message;
        }
      }
      setErrors(next);
      setStatus("failed");
    }
  }

  async function remove() {
    if (!club) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await api("/admin/clubs", { method: "DELETE", json: { id: club.id } });
      onDeleted?.(club.id);
      router.refresh();
    } catch (cause) {
      const inUse = cause instanceof ApiClientError && cause.problem.code === "admin.in_use";
      setRemoveError(inUse ? ru.admin.clubs.inUse : ru.admin.clubs.deleteFailed);
      setRemoving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-start gap-2">
          <ClubLogo src={logoUrl} name={name || ru.admin.clubs.noLogo} size={80} />
          <input
            ref={fileInput}
            type="file"
            accept={CLUB_LOGO_ACCEPT}
            onChange={onChooseLogo}
            className="sr-only"
            aria-label={ru.admin.clubs.chooseLogo}
            tabIndex={-1}
          />
          <Button
            type="button"
            variant="text"
            loading={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {logoUrl ? ru.admin.clubs.replaceLogo : ru.admin.clubs.chooseLogo}
          </Button>
        </div>
        <div className="grid min-w-60 flex-1 gap-4 sm:grid-cols-2">
          <TextField
            id={`${prefix}-name`}
            label={ru.admin.clubs.name}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus("idle");
            }}
            error={errors.name}
          />
          <TextField
            id={`${prefix}-short`}
            label={ru.admin.clubs.shortName}
            hint={ru.admin.clubs.shortNameHint}
            value={shortName}
            onChange={(e) => {
              setShortName(e.target.value);
              setStatus("idle");
            }}
            error={errors.shortName}
          />
        </div>
      </div>
      {errors.logo && (
        <p role="alert" className="text-sm text-danger">
          {errors.logo}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={status === "saving"}>
          {club ? ru.admin.save : ru.admin.clubs.create}
        </Button>
        {club && (
          <Button type="button" variant="text" onClick={remove} loading={removing}>
            {ru.admin.clubs.delete}
          </Button>
        )}
        <p role="status" aria-live="polite" className="text-sm">
          {status === "saved" && <span>{ru.admin.saved}</span>}
          {status === "failed" && <span className="text-danger">{ru.admin.checkFields}</span>}
        </p>
      </div>
      {removeError && (
        <p role="alert" className="text-sm text-danger">
          {removeError}
        </p>
      )}
    </form>
  );
}
