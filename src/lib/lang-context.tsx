import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dict, type Lang } from "./i18n";

type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (typeof dict)["en"];
  setLang: (l: Lang) => void;
  toggle: () => void;
};

const LangContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "havruta_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("he");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (stored === "he" || stored === "en") setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const value: Ctx = {
    lang,
    dir: lang === "he" ? "rtl" : "ltr",
    t: dict[lang],
    setLang,
    toggle: () => setLang(lang === "he" ? "en" : "he"),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
