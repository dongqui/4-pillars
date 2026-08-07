import { describe, it, expect } from "vitest";
import type { FunnelData } from "../_context/FunnelContext";
import { hasInput } from "./hasInput";

// FunnelContext 의 initialData 와 같은 모양 — 아무것도 입력하지 않은 상태.
const empty: FunnelData = {
  name: "",
  gender: null,
  calendar: "solar",
  isLeapMonth: false,
  birth: null,
  timeKnown: true,
  time: null,
  birthPlace: null,
  trueSolar: true,
};

describe("hasInput", () => {
  it("초기 상태는 입력 없음", () => {
    expect(hasInput(empty)).toBe(false);
  });

  it("공백만 있는 이름은 입력으로 보지 않는다", () => {
    expect(hasInput({ ...empty, name: "   " })).toBe(false);
  });

  it("기본값이 있는 필드는 세지 않는다", () => {
    expect(
      hasInput({
        ...empty,
        calendar: "lunar",
        isLeapMonth: true,
        timeKnown: false,
        trueSolar: false,
      })
    ).toBe(false);
  });

  it("사용자가 채운 값이 하나라도 있으면 입력 있음", () => {
    expect(hasInput({ ...empty, name: "김동진" })).toBe(true);
    expect(hasInput({ ...empty, gender: "male" })).toBe(true);
    expect(hasInput({ ...empty, birth: { y: 1990, m: 10, d: 25 } })).toBe(true);
    expect(hasInput({ ...empty, time: { h: 15, m: 20 } })).toBe(true);
    expect(hasInput({ ...empty, birthPlace: { country: "KR", regionId: "seoul" } })).toBe(true);
  });
});
