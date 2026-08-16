import { test, expect } from "vitest";
import {
  characterOfLightBirth,
  decodeAnonCharacter,
  encodeAnonCharacter,
  lightBirthSchema,
} from "./anon";

test("쿠키 값은 왕복해도 같은 값이다", () => {
  const value = { characterId: 42, name: "동진" };
  expect(decodeAnonCharacter(encodeAnonCharacter(value))).toEqual(value);
  expect(decodeAnonCharacter(encodeAnonCharacter({ characterId: 0, name: null }))).toEqual({
    characterId: 0,
    name: null,
  });
});

test("깨진 쿠키는 없는 것으로 취급한다", () => {
  expect(decodeAnonCharacter(undefined)).toBeNull();
  expect(decodeAnonCharacter("")).toBeNull();
  expect(decodeAnonCharacter("not-base64url!!")).toBeNull();
  // 범위 밖 순번은 characterById 가 던지므로 여기서 걸러야 한다
  expect(decodeAnonCharacter(encodeAnonCharacter({ characterId: 60, name: null } as never))).toBeNull();
  expect(decodeAnonCharacter(Buffer.from('{"name":"x"}').toString("base64url"))).toBeNull();
});

test("이름은 선택이고 달력 기본값은 양력이다", () => {
  const parsed = lightBirthSchema.parse({ birth: { year: 1990, month: 10, day: 25 } });
  expect(parsed).toEqual({
    name: null,
    calendar: "solar",
    isLeapMonth: false,
    birth: { year: 1990, month: 10, day: 25 },
  });
});

test("만세력 범위 밖 연도는 스키마에서 막는다", () => {
  expect(lightBirthSchema.safeParse({ birth: { year: 1899, month: 1, day: 1 } }).success).toBe(false);
  expect(lightBirthSchema.safeParse({ birth: { year: 2051, month: 1, day: 1 } }).success).toBe(false);
});

test("생년월일로 캐릭터를 판정한다", () => {
  const c = characterOfLightBirth(
    lightBirthSchema.parse({ birth: { year: 1990, month: 10, day: 25 } }),
  );
  // 1990-10-25 의 일주는 계해 (character.test.ts 의 교차검증 표와 같은 값) — 성별 없이도 정해진다
  expect(c.key).toBe("계해");
  expect(c.family.name).toBe("이슬형");
});
