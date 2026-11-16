"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { useManager } from "./manager-provider";

/** A resting club: the owner confirms that he is back and the club plays with his lineup again. */
export function DormantBanner() {
  const { t } = useManager();
  const router = useRouter();
  const lines = t.season;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await api("/manager/club/return", { method: "POST" });
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-5"
    >
      <h3 className="text-lg">{lines.dormantTitle}</h3>
      <p className="text-sm text-muted">{lines.dormantText}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={confirm} loading={busy}>
          {busy ? lines.dormantSending : lines.dormantConfirm}
        </Button>
        {failed && (
          <p role="alert" className="text-sm text-danger">
            {lines.dormantGeneric}
          </p>
        )}
      </div>
    </section>
  );
}
