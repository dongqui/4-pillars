import { describe, expect, it } from "vitest";
import { buildChart } from "./chart.js";

describe("buildChart", () => {
  it("1990-05-15 14:30 서울 → 경오·신사·경진·계미", () => {
    const c = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });
    expect(c.year.korean).toBe("경오");
    expect(c.month.korean).toBe("신사");
    expect(c.day.korean).toBe("경진");
    expect(c.hour?.korean).toBe("계미");
    expect(c.dayMaster).toBe("경");
    expect(c.year.stem).toBe("경");
    expect(c.year.branch).toBe("오");
    expect(c.day.branch).toBe("진");
  });

  it("시간 미입력 시 시주는 null", () => {
    const c = buildChart({ year: 1990, month: 5, day: 15, gender: "female" });
    expect(c.hour).toBeNull();
  });

  it("음력 입력을 양력으로 변환해 계산", () => {
    const c = buildChart({ year: 1990, month: 4, day: 21, calendar: "lunar", gender: "male" });
    expect(c.solar).toMatchObject({ year: 1990, month: 5, day: 15 });
  });
});
