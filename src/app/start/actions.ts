"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ANON_CHARACTER_COOKIE,
  anonCharacterCookieOptions,
  characterOfLightBirth,
  encodeAnonCharacter,
  lightBirthSchema,
} from "@/lib/characters/anon";

export interface StartState {
  error: string | null;
}

function toNumber(value: FormDataEntryValue | null): number {
  return Number(typeof value === "string" ? value.trim() : NaN);
}

/** 입력한 날짜가 달력에 실제로 있는 날인지 — 2월 30일 같은 값을 스키마는 통과시킨다 */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/**
 * 생년월일 → 캐릭터 → 쿠키 → 리빌.
 *
 * 서버 액션을 쓰는 이유는 생년월일을 URL 에 싣지 않기 위해서다. 쿼리로 넘기면
 * 리퍼러·브라우저 기록·서버 로그에 남는다.
 *
 * 로그인 여부를 보지 않는다 — 이 입구는 누구에게나 열려 있고, 계산 결과만 쿠키에
 * 담는다. 저장된 프로필로 만드는 일은 기존 퍼널(/funnel)이 맡는다.
 */
export async function createCharacter(_prev: StartState, formData: FormData): Promise<StartState> {
  const parsed = lightBirthSchema.safeParse({
    name: (formData.get("name") as string | null)?.trim() || null,
    calendar: formData.get("calendar"),
    isLeapMonth: formData.get("isLeapMonth") === "on",
    birth: {
      year: toNumber(formData.get("year")),
      month: toNumber(formData.get("month")),
      day: toNumber(formData.get("day")),
    },
  });
  if (!parsed.success) {
    return { error: "1900년부터 2050년 사이의 날짜를 입력해주세요" };
  }

  const { year, month, day } = parsed.data.birth;
  // 음력은 달력이 달라 이 검사를 적용하지 않는다 — 윤달·30일 여부는 만세력이 판단한다.
  if (parsed.data.calendar === "solar" && !isRealDate(year, month, day)) {
    return { error: "없는 날짜예요" };
  }
  if (new Date(year, month - 1, day).getTime() > Date.now()) {
    return { error: "아직 오지 않은 날짜예요" };
  }

  let characterId: number;
  try {
    characterId = characterOfLightBirth(parsed.data).id;
  } catch (e) {
    // 만세력이 못 세우는 조합(존재하지 않는 음력 윤달 등)
    console.error("[start] characterOfLightBirth", e instanceof Error ? e.message : e);
    return { error: "이 날짜로는 사주를 세울 수 없어요. 달력 종류를 확인해주세요" };
  }

  const store = await cookies();
  store.set(
    ANON_CHARACTER_COOKIE,
    encodeAnonCharacter({ characterId, name: parsed.data.name }),
    anonCharacterCookieOptions(),
  );

  redirect("/reveal");
}
