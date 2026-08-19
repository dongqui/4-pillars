/**
 * 추가 폼이 타이핑 중에 들고 있는 상태. match/_lib/to-counterpart.ts 와 같은
 * 모양이되 성별·시각이 없다 — 지도는 일주만 쓰고 일주는 그 둘과 무관하다.
 *
 * 판정 규칙을 화면과 두 벌로 두지 않는다. 두 벌이 되면 "폼은 다 됐다고 하는데
 * 제출은 막힌 상태" 가 반드시 생긴다(to-counterpart.ts 의 draftIssues 주석).
 */
import type { AddPersonBody } from "@/lib/maps/input";

export interface AddDraft {
  name: string;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  y: string;
  m: string;
  d: string;
}

export const emptyAddDraft: AddDraft = {
  name: "", calendar: "solar", isLeapMonth: false, y: "", m: "", d: "",
};

/**
 * 숫자 입력칸 공용 필터. match/_lib/to-counterpart.ts 에 같은 함수가 있지만
 * import 하지 않는다 — 그쪽은 궁합 전용 파일이라 라우트를 가로지른다.
 * home/page.tsx 가 report/_lib/access.ts 의 헬퍼를 두고 같은 판단을 적어뒀다:
 * "레이어를 가로지른다 — 짧으니 그대로 복제한다". 아래 daysInMonth·parseBirth 도
 * 같은 이유로 복제다(그쪽은 성별·시각까지 보므로 규칙 자체도 다르다).
 */
export function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function parseBirth(
  draft: AddDraft,
  currentYear: number,
): { year: number; month: number; day: number } | null {
  if (draft.y.length < 4 || !draft.m || !draft.d) return null;
  const yy = parseInt(draft.y, 10);
  const mm = parseInt(draft.m, 10);
  const dd = parseInt(draft.d, 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (yy < 1900 || yy > currentYear) return null;
  // 음력은 달의 길이가 달라 이 검사가 정확하지 않다. 그래도 걸러 두는 편이 낫다 —
  // 최종 판정은 서버의 만세력이 하고, 여기서는 명백한 오타만 잡는다.
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(yy, mm)) return null;
  return { year: yy, month: mm, day: dd };
}

export type AddDraftField = "name" | "birth";

export function addDraftIssues(
  draft: AddDraft,
  currentYear: number = new Date().getFullYear(),
): AddDraftField[] {
  const issues: AddDraftField[] = [];
  if (!draft.name.trim()) issues.push("name");
  if (!parseBirth(draft, currentYear)) issues.push("birth");
  return issues;
}

/** 완성되지 않았으면 null — 화면은 null 인 동안 제출 버튼을 끈다. */
export function toAddBody(
  draft: AddDraft,
  currentYear: number = new Date().getFullYear(),
): AddPersonBody | null {
  const name = draft.name.trim();
  const birth = parseBirth(draft, currentYear);
  if (!name || !birth) return null;

  return {
    name,
    calendar: draft.calendar,
    // 양력에 윤달이 켜진 채로 남는 경우를 막는다 — 세그먼트를 음력으로 옮겼다가
    // 되돌아오면 토글 값만 남는다.
    isLeapMonth: draft.calendar === "lunar" && draft.isLeapMonth,
    birth,
  };
}
