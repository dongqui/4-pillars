import { z } from "zod";

// 여러 섹션이 공유하는 잎 스키마. 리포트 화면(report-content.ts)이 이 타입을
// 그대로 import 하므로, LLM 이 받는 구조와 화면이 읽는 타입이 갈라질 수 없다.

/** 제목 + 본문 — 01 성향, 03 강점 */
export const TitledText = z
  .object({ title: z.string().min(1), body: z.string().min(1) })
  .strict();
export type TitledText = z.infer<typeof TitledText>;

/**
 * 키워드 제목 + 쉬운 말 본문 + 사주 근거 한 줄 — 01 핵심 성향.
 *
 * title 은 히어로의 키워드 칩으로도 그대로 렌더된다(to-report-content.ts).
 * 한 문자열이 두 자리에 쓰이므로 칩과 카드 제목이 갈라질 수 없다.
 *
 * basis 는 레지스트리 전체에서 사주 용어가 허용되는 유일한 자리다
 * (system.ts 의 "섹션 지시문이 명시적으로 요구하면" 예외).
 */
export const TraitNote = z
  .object({
    // 히어로에서는 rounded-full 칩, 01 카드에서는 제목으로 쓰인다 — 두 레이아웃
    // 모두 문장형 제목을 못 견딘다. 20자로 막아 칩이 문장처럼 늘어지지 않게 한다.
    title: z.string().min(1).max(20),
    body: z.string().min(1),
    basis: z.string().min(1),
  })
  .strict();
export type TraitNote = z.infer<typeof TraitNote>;

/** 라벨 + 본문 — 05 감정, 08 연애, 10 재물 */
export const LabeledText = z
  .object({ label: z.string().min(1), body: z.string().min(1) })
  .strict();
export type LabeledText = z.infer<typeof LabeledText>;

/** 라벨 + 짧은 값 — 06 관계 맺기 */
export const KeyValue = z
  .object({ label: z.string().min(1), value: z.string().min(1) })
  .strict();
export type KeyValue = z.infer<typeof KeyValue>;

/**
 * 제목 + 설명 — 11 세운, 12 대운.
 * 기간(2026년 / 32–41세)은 계산값이라 여기 없다. 조립 단계에서 인덱스로 짝짓는다.
 */
export const TimelineNote = z
  .object({ title: z.string().min(1), desc: z.string().min(1) })
  .strict();
export type TimelineNote = z.infer<typeof TimelineNote>;
