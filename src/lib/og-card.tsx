import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE } from "./og-theme";

export type OgRow = { place: number | null; name: string; value: string };

export type OgCard = {
  brand: string;
  title: string;
  /** One line under the title, e.g. "Place 3 · 24 points". */
  subtitle?: string;
  /** A short table below (the standings top). */
  rows?: OgRow[];
  footer: string;
  status?: number;
};

let font: Promise<Buffer> | undefined;
let logo: Promise<string> | undefined;

// The files are read from the repository (the server runs from the project folder), not through
// import.meta.url: in the server bundle that points at a build chunk, and fetch() cannot open files.
const asset = (path: string) => join(process.cwd(), "src", "assets", path);

function loadFont(): Promise<Buffer> {
  font ??= readFile(asset("fonts/PTSans-Bold-subset.ttf"));
  return font;
}

function loadLogo(): Promise<string> {
  logo ??= readFile(asset("logo.png")).then(
    (bytes) => `data:image/png;base64,${bytes.toString("base64")}`,
  );
  return logo;
}

/** The nickname can be long: shrink the type instead of cutting it. */
function titleSize(title: string): number {
  if (title.length > 26) return 56;
  if (title.length > 16) return 76;
  return 104;
}

/** One 1200×630 card in the site's colours: brand, a title, an optional subtitle or top rows. */
export async function renderCard(card: OgCard): Promise<ImageResponse> {
  const [fontData, logoSrc] = await Promise.all([loadFont(), loadLogo()]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: OG_COLORS.background,
        color: OG_COLORS.ink,
        padding: 64,
        fontFamily: "PT Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by the image renderer, not the browser */}
        <img src={logoSrc} width={72} height={72} alt="" />
        <div style={{ fontSize: 40, textTransform: "uppercase", color: OG_COLORS.accent }}>
          {card.brand}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: titleSize(card.title), lineHeight: 1.05 }}>{card.title}</div>
        {card.subtitle && (
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              fontSize: 44,
              color: OG_COLORS.onAccent,
              background: OG_COLORS.accent,
              padding: "10px 28px",
              borderRadius: 16,
            }}
          >
            {card.subtitle}
          </div>
        )}
        {card.rows && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {card.rows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  fontSize: 44,
                  background: OG_COLORS.surface,
                  padding: "12px 28px",
                  borderRadius: 16,
                }}
              >
                <div style={{ width: 56, color: OG_COLORS.accent }}>{String(row.place ?? "–")}</div>
                <div style={{ flex: 1 }}>{row.name}</div>
                <div style={{ color: OG_COLORS.muted }}>{row.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 30, color: OG_COLORS.muted }}>{card.footer}</div>
    </div>,
    {
      ...OG_SIZE,
      status: card.status ?? 200,
      fonts: [
        {
          name: "PT Sans",
          data: fontData.buffer.slice(
            fontData.byteOffset,
            fontData.byteOffset + fontData.byteLength,
          ) as ArrayBuffer,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}
