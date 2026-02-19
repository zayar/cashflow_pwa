import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import en from './translations/en';
import my from './translations/my';

const STORAGE_KEY = 'cashflow_pwa.language';
const DEFAULT_LANG = 'my';

const dictionaries = { en, my };
const supported = new Set(Object.keys(dictionaries));

function normalizeLang(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'mm') return 'my';
  if (supported.has(raw)) return raw;
  return DEFAULT_LANG;
}

function getInitialLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    // Ignore storage failures.
  }
  return DEFAULT_LANG;
}

function getByPath(obj, key) {
  if (!obj || !key) return undefined;
  return String(key)
    .split('.')
    .reduce((acc, part) => (acc && acc[part] != null ? acc[part] : undefined), obj);
}

function interpolate(template, vars) {
  if (typeof template !== 'string') return '';
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
    const value = vars[name];
    return value === null || value === undefined ? '' : String(value);
  });
}

const I18nContext = createContext({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key) => String(key || ''),
  tEn: (key) => String(key || '')
});

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => getInitialLang());

  const setLang = useCallback((nextLang) => {
    const normalized = normalizeLang(nextLang);
    setLangState(normalized);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      // Ignore storage failures.
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const current = dictionaries[lang] || dictionaries[DEFAULT_LANG];
      const fallback = dictionaries[DEFAULT_LANG];
      const raw = getByPath(current, key) ?? getByPath(fallback, key);
      const resolved = typeof raw === 'string' ? raw : String(key || '');
      return interpolate(resolved, vars);
    },
    [lang]
  );

  // For UI that must remain in English even when the user switches languages
  // (e.g. top navigation labels to avoid layout shifts).
  const tEn = useCallback((key, vars) => {
    const enDict = dictionaries['en'];
    const raw = getByPath(enDict, key);
    const resolved = typeof raw === 'string' ? raw : String(key || '');
    return interpolate(resolved, vars);
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'my' ? 'my' : 'en';
    } catch {
      // Ignore DOM failures.
    }
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, tEn }), [lang, setLang, t, tEn]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
