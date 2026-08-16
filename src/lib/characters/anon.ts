import { z } from "zod";
import { cookies } from "next/headers";
import { characterFromBirth, type Character } from "@/lib/saju-core";

/**
 * 로그인하지 않은 사람의 라이트 퍼널 입력을 나르는 쿠키.
 *
 * 캐릭터(60갑자 순번)가 아니라 **입력한 생년월일**을 담는다. 캐릭터만 담으면 홈에서
 * 리포트로 넘어갈 때 생년월일을 다시 받아야 하는데, 그 재입력이 무료 → 유료 전환
 * 경로의 마찰이 된다. 캐릭터는 여기서 파생하므로 둘이 어긋날 일도 없다.
 *
 * 프로필 드래프트(src/lib/drafts/store.ts)를 쓰지 않는 이유: 그쪽은 성별·이름이
 * 필수인 완성된 프로필 본문을 담는 그릇이라, 성별을 묻지 않는 라이트 퍼널의 입력이
 * 들어가지 않는다. 담을 것도 작아서 Redis 왕복을 만들 이유가 없다.
 *
 * 값이 조작돼도 자기 카드만 바뀌므로 서명하지 않는다. 대신 읽을 때마다 검증한다.
 */
export const ANON_CHARACTER_COOKIE = "character";

/** 세션·드래프트와 같은 7일. 더 길게 두면 주인 없는 생년월일이 남는다. */
const MAX_AGE = 60 * 60 * 24 * 7;

/**
 * 라이트 퍼널이 받는 입력. 시각·출생지·성별을 받지 않는다 — 일주는 날짜만으로 정해진다.
 *
 * 연도 상한이 createProfileSchema(2200)와 다른 이유: 이 값은 곧바로 buildPillars 로
 * 들어가는데 만세력이 지원하는 범위가 1900~2050 이라 그 밖은 예외가 된다.
 */
export const lightBirthSchema = z.object({
  name: z.string().trim().min(1).max(20).nullable().default(null),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z.number().int().min(1900).max(2050),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
});

export type LightBirthBody = z.infer<typeof lightBirthSchema>;

/** 생년월일 → 캐릭터 */
export function characterOfLightBirth(body: LightBirthBody): Character {
  return characterFromBirth({
    year: body.birth.year,
    month: body.birth.month,
    day: body.birth.day,
    calendar: body.calendar,
    isLeapMonth: body.isLeapMonth,
  });
}

export function encodeAnonBirth(value: LightBirthBody): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeAnonBirth(raw: string | undefined): LightBirthBody | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = lightBirthSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function anonCharacterCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

/** 쿠키에 담긴 익명 입력. 없거나 모양이 깨졌으면 null */
export async function readAnonBirth(): Promise<LightBirthBody | null> {
  const store = await cookies();
  return decodeAnonBirth(store.get(ANON_CHARACTER_COOKIE)?.value);
}

/**
 * 쿠키의 입력으로 캐릭터까지 세워서 준다.
 *
 * 세울 수 없는 값(만세력이 못 다루는 음력 조합 등)이면 캐릭터가 없는 것으로 본다 —
 * 이 값은 사용자가 고칠 수 있는 쿠키라 화면이 그것 때문에 죽으면 안 된다.
 */
export async function readAnonCharacter(): Promise<{
  character: Character;
  birth: LightBirthBody;
} | null> {
  const birth = await readAnonBirth();
  if (!birth) return null;
  try {
    return { character: characterOfLightBirth(birth), birth };
  } catch (e) {
    console.error("[anon] characterOfLightBirth", e instanceof Error ? e.message : e);
    return null;
  }
}
