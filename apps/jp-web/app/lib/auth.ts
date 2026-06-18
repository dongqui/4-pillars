export interface MeResponse {
  user: { id: string; email: string | null; name: string | null; locale: string | null };
}

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

export async function fetchMe(): Promise<MeResponse["user"] | null> {
  const res = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as MeResponse;
  return data.user;
}
