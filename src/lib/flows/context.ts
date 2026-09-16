// 흐름을 만들기 직전에 사용자가 고르는 "지금 상황". 화면·API·프롬프트가 같은
// 정의역을 보는 유일한 출처다. DB·환경변수를 import 하지 않는다.
import { z } from "zod";
import { flowYearAt } from "@/lib/saju-core";

export const CAREER_OPTIONS = [
  { value: "employed", label: "직장인" },
  { value: "freelance", label: "프리랜서" },
  { value: "business", label: "자영업 · 사업" },
  { value: "student", label: "학생" },
  { value: "preparing", label: "취업 · 진로 준비 중" },
  { value: "taking_break", label: "잠시 쉬는 중" },
  { value: "home_care", label: "가사 · 돌봄" },
  { value: "unspecified", label: "말하고 싶지 않아요" },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: "single", label: "솔로" },
  { value: "crushing", label: "썸" },
  { value: "dating", label: "연애 중" },
  { value: "partnered", label: "기혼 · 파트너" },
  { value: "complicated", label: "복잡해요" },
  { value: "unspecified", label: "말하고 싶지 않아요" },
] as const;

export const CONCERN_OPTIONS = [
  { value: "career", label: "일" },
  { value: "money", label: "돈" },
  { value: "romance", label: "연애" },
  { value: "relationships", label: "대인관계" },
  { value: "overall", label: "전체" },
] as const;

/** 정의역을 배열에서 파생한다 — 화면에는 있고 스키마에는 없는 선택지를 못 만들게. */
function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];
}

export const CAREER = valuesOf(CAREER_OPTIONS);
export const RELATIONSHIP = valuesOf(RELATIONSHIP_OPTIONS);
export const CONCERN = valuesOf(CONCERN_OPTIONS);
export type Career = (typeof CAREER)[number];
export type Relationship = (typeof RELATIONSHIP)[number];
export type Concern = (typeof CONCERN)[number];

/** 클라이언트가 보내는 것. reference·asOf 는 서버가 파생하므로 받지 않는다(strict). */
export const contextAnswerSchema = z
  .object({ career: z.enum(CAREER), relationship: z.enum(RELATIONSHIP), mainConcern: z.enum(CONCERN) })
  .strict();
export type ContextAnswer = z.infer<typeof contextAnswerSchema>;

/** 시트의 제출 버튼이 열리는 조건. */
export function isContextComplete(p: {
  career: Career | null; relationship: Relationship | null; mainConcern: Concern | null;
}): p is ContextAnswer {
  return p.career !== null && p.relationship !== null && p.mainConcern !== null;
}

export type YearRelation = "past" | "present" | "future";
export type ContextReference = "selected_year_start" | "current_baseline" | "unspecified";

export interface ContextSnapshot {
  career: Career; relationship: Relationship; mainConcern: Concern;
  reference: ContextReference;
  /** ISO. 서버 시각 */
  asOf: string;
}

/** 선택한 해가 지금 명리 연도 기준으로 어디인가. 화면의 지난/올해/다가올 태그와 같은 출처다. */
export function yearRelationOf(flowYear: number, now: Date): YearRelation {
  const current = flowYearAt(now).year;
  return flowYear < current ? "past" : flowYear > current ? "future" : "present";
}

/**
 * 답 → 스냅샷. 던지는 경우가 없다 — 대조할 클라이언트 값이 없기 때문이다.
 * 상황 중 하나라도 답했으면 기준 시점이 생긴다(지난 해면 그 해 초, 아니면 지금).
 */
export function normalizeFlowContext(
  answer: ContextAnswer | undefined,
  opts: { relation: YearRelation; now: Date },
): ContextSnapshot {
  const career = answer?.career ?? "unspecified";
  const relationship = answer?.relationship ?? "unspecified";
  const mainConcern = answer?.mainConcern ?? "overall";
  const answered = career !== "unspecified" || relationship !== "unspecified";
  const reference: ContextReference = !answered
    ? "unspecified"
    : opts.relation === "past" ? "selected_year_start" : "current_baseline";
  return { career, relationship, mainConcern, reference, asOf: opts.now.toISOString() };
}

/** 02 섹션의 화면 제목. UI 와 모델 입력(request.careerTitle)이 같은 함수를 쓴다. */
export function careerTitle(c: Career): "직업운" | "학업운" | "취업·진로운" | "일과 활동" {
  switch (c) {
    case "employed": case "freelance": case "business": return "직업운";
    case "student": return "학업운";
    case "preparing": return "취업·진로운";
    default: return "일과 활동";
  }
}
