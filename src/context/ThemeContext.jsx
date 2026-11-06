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

function applyThemeColor(resolved) {
  const color = THEME_BAR_COLORS[resolved] || THEME_BAR_COLORS.light;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("content", color);
    document.head.appendChild(meta);
  } else {
    // Una sola fuente de verdad en runtime (los media del HTML son el fallback pre-JS).
    metas.forEach((meta, i) => {
      if (i === 0) {
        meta.removeAttribute("media");
        meta.setAttribute("content", color);
      } else {
        meta.remove();
      }
    });
  }

  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) {
    // black-translucent deja ver el fondo de la app; default = claro opaco.
    apple.setAttribute("content", resolved === "dark" ? "black-translucent" : "default");
  }

  document.documentElement.style.colorScheme = resolved;
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
