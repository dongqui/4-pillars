import { describe, expect, it } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { toPersonOption } from "./to-person-option";

const base: ProfileRow = {
  id: "1", name: "김동진", gender: "male", calendar: "solar", isLeapMonth: false,
  birth: { year: 1990, month: 4, day: 5 }, timeKnown: true, time: { hour: 9, minute: 0 },
  birthPlace: null, trueSolar: true, createdAt: "2026-01-01", isPaid: false, kind: "self",
};

describe("toPersonOption", () => {
  it("생년월일을 0 채움으로 보여준다", () => {
    expect(toPersonOption(base).birthLabel).toBe("1990.04.05");
  });

  it("이니셜은 첫 글자다", () => {
    expect(toPersonOption(base).initial).toBe("김");
  });

  it("이름이 비면 물음표로 물러선다 — 아바타를 통째로 비우지 않는다", () => {
    expect(toPersonOption({ ...base, name: "  " }).initial).toBe("?");
  });

  it("kind 를 그대로 옮긴다 — 저장 모달이 이걸 보고 뜰지 정한다", () => {
    expect(toPersonOption({ ...base, kind: "other" }).kind).toBe("other");
  });
});
