import { createProfileSchema, type CreateProfileBody } from "@/lib/profiles/input";
import { redis } from "@/lib/redis";

/**
 * 익명 입력의 손잡이를 나르는 쿠키. 값이 아니라 Redis 키 하나만 담는다.
 *
 * 쿠키를 쓰는 이유는 OAuth 왕복 때문이다 — 콜백 URL 은 provider 가 조립하므로
 * 쿼리 파라미터는 못 넘고, 콜백은 서버 리다이렉트라 localStorage 도 못 읽는다.
 * oauth_state / oauth_verifier 가 이미 같은 방식으로 값을 나른다.
 */
export const DRAFT_COOKIE = "draft";

/** 세션 만료(session.ts MAX_AGE)와 같은 7일. 더 길게 두면 주인 없는 생년월일이 남는다. */
const TTL_SECONDS = 60 * 60 * 24 * 7;

/** 주입 가능한 최소 Redis 인터페이스. 테스트가 실제 Redis 에 붙지 않게 한다. */
export interface DraftClient {
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const defaultClient: DraftClient = redis;

function draftKey(token: string): string {
  return `draft:${token}`;
}

export function generateDraftToken(): string {
  return crypto.randomUUID();
}

export async function putDraft(
  token: string,
  body: CreateProfileBody,
  client: DraftClient = defaultClient,
): Promise<void> {
  await client.set(draftKey(token), body, { ex: TTL_SECONDS });
}

/**
 * 읽을 때 다시 검증한다 — 배포 사이에 스키마가 바뀌면 옛 모양의 레코드가
 * TTL 동안 남아 있고, 그대로 createProfile 에 넣으면 DB 까지 간다.
 * 검증 실패는 드래프트가 없는 것과 같이 취급한다.
 */
export async function getDraft(
  token: string,
  client: DraftClient = defaultClient,
): Promise<CreateProfileBody | null> {
  const raw = await client.get(draftKey(token));
  if (raw === null || raw === undefined) return null;
  const parsed = createProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function deleteDraft(
  token: string,
  client: DraftClient = defaultClient,
): Promise<void> {
  await client.del(draftKey(token));
}

export function draftCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
