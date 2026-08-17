import { test, expect } from "vitest";
import { createProfileSchema } from "@/lib/profiles/input";
import { draftToSubject } from "./subject";

const base = {
  name: "동진",
  gender: "male" as const,
  birth: { year: 1990, month: 10, day: 25 },
};

test("드래프트를 리포트 주체로 옮긴다", () => {
  const draft = createProfileSchema.parse({
    ...base,
    calendar: "lunar",
    isLeapMonth: true,
    timeKnown: true,
    time: { hour: 15, minute: 20 },
    birthPlace: { country: "KR", regionId: "seoul" },
    trueSolar: false,
  });

  expect(draftToSubject(draft)).toEqual({
    name: "동진",
    gender: "male",
    calendar: "lunar",
    isLeapMonth: true,
    birth: base.birth,
    time: { hour: 15, minute: 20 },
    birthPlace: { country: "KR", regionId: "seoul" },
    trueSolar: false,
  });
});

test("시간을 모른다고 했으면 남아 있는 시각을 버린다", () => {
  // toProfileRow 가 DB 행에 하는 것과 같은 처리 — 어긋나면 로그인 전후로 시주가 달라진다
  const draft = createProfileSchema.parse({
    ...base,
    timeKnown: false,
    time: { hour: 3, minute: 0 },
  });

  expect(draftToSubject(draft).time).toBeNull();
});
