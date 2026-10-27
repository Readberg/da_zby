"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ru } from "@/messages/ru";

/** An admin removes a participant's photo (a photo cannot be set on their behalf). */
export function RemovePhotoButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function remove() {
    setBusy(true);
    setError(false);
    try {
      await api("/admin/users/profile", {
        method: "PATCH",
        json: { userId, patch: { avatarPath: null } },
      });
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={remove} loading={busy}>
        {ru.admin.users.removePhoto}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {ru.admin.users.removePhotoFailed}
        </p>
      )}
    </div>
  );
}
