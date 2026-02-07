"use client";

import { saveTheme, type ThemeMode } from "@/app/actions/profiles";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyClass(theme: ThemeMode) {
  const html = document.documentElement;
  if (theme === "dark") {
    html.classList.add("dark");
  } else if (theme === "light") {
    html.classList.remove("dark");
  } else {
    // system
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyClass(theme);
  }, [theme]);

  // Listen for system preference changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback(
    (t: ThemeMode) => {
      setThemeState(t);
      applyClass(t);
      // Persist to DB (fire-and-forget)
      saveTheme(t);
    },
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Inline script to prevent FOUC (flash of unstyled content).
 * Reads the server-rendered data-theme attribute and applies the dark class immediately.
 * Must be rendered inside <head> or at the top of <body>.
 */
export function ThemeScript({ theme }: { theme: ThemeMode }) {
  const code = `(function(){
  var t="${theme}";
  var h=document.documentElement;
  if(t==="dark")h.classList.add("dark");
  else if(t==="system"&&window.matchMedia("(prefers-color-scheme:dark)").matches)h.classList.add("dark");
})()`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
