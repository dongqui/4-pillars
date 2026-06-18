export type AuthProviderName = "google" | "apple" | "kakao" | "line";

export const PROVIDER_ORDER: readonly AuthProviderName[] = ["kakao", "line", "google", "apple"];

export function buildAuthUrl(args: {
  apiBaseUrl: string;
  provider: AuthProviderName;
  returnUrl: string;
  locale?: string;
}): string {
  const base = args.apiBaseUrl.replace(/\/+$/, "");
  const localePart = args.locale ? `&locale=${encodeURIComponent(args.locale)}` : "";
  return `${base}/auth/${args.provider}/start?redirect=${encodeURIComponent(args.returnUrl)}${localePart}`;
}
