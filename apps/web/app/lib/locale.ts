import { useRouteLoaderData } from "react-router";

export type Locale = "ko" | "ja";

export const DEFAULT_LOCALE: Locale = "ko";

function asLocale(value?: string | null): Locale | null {
  return value === "ko" || value === "ja" ? value : null;
}

function localeFromHost(host?: string | null): Locale | null {
  if (!host) return null;
  if (host.startsWith("kr.")) return "ko";
  if (host.startsWith("jp.")) return "ja";
  return null;
}

export function resolveLocale(input: {
  host?: string | null;
  langParam?: string | null;
  envLocale?: string | null;
}): Locale {
  return (
    asLocale(input.langParam) ??
    asLocale(input.envLocale) ??
    localeFromHost(input.host) ??
    DEFAULT_LOCALE
  );
}

export function localeFromRequest(request: Request, envLocale?: string | null): Locale {
  const url = new URL(request.url);
  return resolveLocale({
    host: request.headers.get("host"),
    langParam: url.searchParams.get("lang"),
    envLocale,
  });
}

export function useLocale(): Locale {
  const data = useRouteLoaderData("root") as { locale: Locale } | undefined;
  return data?.locale ?? DEFAULT_LOCALE;
}
