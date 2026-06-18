export type AuthProviderName = "google" | "apple" | "kakao" | "line";

export const PROVIDER_ORDER: readonly AuthProviderName[] = ["kakao", "line", "google", "apple"];

export function buildAuthUrl(args: {
  apiBaseUrl: string;
  provider: AuthProviderName;
  returnUrl: string;
}): string {
  const base = args.apiBaseUrl.replace(/\/+$/, "");
  return `${base}/auth/${args.provider}/start?redirect=${encodeURIComponent(args.returnUrl)}`;
}
