import { describe, it, expect } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { toOrderTarget } from "./to-order";

const profile = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: "1",
  name: "이정숙",
  gender: "female",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1963, month: 4, day: 12 },
  timeKnown: false,
  time: null,
  birthPlace: null,
  trueSolar: false,
  createdAt: "2026-08-05T00:00:00Z",
  isPaid: false,
  kind: "self",
  ...over,
});

describe("toOrderTarget", () => {
  it("이름과 생년월일을 한 줄로", () => {
    expect(toOrderTarget(profile())).toEqual({ initial: "이", label: "이정숙 (1963.04.12)" });
  });

  it("한 자리 월·일은 0을 채운다", () => {
    expect(toOrderTarget(profile({ birth: { year: 2001, month: 1, day: 3 } })).label).toBe(
      "이정숙 (2001.01.03)",
    );
  });

  // 음력 입력이어도 사용자가 적어 넣은 날짜를 그대로 보여준다 — 환산된 양력을 보여주면
  // 결제 직전에 "내가 입력한 날짜가 아닌데" 가 된다.
  it("음력 프로필도 입력한 날짜 그대로", () => {
    expect(toOrderTarget(profile({ calendar: "lunar", isLeapMonth: true })).label).toBe(
      "이정숙 (1963.04.12)",
    );
  });

  it("이름 앞뒤 공백은 이니셜에 새지 않는다", () => {
    expect(toOrderTarget(profile({ name: " 김수현 " }))).toEqual({
      initial: "김",
      label: "김수현 (1963.04.12)",
    });
  });

  it("이름이 비어도 아바타가 통째로 비지 않는다", () => {
    expect(toOrderTarget(profile({ name: "" })).initial).toBe("?");
  });
});
