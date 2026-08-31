import { describe, expect, it } from "vitest";
import type { StoredMatchSections } from "@/app/api/matches/_lib/store";
import { matchLoadingMode } from "./to-loading-mode";

const verdict = { headline: "가", summary: "나" };

const stored = (s: Partial<StoredMatchSections>): StoredMatchSections => ({
  have: {},
  missing: [],
  ...s,
});

describe("matchLoadingMode", () => {
  it("빠진 것이 없으면 complete — <Suspense> 를 세우지 않는다", () => {
    expect(matchLoadingMode(stored({ have: { verdict }, missing: [] }))).toBe("complete");
  });

  it("저장된 것이 하나도 없으면 empty — 순수 스피너에 히어로도 감춘다", () => {
    expect(matchLoadingMode(stored({ have: {}, missing: ["verdict", "chemistry"] }))).toBe("empty");
  });

  /*
    이 줄이 이번 수정의 요점이다. 예전에는 이 경우도 화면 전체가 스피너였다 —
    여섯 섹션이 DB 에 있는데 한 섹션의 LLM 왕복을 기다리느라 아무것도 안 보였다.
  */
  it("일부만 있으면 partial — 있는 것부터 보여주고 나머지를 기다린다", () => {
    expect(matchLoadingMode(stored({ have: { verdict }, missing: ["chemistry"] }))).toBe("partial");
  });

  // 생성이 통째로 실패해 아무것도 저장되지 않은 궁합과, 한 번도 열어본 적 없는
  // 궁합은 저장소에서 똑같이 보인다. 둘 다 보여줄 것이 없으니 같은 화면이 맞다.
  it("빠진 것이 많아도 있는 것이 하나라도 있으면 partial 이다", () => {
    expect(
      matchLoadingMode(
        stored({ have: { verdict }, missing: ["chemistry", "closeness", "bond", "together"] }),
      ),
    ).toBe("partial");
  });
});
