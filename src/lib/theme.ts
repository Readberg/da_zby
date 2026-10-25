export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "dazby-theme";

/** Runs in <head> before paint: applies the visitor's saved choice, if there is one. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

/** The theme that is on screen now: the explicit choice, else the system preference. */
export function effectiveTheme(root: HTMLElement, prefersDark: boolean): Theme {
  const chosen = root.getAttribute("data-theme");
  if (chosen === "light" || chosen === "dark") return chosen;
  return prefersDark ? "dark" : "light";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
