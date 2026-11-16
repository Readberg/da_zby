"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";

export type ActionOption = { key: string; confirm: boolean };

const select =
  "min-h-11 rounded-sm border border-line bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent";

/**
 * Runs one action for the given targets (one row on a card, many in the list). Every action needs a
 * reason; the server and the database check the role again, so a hidden option is no protection.
 */
export function ActionForm({
  targets,
  actions,
  confirmHint,
}: {
  targets: string[];
  actions: ActionOption[];
  /** What the operator must type to confirm a dangerous action (the club name or the nickname). */
  confirmHint?: string;
}) {
  const router = useRouter();
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [role, setRole] = useState("user");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const chosen = actions.find((a) => a.key === action);
  const names = ru.admin.console.actionNames as Record<string, string>;

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const params: Record<string, string | number> = {};
      if (action === "adjust_budget") params.amount = Number(amount);
      if (action === "set_role") params.role = role;
      if (chosen?.confirm) params.confirm = confirm;
      const { results } = await api<{ results: { target: string; ok: boolean; error?: string }[] }>(
        "/admin/console/actions",
        { method: "POST", json: { action, targets, reason, params } },
      );
      const bad = results.filter((r) => !r.ok);
      setFailed(bad.length > 0);
      setMessage(
        bad.length
          ? bad.map((r) => `${r.target.slice(0, 8)}: ${r.error}`).join("; ")
          : ru.admin.console.done,
      );
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

  const ready =
    targets.length > 0 &&
    action !== "" &&
    reason.trim().length >= 5 &&
    (action !== "adjust_budget" || (Number.isInteger(Number(amount)) && Number(amount) !== 0)) &&
    (!chosen?.confirm || confirm.trim() !== "");

  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`act-${targets[0] ?? "x"}`}>{ru.admin.console.actions}</Label>
        <select
          id={`act-${targets[0] ?? "x"}`}
          className={select}
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="">{ru.admin.console.pick}</option>
          {actions.map((a) => (
            <option key={a.key} value={a.key}>
              {names[a.key] ?? a.key}
            </option>
          ))}
        </select>
      </div>
      {action === "adjust_budget" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="act-amount">{ru.admin.console.amount}</Label>
          <Input
            id="act-amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      )}
      {action === "set_role" && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="act-role">{ru.admin.console.role}</Label>
          <select
            id="act-role"
            className={select}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {Object.entries(ru.admin.console.roles).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {chosen?.confirm && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="act-confirm">
            {ru.admin.console.confirmLabel.replace(
              "{name}",
              confirmHint ?? ru.admin.console.confirmHint,
            )}
          </Label>
          <Input id="act-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="act-reason">{ru.admin.console.reason}</Label>
        <Input
          id="act-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </div>
      <Button onClick={run} loading={busy} disabled={!ready} className="w-fit">
        {ru.admin.console.run}
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
