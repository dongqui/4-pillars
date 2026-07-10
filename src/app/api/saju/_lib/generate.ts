import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation, InterpretationGenerator } from "./types";

/**
 * 자리표시자 생성기. 실제 LLM 연동 전까지 파이프라인을 끝까지 동작시키기 위한
 * 결정적 stub. 일간(dayMaster)만으로 고정 문구를 만든다.
 * 실제 LLM 어댑터는 같은 InterpretationGenerator 인터페이스를 구현해 교체한다.
 */
export class StubGenerator implements InterpretationGenerator {
  readonly model = "stub";

  async generate(analysis: SajuAnalysis): Promise<Interpretation> {
    const dm = analysis.chart.dayMaster;
    return {
      ilgan: {
        title: `일간 ${dm}`,
        body: `일간이 ${dm}인 사주입니다. (자리표시자 해석 — 실제 LLM 연동 전)`,
      },
      strengths: [`${dm} 일간의 강점 (자리표시자)`],
      weaknesses: [`${dm} 일간의 약점 (자리표시자)`],
      relationships: {
        title: "인간관계",
        body: "인간관계 특징에 대한 자리표시자 해석입니다.",
      },
    };
  }
}
