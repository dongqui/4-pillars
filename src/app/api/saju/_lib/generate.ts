import type { SajuAnalysis } from "@/lib/saju-core";
import { assign, type Interpretation, type SectionKey } from "./sections";
import type { InterpretationGenerator } from "./types";

/**
 * 자리표시자 생성기. 실제 LLM 연동 전까지 파이프라인을 끝까지 동작시키기 위한
 * 결정적 stub. 일간(dayMaster)만으로 고정 문구를 만든다.
 * 실제 LLM 어댑터는 같은 InterpretationGenerator 인터페이스를 구현해 교체한다.
 */
export class StubGenerator implements InterpretationGenerator {
  readonly model = "stub";

  async generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>> {
    const dm = analysis.chart.dayMaster;

    const all: Interpretation = {
      overview: {
        headline: `일간 ${dm} — 자리표시자 헤드라인`,
        summary: `일간이 ${dm}인 사주입니다. 실제 LLM 연동 전 자리표시자 요약입니다.`,
        traits: [1, 2, 3, 4].map((n) => ({
          title: `${dm} 성향 ${n}`,
          body: "자리표시자 본문입니다.",
          basis: "자리표시자 근거입니다.",
        })),
      },
      outerVsInner: { outward: "겉모습 자리표시자.", inner: "속마음 자리표시자." },
      strengths: [
        { title: `${dm} 일간의 강점 1`, body: "자리표시자 본문입니다." },
        { title: `${dm} 일간의 강점 2`, body: "자리표시자 본문입니다." },
      ],
      cautions: {
        items: [`${dm} 일간의 약점 1 (자리표시자)`, `${dm} 일간의 약점 2 (자리표시자)`],
        tip: "실천 팁 자리표시자입니다.",
      },
      emotion: [
        { label: "스트레스 상황", body: "자리표시자 본문입니다." },
        { label: "회복 방식", body: "자리표시자 본문입니다." },
      ],
      decisions: {
        deciding: "자리표시자 본문입니다.",
        starting: "자리표시자 본문입니다.",
        unsure: "자리표시자 본문입니다.",
        afterDeciding: "자리표시자 본문입니다.",
      },
      workStyle: {
        starting: "자리표시자 본문입니다.",
        progressing: "자리표시자 본문입니다.",
        collaborating: "자리표시자 본문입니다.",
        troubled: "자리표시자 본문입니다.",
        performing: "자리표시자 본문입니다.",
      },
      relating: [
        { label: "첫인상", value: "자리표시자" },
        { label: "거리 두기", value: "자리표시자" },
        { label: "갈등 대응", value: "자리표시자" },
      ],
      environment: {
        energizing: [
          "힘이 나는 조건 1 (자리표시자)",
          "힘이 나는 조건 2 (자리표시자)",
          "힘이 나는 조건 3 (자리표시자)",
        ],
        draining: [
          "기운이 빠지는 조건 1 (자리표시자)",
          "기운이 빠지는 조건 2 (자리표시자)",
          "기운이 빠지는 조건 3 (자리표시자)",
        ],
        summary: "환경 요약 자리표시자입니다.",
        emphasis: "환경 요약 자리표시자",
      },
      love: [
        { label: "끌리는 유형", body: "자리표시자 본문입니다." },
        { label: "관계 유지", body: "자리표시자 본문입니다." },
      ],
      compatibility: {
        good: ["잘 맞는 유형 1 (자리표시자)", "잘 맞는 유형 2 (자리표시자)"],
        clash: ["부딪히는 유형 1 (자리표시자)", "부딪히는 유형 2 (자리표시자)"],
      },
      wealth: {
        points: [
          { label: "버는 방식", body: "자리표시자 본문입니다." },
          { label: "쓰는 방식", body: "자리표시자 본문입니다." },
        ],
        summary: "재물 요약 자리표시자입니다.",
        emphasis: "재물 강조 자리표시자입니다.",
      },
      playbook: [
        { title: "실천 자리표시자 1", body: "자리표시자 본문입니다." },
        { title: "실천 자리표시자 2", body: "자리표시자 본문입니다." },
        { title: "실천 자리표시자 3", body: "자리표시자 본문입니다." },
        { title: "실천 자리표시자 4", body: "자리표시자 본문입니다." },
      ],
    };

    const out: Partial<Interpretation> = {};
    for (const key of keys) assign(out, key, all[key]);
    return out;
  }
}
