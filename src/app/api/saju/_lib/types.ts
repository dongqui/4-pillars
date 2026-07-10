import type { SajuAnalysis } from "@/lib/saju-core";

/** 제목 + 본문 형태의 해석 섹션 */
export interface Section {
  title: string;
  body: string;
}

/**
 * 구조화 해석 (무료 범위). 유료 섹션은 추후 확장:
 * personality / career / wealth / love / marriage / yongsin / daeun ...
 */
export interface Interpretation {
  /** 일간 성향 */
  ilgan: Section;
  /** 강점 */
  strengths: string[];
  /** 약점 */
  weaknesses: string[];
  /** 인간관계 특징 */
  relationships: Section;
}

/** API 에러 응답 본문 */
export interface ErrorResponse {
  error: string;
}

/** API 성공 응답 */
export interface SajuResponse {
  /** 요청받은 이름 (해석엔 미반영, echo용) */
  name: string;
  analysis: SajuAnalysis;
  interpretation: Interpretation;
  /** 캐시 적중 여부 */
  cached: boolean;
}

/**
 * 해석 생성기 (LLM 어댑터). 지금은 stub, 나중에 실제 LLM으로 교체.
 *
 * ⚠️ 캐시 주의: 해석은 (4기둥 + 성별)로만 캐시된다(chartKey 참조). 따라서
 * generate()는 원국(4기둥)·성별에서 파생되는 사실만 사용해야 한다.
 * analysis.daeun 처럼 정확한 생시에 의존하는 값을 해석에 반영하려면
 * 캐시 키(chartKey)를 그 입력까지 포함하도록 넓혀야 한다.
 */
export interface InterpretationGenerator {
  /** 생성 모델 식별자 (DB에 기록) */
  readonly model: string;
  generate(analysis: SajuAnalysis): Promise<Interpretation>;
}
