import type { SVGProps } from "react";
import type { Locale } from "@/i18n/config";

type FlagProps = SVGProps<SVGSVGElement>;

const base = {
  width: 24,
  height: 16,
  viewBox: "0 0 24 16",
  "aria-hidden": true,
  focusable: false,
};

/** Flags are content, like club logos: they keep their own colours instead of the theme's. */
function RussiaFlag(props: FlagProps) {
  return (
    <svg {...base} {...props}>
      <rect width="24" height="16" fill="#ffffff" />
      <rect y="5.33" width="24" height="5.34" fill="#0039a6" />
      <rect y="10.67" width="24" height="5.33" fill="#d52b1e" />
    </svg>
  );
}

function BritainFlag(props: FlagProps) {
  return (
    <svg {...base} {...props}>
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" strokeWidth="3.2" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#c8102e" strokeWidth="1.2" />
      <path d="M12 0v16M0 8h24" stroke="#ffffff" strokeWidth="5.2" />
      <path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="3" />
    </svg>
  );
}

/** The flag that stands for a language of the site. */
export function LocaleFlag({ locale, ...props }: FlagProps & { locale: Locale }) {
  return locale === "ru" ? <RussiaFlag {...props} /> : <BritainFlag {...props} />;
}
