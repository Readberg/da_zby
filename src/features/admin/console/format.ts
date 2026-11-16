import type { Field } from "@/server/admin/registry";

/** A value of the database as text for a table cell or an input. */
export function cell(field: Pick<Field, "type">, value: unknown): string {
  if (value === null || value === undefined) return "";
  if (field.type === "bool") return value ? "да" : "нет";
  if (field.type === "datetime") return String(value).replace("T", " ").slice(0, 16);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
