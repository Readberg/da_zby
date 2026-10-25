"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { ru } from "@/messages/ru";
import { nicknameSchema } from "@/lib/profile-schema";

type Availability = "idle" | "checking" | "free" | "taken";

export function OnboardingForm({ next }: { next: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  // Result of the last finished check; "checking" is derived, so no state is set synchronously.
  const [checked, setChecked] = useState<{ nickname: string; available: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const format = nicknameSchema.safeParse(nickname);
  const candidate = format.success ? format.data : null;

  // Debounced live check; nothing is sent while the format is invalid.
  useEffect(() => {
    if (!candidate) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await api<{ valid: boolean; available: boolean }>(
          `/nickname-availability?nickname=${encodeURIComponent(candidate)}`,
          { signal: controller.signal },
        );
        setChecked({ nickname: candidate, available: result.available });
      } catch {
        // Offline or aborted: the server re-checks on submit anyway.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [candidate]);

  const availability: Availability = !candidate
    ? "idle"
    : checked?.nickname === candidate
      ? checked.available
        ? "free"
        : "taken"
      : "checking";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!format.success) {
      setError(format.error.issues[0]?.message ?? ru.onboarding.hint);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/me", { method: "PATCH", json: { nickname: format.data } });
      router.replace(next);
      router.refresh();
    } catch (cause) {
      setSaving(false);
      setError(
        cause instanceof ApiClientError
          ? (cause.fieldError("nickname") ?? ru.onboarding.generic)
          : ru.onboarding.generic,
      );
    }
  }

  const hint =
    availability === "checking"
      ? ru.onboarding.checking
      : availability === "free"
        ? ru.onboarding.free
        : availability === "taken"
          ? ru.onboarding.taken
          : ru.onboarding.hint;

  return (
    <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-4">
      <TextField
        id="onboarding-nickname"
        label={ru.onboarding.nicknameLabel}
        autoComplete="nickname"
        autoCapitalize="none"
        maxLength={20}
        value={nickname}
        onChange={(event) => {
          setNickname(event.target.value);
          setError(null);
        }}
        hint={hint}
        error={error ?? (availability === "taken" ? ru.onboarding.taken : undefined)}
      />
      <Button type="submit" disabled={saving || availability === "taken"}>
        {saving ? ru.onboarding.saving : ru.onboarding.submit}
      </Button>
    </form>
  );
}
