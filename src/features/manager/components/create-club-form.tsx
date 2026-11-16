"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label, Select, TextField } from "@/components/ui/field";
import { ApiClientError, api } from "@/lib/api-client";
import { cx } from "@/lib/cx";
import {
  CLUB_NAME_MAX,
  CLUB_NAME_PATTERN,
  type ManagerCities,
} from "@/server/api/v1/schemas/manager";
import { ClubKit } from "./club-kit";
import { useManager } from "./manager-provider";

/** After a choice of a colour the next one is accepted only after this many milliseconds. */
export const COLOR_COOLDOWN_MS = 250;

function ColorPicker({
  label,
  colors,
  value,
  onChange,
  cooling,
  optionLabel,
}: {
  label: string;
  colors: string[];
  value: string;
  onChange: (color: string) => void;
  cooling: boolean;
  optionLabel: (n: number) => string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className={cx("flex flex-wrap gap-2 transition-opacity", cooling && "opacity-70")}>
        {colors.map((color, index) => (
          <button
            key={color}
            type="button"
            aria-label={optionLabel(index + 1)}
            aria-pressed={value === color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cx(
              "h-10 w-10 rounded-full border-2 transition-transform hover:scale-105",
              value === color ? "border-ink ring-2 ring-accent" : "border-line",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** The one form that makes a club: name, city and the two colours; the squad is made by the server. */
export function CreateClubForm() {
  const { t } = useManager();
  const router = useRouter();
  const [options, setOptions] = useState<ManagerCities | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState("");
  const [cityId, setCityId] = useState("");
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [cooling, setCooling] = useState(false);
  const lastChoice = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<ManagerCities>("/manager/cities")
      .then((data) => {
        if (cancelled) return;
        setOptions(data);
        setPrimary(data.colors[0] ?? "");
        setSecondary(data.colors[data.colors.length - 1] ?? "");
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** A colour is accepted at most once in COLOR_COOLDOWN_MS: quick clicking does not make the kit flicker. */
  function chooseColor(set: (color: string) => void) {
    return (color: string) => {
      const now = Date.now();
      if (now - lastChoice.current < COLOR_COOLDOWN_MS) return;
      lastChoice.current = now;
      set(color);
      setCooling(true);
      setError(null);
      setTimeout(() => setCooling(false), COLOR_COOLDOWN_MS);
    };
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > CLUB_NAME_MAX || !CLUB_NAME_PATTERN.test(trimmed)) {
      setError(t.errors.nameInvalid);
      return;
    }
    if (!cityId) {
      setError(t.errors.cityRequired);
      return;
    }
    if (primary === secondary) {
      setError(t.errors.colorsSame);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await api("/manager/club", {
        method: "POST",
        json: {
          name: trimmed,
          cityId: Number(cityId),
          primaryColor: primary,
          secondaryColor: secondary,
        },
      });
      router.refresh();
    } catch (cause) {
      setSaving(false);
      const code = cause instanceof ApiClientError ? cause.problem.code : null;
      setError(
        code === "manager.name_taken"
          ? t.errors.nameTaken
          : code === "manager.club_exists"
            ? t.errors.clubExists
            : t.errors.generic,
      );
      if (code === "manager.club_exists") router.refresh();
    }
  }

  if (loadFailed) {
    return (
      <p role="alert" className="text-danger">
        {t.errors.citiesFailed}
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid w-full max-w-3xl gap-8 sm:grid-cols-[minmax(0,1fr)_11rem]"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink">{t.country}</span>
          <p className="rounded-sm border border-line bg-surface px-4 py-2.5">{t.countries.BY}</p>
        </div>

        <TextField
          id="club-name"
          label={t.nameLabel}
          maxLength={CLUB_NAME_MAX}
          autoComplete="off"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          hint={t.nameHint}
        />

        <div className="flex flex-col gap-1">
          <Label htmlFor="club-city">{t.cityLabel}</Label>
          <Select
            id="club-city"
            value={cityId}
            disabled={!options}
            onChange={(event) => {
              setCityId(event.target.value);
              setError(null);
            }}
          >
            <option value="">{t.cityPlaceholder}</option>
            {options?.cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </Select>
        </div>

        {options && (
          <>
            <ColorPicker
              label={t.primaryColor}
              colors={options.colors}
              value={primary}
              onChange={chooseColor(setPrimary)}
              cooling={cooling}
              optionLabel={(n) => t.colorOption.replace("{n}", String(n))}
            />
            <ColorPicker
              label={t.secondaryColor}
              colors={options.colors}
              value={secondary}
              onChange={chooseColor(setSecondary)}
              cooling={cooling}
              optionLabel={(n) => t.colorOption.replace("{n}", String(n))}
            />
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" loading={saving} disabled={!options}>
            {saving ? t.creating : t.submit}
          </Button>
          <Link href="/manager/faq" className="text-sm text-muted hover:text-ink hover:underline">
            {t.faqLink}
          </Link>
        </div>
      </div>

      {primary && secondary && (
        <div className="order-first flex flex-col items-center gap-2 sm:order-last sm:sticky sm:top-24 sm:self-start">
          <ClubKit
            primary={primary}
            secondary={secondary}
            label={t.kitLabel}
            className="max-w-44"
          />
          <p className="text-center text-sm text-muted">{t.kitLabel}</p>
        </div>
      )}
    </form>
  );
}
