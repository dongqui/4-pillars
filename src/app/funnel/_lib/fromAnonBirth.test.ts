import { test, expect } from "vitest";
import { lightBirthSchema } from "@/lib/characters/anon";
import { fromAnonBirth } from "./fromAnonBirth";

test("캐릭터를 만들 때 받은 값만 채운다", () => {
  const initial = fromAnonBirth(
    lightBirthSchema.parse({ name: "동진", birth: { year: 1990, month: 10, day: 25 } }),
  );

  expect(initial).toEqual({
    name: "동진",
    calendar: "solar",
    isLeapMonth: false,
    birth: { y: 1990, m: 10, d: 25 },
  });
  // 물어본 적 없는 값은 채우지 않는다 — 추측해서 넣으면 리포트가 어긋난다
  expect(initial.gender).toBeUndefined();
  expect(initial.time).toBeUndefined();
  expect(initial.birthPlace).toBeUndefined();
});

test("이름을 비워 뒀으면 빈 문자열로 둔다 — 이름 스텝이 그대로 선다", () => {
  const initial = fromAnonBirth(lightBirthSchema.parse({ birth: { year: 2000, month: 2, day: 29 } }));
  expect(initial.name).toBe("");
});

test("음력 윤달을 그대로 옮긴다", () => {
  const initial = fromAnonBirth(
    lightBirthSchema.parse({
      calendar: "lunar",
      isLeapMonth: true,
      birth: { year: 2020, month: 4, day: 5 },
    }),
  );
  expect(initial.calendar).toBe("lunar");
  expect(initial.isLeapMonth).toBe(true);
});
