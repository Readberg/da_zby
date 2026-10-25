import { describe, expect, it } from "vitest";
import { fieldErrorsFromIssues } from "./form-errors";

describe("fieldErrorsFromIssues", () => {
  const issues = [
    { path: ["name"], message: "first" },
    { path: ["name"], message: "second" },
    { path: ["slug"], message: "bad slug" },
    { path: ["logo"], message: "bad logo" },
    { path: [], message: "form level" },
  ];

  it("keeps the first message per field and skips issues without a field", () => {
    expect(fieldErrorsFromIssues(issues)).toEqual({
      name: "first",
      slug: "bad slug",
      logo: "bad logo",
    });
  });

  it("leaves out ignored fields", () => {
    expect(fieldErrorsFromIssues(issues, ["logo"])).toEqual({ name: "first", slug: "bad slug" });
  });
});
