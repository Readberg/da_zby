"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";

export type EditableField = {
  name: string;
  label: string;
  type: "text" | "number" | "bool" | "enum" | "datetime" | "uuid";
  value: unknown;
};

const toText = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Edits the fields the viewer's role may change; sends only what changed, with a reason. */
export function RecordForm({
  entity,
  id,
  fields,
}: {
  entity: string;
  id: string;
  fields: EditableField[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, toText(f.value)])),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const patch: Record<string, string | number | null> = {};
  for (const f of fields) {
    const now = values[f.name] ?? "";
    if (now === toText(f.value)) continue;
    patch[f.name] = now === "" ? null : f.type === "number" ? Number(now) : now;
  }
  const changed = Object.keys(patch).length > 0;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await api("/admin/console/record", { method: "PATCH", json: { entity, id, patch, reason } });
      setFailed(false);
      setMessage(ru.admin.console.saved);
      setReason("");
      router.refresh();
    } catch (cause) {
      setFailed(true);
      setMessage(
        cause instanceof ApiClientError && cause.problem.status === 403
          ? ru.admin.console.errors.forbidden
          : (cause instanceof ApiClientError && cause.problem.detail) ||
              ru.admin.console.errors.generic,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
          <Input
            id={`f-${f.name}`}
            value={values[f.name] ?? ""}
            inputMode={f.type === "number" ? "numeric" : undefined}
            onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
          />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <Label htmlFor="f-reason">{ru.admin.console.reason}</Label>
        <Input
          id="f-reason"
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <Button
        onClick={save}
        loading={busy}
        disabled={!changed || reason.trim().length < 5}
        className="w-fit"
      >
        {ru.admin.console.save}
      </Button>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "text-sm text-danger" : "text-sm text-muted"}
        >
          {message}
        </p>
      )}
    </div>
  );
}
