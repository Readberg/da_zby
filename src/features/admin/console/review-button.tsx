"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { ru } from "@/messages/ru";

/** Marks one finding of the suspicious-activity report as reviewed. */
export function ReviewButton({ kind, subject }: { kind: string; subject: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        loading={busy}
        className="min-h-9 px-4 text-sm"
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            await api("/admin/console/suspicious/review", {
              method: "POST",
              json: { kind, subject },
            });
            router.refresh();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {ru.admin.console.suspicious.markReviewed}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {ru.admin.console.errors.generic}
        </p>
      )}
    </div>
  );
}
