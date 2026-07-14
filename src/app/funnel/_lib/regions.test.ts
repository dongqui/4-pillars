import { describe, it, expect } from "vitest";
import {
  getRegions,
  findRegion,
  resolveLongitude,
  DEFAULT_REGION_ID,
} from "./regions";

describe("regions", () => {
  it("KR 17개, JP 47개를 가진다", () => {
    expect(getRegions("KR")).toHaveLength(17);
    expect(getRegions("JP")).toHaveLength(47);
  });

  it("id는 국가 내에서 유일하다", () => {
    for (const c of ["KR", "JP"] as const) {
      const ids = getRegions(c).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("기본 지역 id가 실제로 존재한다", () => {
    expect(findRegion("KR", DEFAULT_REGION_ID.KR)).toBeDefined();
    expect(findRegion("JP", DEFAULT_REGION_ID.JP)).toBeDefined();
  });

  it("resolveLongitude는 선택된 지역의 경도를 반환한다", () => {
    expect(resolveLongitude({ country: "KR", regionId: "seoul" }, "KR")).toBe(126.98);
    expect(resolveLongitude({ country: "JP", regionId: "tokyo" }, "JP")).toBe(139.69);
  });

  it("resolveLongitude는 null이면 국가 기본 경도를 반환한다", () => {
    expect(resolveLongitude(null, "KR")).toBe(126.98); // seoul
    expect(resolveLongitude(null, "JP")).toBe(139.69); // tokyo
  });
});
