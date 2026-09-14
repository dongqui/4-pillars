// 흐름을 만들기 직전에 사용자가 고르는 "지금 상황". 화면·API·프롬프트 세 자리가
// 같은 정의역을 보게 하는 유일한 출처다.
//
// 코드(job/love 값)와 사람이 읽는 라벨을 함께 둔다 — 화면이 라벨을 보내고 서버가
// 그 문자열을 그대로 저장하면 문구를 다듬는 순간 옛 행과 새 행의 값이 갈린다.
// 저장되는 것은 코드고, 라벨은 화면과 프롬프트가 각자 이 표에서 꺼내 쓴다.
//
// "undisclosed"(말하고 싶지 않아요)를 값으로 둔다. 화면에서 그냥 건너뛰게 하면
// "안 물어봤다" 와 "물어봤는데 답하지 않았다" 가 같은 null 로 뭉개진다 — 프롬프트가
// 둘을 다르게 다뤄야 하는 자리라(전자는 상황 블록 자체가 없고, 후자는 상황을
// 모른다는 사실이 있다) 구분해서 저장한다.

import { z } from "zod";

export const JOB_OPTIONS = [
  { value: "employed", label: "직장인" },
  { value: "self_employed", label: "자영업 · 사업" },
  { value: "freelancer", label: "프리랜서" },
  { value: "student", label: "학생" },
  { value: "job_seeking", label: "취업 준비 중" },
  { value: "resting", label: "잠시 쉬는 중" },
  { value: "undisclosed", label: "말하고 싶지 않아요" },
] as const;

export const LOVE_OPTIONS = [
  { value: "single", label: "솔로" },
  { value: "crushing", label: "썸" },
  { value: "dating", label: "연애 중" },
  { value: "married", label: "기혼" },
  { value: "complicated", label: "복잡해요" },
  { value: "undisclosed", label: "말하고 싶지 않아요" },
] as const;

export type FlowJob = (typeof JOB_OPTIONS)[number]["value"];
export type FlowLove = (typeof LOVE_OPTIONS)[number]["value"];

/**
 * 정의역을 배열에서 파생시킨다 — 값 목록을 두 벌로 두면 화면에는 있고 스키마에는
 * 없는 선택지가 생기고, 그 선택지를 고른 사용자만 400 을 받는다.
 */
function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as unknown as [
    T[number]["value"],
    ...T[number]["value"][],
  ];
}

export const flowSituationSchema = z
  .object({
    job: z.enum(valuesOf(JOB_OPTIONS)),
    love: z.enum(valuesOf(LOVE_OPTIONS)),
  })
  .strict();

export type FlowSituation = z.infer<typeof flowSituationSchema>;

const JOB_LABEL = Object.fromEntries(JOB_OPTIONS.map((o) => [o.value, o.label])) as Record<
  FlowJob,
  string
>;
const LOVE_LABEL = Object.fromEntries(
  LOVE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<FlowLove, string>;

export function jobLabel(v: FlowJob): string {
  return JOB_LABEL[v];
}

export function loveLabel(v: FlowLove): string {
  return LOVE_LABEL[v];
}

/**
 * DB(jsonb)에서 읽은 값 → FlowSituation. 모양이 어긋나면 null 로 접는다.
 *
 * months(store.toMonths)와 달리 던지지 않는다 — months 는 화면 전체가 "12칸이
 * 있다" 를 전제로 짜여 있어 없으면 리포트가 깨지지만, 상황은 프롬프트에 색을
 * 더하는 보조 사실이라 없으면 그 블록만 빠진다. 옛 행(NULL)이 지나가는 길과
 * 같은 길이다.
 */
export function toSituation(v: unknown): FlowSituation | null {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (raw == null) return null;
  const parsed = flowSituationSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[toSituation] 모양이 맞지 않아 버립니다", raw);
    return null;
  }
  return parsed.data;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
