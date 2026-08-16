import { z } from "zod";
import { cookies } from "next/headers";
import { characterFromBirth, type Character } from "@/lib/saju-core";
import { characterById } from "@/lib/saju-core/character";

/**
 * 로그인하지 않은 사람의 캐릭터를 나르는 쿠키.
 *
 * 프로필 드래프트(src/lib/drafts/store.ts)와 달리 Redis 를 쓰지 않는다. 담는 것이
 * 60갑자 순번 하나와 (선택) 이름뿐이라 쿠키에 들어가고, 무엇보다 **생년월일을
 * 어디에도 남기지 않는다** — "생일은 캐릭터 계산에만 사용" 이라는 화면 문구가
 * 문구로만 남지 않게 하려면 계산 직후 버리는 쪽이 맞다.
 *
 * 값이 조작돼도 자기 카드만 바뀌므로 서명하지 않는다. 대신 읽을 때마다 검증한다.
 */
export const ANON_CHARACTER_COOKIE = "character";

/** 세션·드래프트와 같은 7일. 더 길게 두면 주인 없는 캐릭터가 남는다. */
const MAX_AGE = 60 * 60 * 24 * 7;

const anonCharacterSchema = z.object({
  /** 60갑자 순번 (갑자=0 … 계해=59) */
  characterId: z.number().int().min(0).max(59),
  /** 라이트 퍼널의 이름은 선택 입력이다 */
  name: z.string().trim().min(1).max(20).nullable(),
});

export type AnonCharacter = z.infer<typeof anonCharacterSchema>;

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

/** 생년월일 → 캐릭터. 이 함수를 지나면 생년월일은 들고 다니지 않는다. */
export function characterOfLightBirth(body: LightBirthBody): Character {
  return characterFromBirth({
    year: body.birth.year,
    month: body.birth.month,
    day: body.birth.day,
    calendar: body.calendar,
    isLeapMonth: body.isLeapMonth,
  });
}

export function encodeAnonCharacter(value: AnonCharacter): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeAnonCharacter(raw: string | undefined): AnonCharacter | null {
  if (!raw) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const parsed = anonCharacterSchema.safeParse(json);
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

/** 쿠키에 담긴 익명 캐릭터. 없거나 모양이 깨졌으면 null */
export async function readAnonCharacter(): Promise<{
  character: Character;
  name: string | null;
} | null> {
  const store = await cookies();
  const value = decodeAnonCharacter(store.get(ANON_CHARACTER_COOKIE)?.value);
  if (!value) return null;
  return { character: characterById(value.characterId), name: value.name };
}
