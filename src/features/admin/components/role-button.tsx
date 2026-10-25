"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";

/** Grants or revokes the admin role of one user; the server and the database make the final call. */
export function RoleButton({
  userId,
  role,
  nickname,
}: {
  userId: string;
  role: "user" | "admin";
  nickname: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = role === "admin" ? "user" : "admin";

  async function change() {
    setBusy(true);
    setError(null);
    try {
      await api("/admin/users/role", { method: "PATCH", json: { userId, role: next } });
      router.refresh();
    } catch (cause) {
      const lastAdmin =
        cause instanceof ApiClientError && cause.problem.code === "admin.last_admin";
      setError(lastAdmin ? ru.admin.users.errors.lastAdmin : ru.admin.users.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="secondary" loading={busy} onClick={change} className="min-h-9 px-4 text-sm">
        <span className="sr-only">{nickname}: </span>
        {role === "admin" ? ru.admin.users.revoke : ru.admin.users.grant}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
