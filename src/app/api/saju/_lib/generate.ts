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
    const rows = analysis.daeun.periods.map((p, i) => ({
      title: `${p.pillar} 대운 (자리표시자 ${i + 1})`,
      desc: `${p.startAge}세부터의 흐름에 대한 자리표시자 서술입니다.`,
    }));
    // 스키마가 1~12개를 요구한다. 대운이 비는 경우(생시 미입력 등)도 최소 한 줄은 채운다.
    const timeline = rows.length > 0
      ? rows.slice(0, 12)
      : [{ title: "대운 자리표시자", desc: "대운 정보가 없어 자리표시자로 채웁니다." }];

    const all: Interpretation = {
      overview: {
        headline: `일간 ${dm} — 자리표시자 헤드라인`,
        summary: `일간이 ${dm}인 사주입니다. 실제 LLM 연동 전 자리표시자 요약입니다.`,
        keywords: [`${dm} 일간`, "자리표시자", "샘플"],
      },
      personality: [
        { title: `${dm}의 성향 1`, body: "자리표시자 본문입니다." },
        { title: `${dm}의 성향 2`, body: "자리표시자 본문입니다." },
      ],
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
      yearlyLuck: timeline,
      daeunOutlook: {
        rows: timeline,
        summary: "대운 흐름 요약 자리표시자입니다.",
        emphasis: "대운 강조 자리표시자입니다.",
      },
    };

    const out: Partial<Interpretation> = {};
    for (const key of keys) assign(out, key, all[key]);
    return out;
  }
}
