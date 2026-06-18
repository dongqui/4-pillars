import type { NormalizedProfile, ProviderName } from "./types.js";

export interface AuthRepo {
  findIdentity(provider: ProviderName, providerUserId: string): Promise<{ userId: string } | null>;
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: { email: string | null; name: string | null; locale: string | null }): Promise<{ id: string }>;
  createIdentity(input: {
    userId: string;
    provider: ProviderName;
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    rawProfile: unknown;
  }): Promise<void>;
  getUserById(id: string): Promise<{ id: string; email: string | null; name: string | null; locale: string | null } | null>;
}

/**
 * provider 프로필을 유저에 매핑한다.
 * 1) 기존 identity → 그 유저
 * 2) 검증된 이메일이 기존 유저와 일치 → identity 연결
 * 3) 그 외 → 새 유저 + identity 생성
 */
export async function resolveUser(
  repo: AuthRepo,
  args: { provider: ProviderName; profile: NormalizedProfile; locale: string | null },
): Promise<{ userId: string; created: boolean }> {
  const { provider, profile, locale } = args;

  const existing = await repo.findIdentity(provider, profile.providerUserId);
  if (existing) return { userId: existing.userId, created: false };

  let userId: string;
  let created: boolean;

  const linkable =
    profile.email !== null && profile.emailVerified
      ? await repo.findUserByEmail(profile.email)
      : null;

  if (linkable) {
    userId = linkable.id;
    created = false;
  } else {
    const u = await repo.createUser({ email: profile.email, name: profile.name, locale });
    userId = u.id;
    created = true;
  }

  await repo.createIdentity({
    userId,
    provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    rawProfile: profile.raw,
  });

  return { userId, created };
}
