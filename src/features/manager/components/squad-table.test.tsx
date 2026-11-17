import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ru } from "@/messages/ru";
import type { PlayerSummary } from "@/server/api/v1/schemas/manager";
import { SquadTable } from "./squad-table";

const base = {
  position: "MID",
  age: 25,
  form: 80,
  fitness: 80,
  morale: 80,
  nominal: 1000,
  injuredUntil: null,
  retiring: false,
  trainingFocus: null,
} as const;

const players = [
  { ...base, id: "1", firstName: "Борис", lastName: "Борисов", overall: 60, real: 55 },
  { ...base, id: "2", firstName: "Антон", lastName: "Антонов", overall: 70, real: 65 },
] as unknown as PlayerSummary[];

function names() {
  return within(screen.getAllByRole("rowgroup")[1])
    .getAllByRole("row")
    .map((row) => row.textContent ?? "");
}

describe("SquadTable", () => {
  it("sorts by a column on a click, ascending then descending", () => {
    render(<SquadTable players={players} />);
    const header = screen.getByRole("columnheader", {
      name: new RegExp(ru.manager.columns.overall),
    });
    expect(header).toHaveAttribute("aria-sort", "none");

    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(names()[0]).toContain("Борисов");

    fireEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(names()[0]).toContain("Антонов");
  });
});
