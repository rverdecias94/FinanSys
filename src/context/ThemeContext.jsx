import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => null,
});

/** Fondos de la UI → barras superior/inferior de la PWA (Android/Chrome). */
export const THEME_BAR_COLORS = {
  light: "#fcfcfc",
  dark: "#121212",
};

function resolveTheme(theme) {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme === "dark" ? "dark" : "light";
}

/**
 * Android Chrome pinta status + nav bar con theme-color.
 * Si el usuario fuerza oscuro con el teléfono en claro, hay que actualizar
 * TODAS las metas (incl. las de media) y el color-scheme del documento;
 * si no, la barra inferior se queda blanca.
 */
function applyThemeColor(resolved) {
  const color = THEME_BAR_COLORS[resolved] || THEME_BAR_COLORS.light;

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());

  const primary = document.createElement("meta");
  primary.setAttribute("name", "theme-color");
  primary.setAttribute("content", color);
  document.head.appendChild(primary);

  // Respaldo: algunos WebViews solo leen la meta con media matching al OS.
  // Cuando el tema está forzado, ambas medias llevan el mismo color.
  for (const scheme of ["light", "dark"]) {
    const m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    m.setAttribute("media", `(prefers-color-scheme: ${scheme})`);
    m.setAttribute("content", color);
    document.head.appendChild(m);
  }

  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) {
    apple.setAttribute("content", resolved === "dark" ? "black-translucent" : "default");
  }

  const root = document.documentElement;
  root.style.colorScheme = resolved;
  root.style.backgroundColor = color;
  if (document.body) document.body.style.backgroundColor = color;
}

export function ThemeProvider({ children, defaultTheme = "system", storageKey = "vite-ui-theme", ...props }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(storageKey) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    const resolved = resolveTheme(theme);
    root.classList.add(resolved);
    applyThemeColor(resolved);

    if (theme !== "system") return undefined;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system");
      root.classList.remove("light", "dark");
      root.classList.add(next);
      applyThemeColor(next);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (next) => {
      localStorage.setItem(storageKey, next);
      setTheme(next);
    },
  };

  return (
    <ThemeContext.Provider {...props} value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
