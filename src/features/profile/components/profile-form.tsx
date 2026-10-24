"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, TextareaField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { profilePatchSchema, utcOffsetOptions } from "@/lib/profile-schema";
import { ru } from "@/messages/ru";

export type ProfileFormValues = {
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
const offsets = utcOffsetOptions();

export function ProfileForm({
  initial,
  countries,
}: {
  initial: ProfileFormValues;
  countries: { code: string; name: string }[];
}) {
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
      fullName: values.fullName,
      contact: values.contact,
      about: values.about,
      countryCode: values.countryCode || null,
      city: values.city,
      utcOffsetMinutes: values.utcOffsetMinutes,
    };

    const parsed = profilePatchSchema.safeParse(payload);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProfileFormValues | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
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
          if (message) next[key] = message;
        }
      }
      setErrors(next);
      setStatus("failed");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <TextField
        id="profile-fullName"
        label={ru.profile.fullName}
        autoComplete="name"
        value={values.fullName}
        onChange={(e) => set("fullName", e.target.value)}
        error={errors.fullName}
      />
      <TextField
        id="profile-contact"
        label={ru.profile.contact}
        hint={ru.profile.contactHint}
        value={values.contact}
        onChange={(e) => set("contact", e.target.value)}
        error={errors.contact}
      />
      <TextareaField
        id="profile-about"
        label={ru.profile.about}
        hint={`${values.about.length}/${ABOUT_MAX}`}
        value={values.about}
        onChange={(e) => set("about", e.target.value)}
        error={errors.about}
      />
      <SelectField
        id="profile-country"
        label={ru.profile.country}
        value={values.countryCode}
        onChange={(e) => set("countryCode", e.target.value)}
        error={errors.countryCode}
      >
        <option value="">{ru.profile.countryEmpty}</option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </SelectField>
      <TextField
        id="profile-city"
        label={ru.profile.city}
        autoComplete="address-level2"
        value={values.city}
        onChange={(e) => set("city", e.target.value)}
        error={errors.city}
      />
      <SelectField
        id="profile-timezone"
        label={ru.profile.timezone}
        hint={ru.profile.timezoneHint}
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
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? ru.profile.saving : ru.profile.save}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {status === "saved" && <span className="text-ink">{ru.profile.saved}</span>}
          {status === "failed" && <span className="text-danger">{ru.profile.error}</span>}
        </p>
      </div>
    </form>
  );
}
