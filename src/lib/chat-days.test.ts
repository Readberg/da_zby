import { describe, expect, it } from "vitest";
import { dayKey, dayLabel } from "./chat-days";

const words = { today: "Сегодня", yesterday: "Вчера" };
// 29 Oct 2026, 12:00 in Minsk (UTC+3)
const NOW = Date.parse("2026-10-29T09:00:00Z");

describe("dayKey", () => {
  it("is the day in the viewer's offset, not in UTC", () => {
    expect(dayKey("2026-10-28T22:30:00Z", 180)).toBe("2026-10-29");
    expect(dayKey("2026-10-28T22:30:00Z", 0)).toBe("2026-10-28");
  });
});

describe("dayLabel", () => {
  it("says today and yesterday in words", () => {
    expect(dayLabel("2026-10-29T06:00:00Z", NOW, 180, "ru", words)).toBe("Сегодня");
    expect(dayLabel("2026-10-28T10:00:00Z", NOW, 180, "ru", words)).toBe("Вчера");
  });

  it("names an older day by its date, in the language of the site", () => {
    expect(dayLabel("2026-10-26T10:00:00Z", NOW, 180, "ru", words)).toBe("26 октября");
    expect(dayLabel("2026-10-26T10:00:00Z", NOW, 180, "en", words)).toBe("26 October");
  });

  it("counts a message after local midnight as the next day", () => {
    // 21:30 UTC on the 28th is 00:30 on the 29th in Minsk: today.
    expect(dayLabel("2026-10-28T21:30:00Z", NOW, 180, "ru", words)).toBe("Сегодня");
  });
});
