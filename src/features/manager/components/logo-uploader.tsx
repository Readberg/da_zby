"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { AVATAR_ACCEPT, buildAvatarPath, validateAvatarFile } from "@/lib/avatar-file";
import { createClient } from "@/lib/supabase/client";
import { useManager } from "./manager-provider";

/** The part of a public storage URL after the bucket name: the path of the file inside it. */
function pathOfUrl(url: string | null): string | null {
  return url?.split("/avatars/")[1] ?? null;
}

/**
 * The logo of the club: the owner uploads a picture (PNG, JPEG or WebP up to 2 MB) into his own
 * folder of the public bucket, and the club keeps the path. Without a logo the colours are shown.
 */
export function LogoUploader({ userId, logoUrl }: { userId: string; logoUrl: string | null }) {
  const { t } = useManager();
  const lines = t.logo;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeFile(path: string | null) {
    if (!path) return;
    // Best effort: a file that stays is harmless and nobody points at it.
    await createClient().storage.from("avatars").remove([path]);
  }

  async function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validateAvatarFile(file);
    if (problem) {
      setError(lines.errors[problem]);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const path = buildAvatarPath(userId, file.type, `club-${crypto.randomUUID()}`);
      const { error: uploadError } = await createClient()
        .storage.from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      await api("/manager/club/logo", { method: "PUT", json: { path } });
      await removeFile(pathOfUrl(logoUrl));
      router.refresh();
    } catch {
      setError(lines.errors.upload);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      await api("/manager/club/logo", { method: "PUT", json: { path: null } });
      await removeFile(pathOfUrl(logoUrl));
      router.refresh();
    } catch {
      setError(lines.errors.upload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={onChoose}
          className="sr-only"
          aria-label={lines.upload}
          tabIndex={-1}
        />
        <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
          {logoUrl ? lines.replace : lines.upload}
        </Button>
        {logoUrl && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            className="text-sm text-muted hover:text-ink disabled:opacity-50"
          >
            {lines.remove}
          </button>
        )}
      </div>
      <p className="text-xs text-muted">{lines.hint}</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
