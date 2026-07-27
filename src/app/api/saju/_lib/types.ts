import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation, SectionKey } from "./sections";

// 해석의 shape 은 전부 ./sections 레지스트리가 정의한다. 여기서 다시 선언하지 않는다.
export type { Interpretation, SectionKey } from "./sections";

/** API 에러 응답 본문 */
export interface ErrorResponse {
  error: string;
}

/** API 성공 응답 */
export interface SajuResponse {
  /** 요청받은 이름 (해석엔 미반영, echo용) */
  name: string;
  analysis: SajuAnalysis;
  /** 요청한 섹션 중 확보된 것만. 실패·미생성 섹션은 빠진다. */
  interpretation: Partial<Interpretation>;
  /** 요청한 섹션이 전부 캐시에 있었는지 */
  cached: boolean;
}

/**
 * 해석 생성기 (LLM 어댑터). 지금은 stub, 나중에 실제 LLM으로 교체.
 *
 * 섹션 단위로 받는 이유: 한 섹션이 스키마 검증에 실패해도 나머지는 살리고,
 * 캐시에 없는 섹션만 골라 다시 뽑기 위해서다.
 *
 * ⚠️ 캐시 주의: storage="chart" 섹션은 (4기둥 + 성별)로만 캐시된다(chartKey 참조).
 * 따라서 그 섹션들은 원국·성별에서 파생되는 사실만 사용해야 한다.
 * 생시에 의존하는 서술은 storage="luck" 섹션에만 넣는다.
 */
export interface InterpretationGenerator {
  /** 생성 모델 식별자 (DB에 기록) */
  readonly model: string;
  generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>>;
}
