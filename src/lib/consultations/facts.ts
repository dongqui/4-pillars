import { analyze } from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import { toBirthInput } from "@/app/report/_lib/to-birth-input";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 프로필 → 상담사가 읽을 [사실] 블록.
 *
 * 리포트의 chart 섹션이 쓰는 것과 같은 블록이다 — 상담사가 리포트와 같은 근거
 * 위에서 말하게 하려는 것이고, 그래서 이름·생년월일 같은 개인정보는 여기 없다.
 *
 * 던지지 않는다. 만세력 범위 밖이거나 존재하지 않는 음력 조합이면 null 이다 —
 * characterOfBirth 와 같은 이유로, 상담 하나 때문에 화면이 500 이 되면 안 된다.
 */
export function factsForProfile(profile: ProfileRow): string | null {
  try {
    return chartFacts(analyze(toBirthInput(profile)));
  } catch (e) {
    console.error("[consult] facts", e instanceof Error ? e.message : e);
    return null;
  }
}
