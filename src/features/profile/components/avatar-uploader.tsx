"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { AVATAR_ACCEPT, buildAvatarPath, validateAvatarFile } from "@/lib/avatar-file";
import { createClient } from "@/lib/supabase/client";
import { useMessages } from "@/i18n/client";

type Props = {
  userId: string;
  nickname: string;
  /** Public URL of the current photo, if any. */
  currentUrl: string | null;
  /** Storage path of the current photo; removed after a replacement. */
  currentPath: string | null;
};

export function AvatarUploader({ userId, nickname, currentUrl, currentPath }: Props) {
  const t = useMessages();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeOldFile(path: string | null) {
    if (!path) return;
    // Best effort: a leftover file is harmless and invisible.
    await createClient().storage.from("avatars").remove([path]);
  }

  async function onChoose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const problem = validateAvatarFile(file);
    if (problem) {
      setError(t.avatar.errors[problem]);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const path = buildAvatarPath(userId, file.type, crypto.randomUUID());
      const { error: uploadError } = await createClient()
        .storage.from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      await api("/me", { method: "PATCH", json: { avatarPath: path } });
      await removeOldFile(currentPath);
      router.refresh();
    } catch {
      setError(t.avatar.errors.upload);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      await api("/me", { method: "PATCH", json: { avatarPath: null } });
      await removeOldFile(currentPath);
      router.refresh();
    } catch {
      setError(t.avatar.errors.upload);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="avatar-title" className="flex max-w-xl flex-col gap-3">
      <h2 id="avatar-title" className="text-lg">
        {t.avatar.title}
      </h2>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={currentUrl} name={nickname} size="lg" />
        <div className="flex flex-col items-start gap-2">
          <input
            ref={input}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={onChoose}
            className="sr-only"
            aria-label={t.avatar.choose}
            tabIndex={-1}
          />
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            {busy ? t.avatar.uploading : currentUrl ? t.avatar.replace : t.avatar.choose}
          </Button>
          {currentUrl && (
            <Button variant="text" disabled={busy} onClick={onRemove}>
              {t.avatar.remove}
            </Button>
          )}
          <p className="text-sm text-muted">{t.avatar.hint}</p>
        </div>
      </div>
      <p role="alert" className="min-h-5 text-sm text-danger">
        {error}
      </p>
    </section>
  );
}
