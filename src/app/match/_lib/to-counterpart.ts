import type { CreateProfileBody } from "@/lib/profiles/input";

/**
 * "새로 입력" 폼이 타이핑 중에 들고 있는 상태. 다 채우기 전까지는 문자열이라
 * 파싱 전 형태를 그대로 둔다 — 매 입력마다 완결된 CreateProfileBody 를 요구하면
 * 첫 글자를 치는 순간부터 오류로 보이게 된다.
 */
export interface Draft {
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  y: string;
  m: string;
  d: string;
  timeKnown: boolean;
  h: string;
  min: string;
}

export const emptyDraft: Draft = {
  name: "",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  y: "",
  m: "",
  d: "",
  timeKnown: true,
  h: "",
  min: "",
};

/** 숫자 입력칸 공용 필터 — 붙여넣기로 들어온 비숫자를 지우고 자릿수를 자른다. */
export function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/**
 * 입력이 완전하지 않거나 범위를 벗어나면 null — NewPersonForm 은 이 값을 그대로
 * 부모에 올리고, CounterpartPicker 는 null 인 동안 제출을 막는다.
 *
 * currentYear 를 주입받는 이유: 시스템 시계에 테스트가 매이지 않게 하기 위해서다
 * (src/lib/profiles/store.ts 가 client 를 주입받는 것과 같은 판단).
 */
export function toCounterpart(
  draft: Draft,
  currentYear: number = new Date().getFullYear(),
): CreateProfileBody | null {
  const name = draft.name.trim();
  if (!name) return null;

  if (draft.y.length < 4 || !draft.m || !draft.d) return null;
  const yy = parseInt(draft.y, 10);
  const mm = parseInt(draft.m, 10);
  const dd = parseInt(draft.d, 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (yy < 1900 || yy > currentYear) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(yy, mm)) return null;

  let time: { hour: number; minute: number } | null = null;
  if (draft.timeKnown) {
    if (!draft.h || !draft.min) return null;
    const hh = parseInt(draft.h, 10);
    const mn = parseInt(draft.min, 10);
    if (Number.isNaN(hh) || hh < 0 || hh > 23 || Number.isNaN(mn) || mn < 0 || mn > 59) return null;
    time = { hour: hh, minute: mn };
  }

  return {
    name,
    gender: draft.gender,
    calendar: draft.calendar,
    isLeapMonth: draft.calendar === "lunar" && draft.isLeapMonth,
    birth: { year: yy, month: mm, day: dd },
    timeKnown: draft.timeKnown,
    time,
    // 출생지는 이 화면에서 묻지 않는다 — 몰라도 saju-core 가 서울 경도로 물러선다.
    birthPlace: null,
    // 진태양시 보정도 묻지 않는다 — 퍼널도 별도 스텝 없이 항상 true 다.
    trueSolar: true,
  };
}
