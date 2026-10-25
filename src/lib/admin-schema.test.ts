import { describe, expect, it } from "vitest";
import {
  clubFieldsSchema,
  clubUpdateSchema,
  tournamentFieldsSchema,
  tournamentUpdateSchema,
} from "./admin-schema";

const valid = {
  name: "Высшая лига",
  slug: "vysshaya-liga",
  pointsExact: 3,
  pointsOutcome: 1,
  isActive: true,
};

describe("tournamentFieldsSchema", () => {
  it("accepts the default setup", () => {
    expect(tournamentFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["A", "Upper", "with space", "под_черкивание", "x", "a".repeat(51), ""])(
    "rejects the slug %j",
    (slug) => {
      expect(tournamentFieldsSchema.safeParse({ ...valid, slug }).success).toBe(false);
    },
  );

  it.each([-1, 101, 1.5, Number.NaN])("rejects points %s", (points) => {
    expect(tournamentFieldsSchema.safeParse({ ...valid, pointsExact: points }).success).toBe(false);
    expect(tournamentFieldsSchema.safeParse({ ...valid, pointsOutcome: points }).success).toBe(
      false,
    );
  });

  it("allows zero points and trims the name", () => {
    const parsed = tournamentFieldsSchema.parse({
      ...valid,
      name: "  Кубок  ",
      pointsExact: 0,
      pointsOutcome: 0,
    });
    expect(parsed.name).toBe("Кубок");
  });

  it("update takes a partial body but always an id", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(tournamentUpdateSchema.safeParse({ id, pointsExact: 5 }).success).toBe(true);
    expect(tournamentUpdateSchema.safeParse({ pointsExact: 5 }).success).toBe(false);
    expect(tournamentUpdateSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});

describe("clubFieldsSchema", () => {
  it("turns an empty short name into null and accepts no logo", () => {
    const parsed = clubFieldsSchema.parse({
      name: "Динамо Минск",
      shortName: "  ",
      logoPath: null,
    });
    expect(parsed).toEqual({ name: "Динамо Минск", shortName: null, logoPath: null });
  });

  it("accepts a generated logo path and refuses anything that could leave the bucket", () => {
    const ok = "3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab.png";
    expect(
      clubFieldsSchema.safeParse({ name: "Клуб", shortName: null, logoPath: ok }).success,
    ).toBe(true);
    for (const logoPath of ["../x.png", "a/b.png", "x.exe", "x.svg", ""]) {
      expect(clubFieldsSchema.safeParse({ name: "Клуб", shortName: null, logoPath }).success).toBe(
        false,
      );
    }
  });

  it("limits the short name", () => {
    expect(
      clubFieldsSchema.safeParse({ name: "Клуб", shortName: "x".repeat(21), logoPath: null })
        .success,
    ).toBe(false);
  });

  it("update takes a partial body but always an id", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(clubUpdateSchema.safeParse({ id, name: "Новое имя" }).success).toBe(true);
    expect(clubUpdateSchema.safeParse({ name: "Новое имя" }).success).toBe(false);
  });
});
