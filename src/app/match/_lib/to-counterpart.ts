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
  /**
   * "이 프로필 저장하기" 체크박스.
   *
   * CreateProfileBody 에는 실리지 않는다 — 저장 여부는 **행의 값이 아니라 kind** 이고,
   * kind 는 서버가 정한다. 이 값은 요청 본문의 형제 필드(saved / saveCounterpart)로
   * 따로 나가 서버에서 'saved' 와 'temp' 를 가른다.
   *
   * 기본값을 여기서 정하지 않고 폼을 여는 쪽이 넣는다 — "나" 는 켠 채로, "상대" 는
   * 끈 채로 시작하는 것이 시안이고, 그 차이를 emptyDraft 하나에 담을 수 없다.
   */
  saved: boolean;
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
  saved: true,
};

/** 숫자 입력칸 공용 필터 — 붙여넣기로 들어온 비숫자를 지우고 자릿수를 자른다. */
export function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** 생년월일 세 칸. 덜 찼거나 범위를 벗어나면 null. */
function parseBirth(
  draft: Draft,
  currentYear: number,
): { year: number; month: number; day: number } | null {
  if (draft.y.length < 4 || !draft.m || !draft.d) return null;
  const yy = parseInt(draft.y, 10);
  const mm = parseInt(draft.m, 10);
  const dd = parseInt(draft.d, 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (yy < 1900 || yy > currentYear) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(yy, mm)) return null;
  return { year: yy, month: mm, day: dd };
}

/** 시·분 두 칸. timeKnown 일 때만 의미가 있다. */
function parseTime(draft: Draft): { hour: number; minute: number } | null {
  if (!draft.h || !draft.min) return null;
  const hh = parseInt(draft.h, 10);
  const mn = parseInt(draft.min, 10);
  if (Number.isNaN(hh) || hh < 0 || hh > 23) return null;
  if (Number.isNaN(mn) || mn < 0 || mn > 59) return null;
  return { hour: hh, minute: mn };
}

/** 화면이 안내를 붙일 칸 묶음 — 입력칸 하나가 아니라 사용자가 보는 한 줄 단위다. */
export type DraftField = "name" | "birth" | "time";

/**
 * 아직 덜 찬 칸. toCounterpart 가 null 인 **이유**를 화면이 말할 수 있게 있다 —
 * 이유를 모르면 사용자는 제출 버튼이 왜 안 눌리는지 알 방법이 없다.
 *
 * 판정 규칙을 여기서 다시 쓰지 않고 toCounterpart 와 같은 parse 함수를 쓴다.
 * 두 벌로 두면 "폼은 다 됐다고 하는데 제출은 막힌 상태" 가 반드시 생긴다.
 */
export function draftIssues(
  draft: Draft,
  currentYear: number = new Date().getFullYear(),
): DraftField[] {
  const issues: DraftField[] = [];
  if (!draft.name.trim()) issues.push("name");
  if (!parseBirth(draft, currentYear)) issues.push("birth");
  if (draft.timeKnown && !parseTime(draft)) issues.push("time");
  return issues;
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

  const birth = parseBirth(draft, currentYear);
  if (birth === null) return null;

  let time: { hour: number; minute: number } | null = null;
  if (draft.timeKnown) {
    time = parseTime(draft);
    if (time === null) return null;
  }

  return {
    name,
    gender: draft.gender,
    calendar: draft.calendar,
    isLeapMonth: draft.calendar === "lunar" && draft.isLeapMonth,
    birth,
    timeKnown: draft.timeKnown,
    time,
    // 출생지는 이 화면에서 묻지 않는다 — 몰라도 saju-core 가 서울 경도로 물러선다.
    birthPlace: null,
    // 진태양시 보정도 묻지 않는다 — 퍼널도 별도 스텝 없이 항상 true 다.
    trueSolar: true,
  };
}
