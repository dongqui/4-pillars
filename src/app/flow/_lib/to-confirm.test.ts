import { describe, expect, it } from "vitest";
import { formatPeriod, toConfirmState } from "./to-confirm";

const period = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};
const profile = { id: "11", name: "김OO" };

describe("toConfirmState", () => {
  it("프로필이 없으면 no_profile", () => {
    expect(toConfirmState({ profile: null, period, existing: null, owned: false }).kind)
      .toBe("no_profile");
  });

  it("행이 없으면 new — 이용권을 쓴다고 안내한다", () => {
    expect(toConfirmState({ profile, period, existing: null, owned: false }).kind).toBe("new");
  });

  it("⚠️ 행은 있어도 권한이 없으면 new 다 — 행 존재로 판정하면 안내와 실제가 어긋난다", () => {
    expect(toConfirmState({ profile, period, existing: { id: "7" }, owned: false }).kind)
      .toBe("new");
  });

  it("행도 있고 권한도 있으면 owned — 이어서 보기", () => {
    const out = toConfirmState({ profile, period, existing: { id: "7" }, owned: true });
    expect(out).toMatchObject({ kind: "owned", flowId: "7" });
  });
});

describe("formatPeriod", () => {
  it("연도를 감추지 않는다 — 구매 범위와 다음 결제 시점을 알아야 한다", () => {
    const text = formatPeriod(period.start, period.end);
    expect(text).toContain("2026년");
    expect(text).toContain("2027년");
  });

  it("입춘 시각을 그대로 노출하지 않고 '초' 로 부드럽게 말한다", () => {
    expect(formatPeriod(period.start, period.end)).toBe(
      "2026년 2월 초부터 2027년 2월 초까지",
    );
  });
});
