import { analyze } from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import { toBirthInput } from "@/lib/profiles/to-birth-input";
import type { ProfileRow } from "@/lib/profiles/store";
import { luckFacts } from "./luck";

/**
 * 프로필 → 상담사가 읽을 [사실] 블록.
 *
 * 두 덩어리다. 앞은 원국 — 리포트의 chart 섹션이 쓰는 것과 **같은** 블록이라
 * 상담사가 리포트와 같은 근거 위에서 말한다. 뒤는 요즘 흐름(대운·세운·월운)이다.
 * 둘을 가르는 것 자체가 대화 설계 §16 이다: 원래의 패턴과 지금 지나는 흐름을 한 덩어리로
 * 주면 상담사가 둘을 섞어 말하고, 지나가는 것이 타고난 것으로 읽힌다.
 *
 * 이름·생년월일 같은 개인정보는 어느 쪽에도 없다.
 *
 * 던지지 않는다. 만세력 범위 밖이거나 존재하지 않는 음력 조합이면 null 이다 —
 * characterOfBirth 와 같은 이유로, 상담 하나 때문에 화면이 500 이 되면 안 된다.
 * 흐름만 실패하면 원국으로 답한다(luckFacts 가 null 을 준다) — 흐름 세 줄 때문에
 * 상담이 아예 안 열리는 쪽이 더 나쁘다.
 *
 * `at` 은 흐름을 재는 기준 시각이다. 기본값이 지금이라 같은 상담의 두 턴이 절기
 * 경계를 사이에 두면 블록이 달라질 수 있는데, 상담 하나가 몇 분짜리라 실제로는
 * 일어나지 않는다. 인자로 열어 둔 것은 테스트가 오늘 날짜에 매이지 않게 하려는
 * 것이다(luck.ts 의 캐시 주석 참고).
 */
export function factsForProfile(profile: ProfileRow, at: Date = new Date()): string | null {
  try {
    const analysis = analyze(toBirthInput(profile));
    const luck = luckFacts(analysis, at);
    const chart = chartFacts(analysis);
    return luck ? `${chart}\n\n${luck}` : chart;
  } catch (e) {
    console.error("[consult] facts", e instanceof Error ? e.message : e);
    return null;
  }
}
