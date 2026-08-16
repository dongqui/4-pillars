import { test, expect } from "vitest";
import {
  characterOfLightBirth,
  decodeAnonBirth,
  encodeAnonBirth,
  lightBirthSchema,
} from "./anon";

const BIRTH = { year: 1990, month: 10, day: 25 };

test("쿠키 값은 왕복해도 같은 값이다", () => {
  const value = lightBirthSchema.parse({ name: "동진", birth: BIRTH });
  expect(decodeAnonBirth(encodeAnonBirth(value))).toEqual(value);

  const lunar = lightBirthSchema.parse({ calendar: "lunar", isLeapMonth: true, birth: BIRTH });
  expect(decodeAnonBirth(encodeAnonBirth(lunar))).toEqual(lunar);
});

test("깨진 쿠키는 없는 것으로 취급한다", () => {
  expect(decodeAnonBirth(undefined)).toBeNull();
  expect(decodeAnonBirth("")).toBeNull();
  expect(decodeAnonBirth("not-base64url!!")).toBeNull();
  // 생년월일이 없거나 범위 밖이면 캐릭터를 세울 수 없다
  expect(decodeAnonBirth(Buffer.from('{"name":"x"}').toString("base64url"))).toBeNull();
  expect(
    decodeAnonBirth(
      Buffer.from(JSON.stringify({ birth: { year: 1800, month: 1, day: 1 } })).toString("base64url"),
    ),
  ).toBeNull();
});

test("이름은 선택이고 달력 기본값은 양력이다", () => {
  expect(lightBirthSchema.parse({ birth: BIRTH })).toEqual({
    name: null,
    calendar: "solar",
    isLeapMonth: false,
    birth: BIRTH,
  });
});

test("만세력 범위 밖 연도는 스키마에서 막는다", () => {
  expect(lightBirthSchema.safeParse({ birth: { year: 1899, month: 1, day: 1 } }).success).toBe(
    false,
  );
  expect(lightBirthSchema.safeParse({ birth: { year: 2051, month: 1, day: 1 } }).success).toBe(
    false,
  );
});

test("생년월일로 캐릭터를 판정한다", () => {
  const c = characterOfLightBirth(lightBirthSchema.parse({ birth: BIRTH }));
  // 1990-10-25 의 일주는 계해 (character.test.ts 의 교차검증 표와 같은 값) — 성별 없이도 정해진다
  expect(c.key).toBe("계해");
  expect(c.family.name).toBe("이슬형");
});
