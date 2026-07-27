import { z } from "zod";

// 여러 섹션이 공유하는 잎 스키마. 리포트 화면(report-content.ts)이 이 타입을
// 그대로 import 하므로, LLM 이 받는 구조와 화면이 읽는 타입이 갈라질 수 없다.

/** 제목 + 본문 — 01 성향, 03 강점 */
export const TitledText = z
  .object({ title: z.string().min(1), body: z.string().min(1) })
  .strict();
export type TitledText = z.infer<typeof TitledText>;

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
