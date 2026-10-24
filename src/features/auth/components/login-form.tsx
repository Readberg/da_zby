"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { isPlausibleEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/client";
import { ru } from "@/messages/ru";

type Status = "idle" | "sending" | "sent";

export function LoginForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(linkError ? ru.auth.errors.link : null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    if (!isPlausibleEmail(email)) {
      setError(ru.auth.errors.emailInvalid);
      return;
    }

    setError(null);
    setStatus("sending");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: authError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });

    if (authError) {
      setStatus("idle");
      setError(authError.status === 429 ? ru.auth.errors.rateLimit : ru.auth.errors.generic);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <Card variant="accent" title={ru.auth.sentTitle}>
        <p>{ru.auth.sentText.replace("{email}", email.trim())}</p>
        <p className="mt-2 text-sm text-line">{ru.auth.sentSpam}</p>
        <Button variant="secondary" className="mt-4" onClick={() => setStatus("idle")}>
          {ru.auth.again}
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-md flex-col gap-4">
      <TextField
        id="login-email"
        label={ru.auth.emailLabel}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={ru.auth.emailPlaceholder}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={error}
      />
      <Button type="submit" disabled={status === "sending"}>
        {status === "sending" ? ru.auth.sending : ru.auth.send}
      </Button>
    </form>
  );
}
