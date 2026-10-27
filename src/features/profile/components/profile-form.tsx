"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { fieldErrorsFromIssues } from "@/lib/form-errors";
import { profilePatchSchema, utcOffsetOptions } from "@/lib/profile-schema";
import { useLocale, useMessages } from "@/i18n/client";
import { localizeMessage } from "@/i18n/validation";

export type ProfileFormValues = {
  nickname: string;
  fullName: string;
  contact: string;
  about: string;
  countryCode: string;
  city: string;
  utcOffsetMinutes: number;
};

type FieldErrors = Partial<Record<keyof ProfileFormValues, string>>;
type Status = "idle" | "saving" | "saved" | "failed";

const ABOUT_MAX = 1000;

export function ProfileForm({
  initial,
  countries,
}: {
  initial: ProfileFormValues;
  countries: { code: string; name: string }[];
}) {
  const t = useMessages();
  const locale = useLocale();
  const offsets = useMemo(() => utcOffsetOptions(locale), [locale]);
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");

  const set = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setStatus("idle");
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "saving") return;

    const payload = {
      nickname: values.nickname,
      fullName: values.fullName,
      contact: values.contact,
      about: values.about,
      countryCode: values.countryCode || null,
      city: values.city,
      utcOffsetMinutes: values.utcOffsetMinutes,
    };

    const parsed = profilePatchSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(
        fieldErrorsFromIssues<keyof ProfileFormValues>(
          parsed.error.issues.map((issue) => ({
            ...issue,
            message: localizeMessage(issue.message, locale),
          })),
        ),
      );
      setStatus("failed");
      return;
    }

    setErrors({});
    setStatus("saving");
    try {
      await api("/me", { method: "PATCH", json: payload });
      setStatus("saved");
      router.refresh();
    } catch (cause) {
      const next: FieldErrors = {};
      if (cause instanceof ApiClientError) {
        for (const key of Object.keys(values) as (keyof ProfileFormValues)[]) {
          const message = cause.fieldError(key);
          if (message) next[key] = localizeMessage(message, locale);
        }
      }
      setErrors(next);
      setStatus("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <TextField
        id="profile-nickname"
        label={t.profile.nickname}
        hint={t.profile.nicknameHint}
        autoComplete="nickname"
        value={values.nickname}
        onChange={(e) => set("nickname", e.target.value)}
        error={errors.nickname}
      />
      <TextField
        id="profile-fullName"
        label={t.profile.fullName}
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => set("fullName", e.target.value)}
        error={errors.fullName}
      />
      <TextField
        id="profile-contact"
        label={t.profile.contact}
        hint={t.profile.contactHint}
        value={values.contact}
        onChange={(e) => set("contact", e.target.value)}
        error={errors.contact}
      />
      <TextareaField
        id="profile-about"
        label={t.profile.about}
        hint={`${values.about.length}/${ABOUT_MAX}`}
        value={values.about}
        onChange={(e) => set("about", e.target.value)}
        error={errors.about}
      />
      <SelectField
        id="profile-country"
        label={t.profile.country}
        value={values.countryCode}
        onChange={(e) => set("countryCode", e.target.value)}
        error={errors.countryCode}
      >
        <option value="">{t.profile.countryEmpty}</option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </SelectField>
      <TextField
        id="profile-city"
        label={t.profile.city}
        autoComplete="address-level2"
        value={values.city}
        onChange={(e) => set("city", e.target.value)}
        error={errors.city}
      />
      <SelectField
        id="profile-timezone"
        label={t.profile.timezone}
        hint={t.profile.timezoneHint}
        value={String(values.utcOffsetMinutes)}
        onChange={(e) => set("utcOffsetMinutes", Number(e.target.value))}
        error={errors.utcOffsetMinutes}
      >
        {offsets.map((offset) => (
          <option key={offset.minutes} value={offset.minutes}>
            {offset.label}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={status === "saving"}>
          {status === "saving" ? t.profile.saving : t.profile.save}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {status === "saved" && <span className="text-ink">{t.profile.saved}</span>}
          {status === "failed" && <span className="text-danger">{t.profile.error}</span>}
        </p>
      </div>
    </form>
  );
}
