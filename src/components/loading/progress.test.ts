import { describe, expect, test } from "vitest";
import {
  PROGRESS_CAP,
  activeStepIndex,
  estimateProgress,
  resolveStartedAt,
} from "./progress";

describe("estimateProgress", () => {
  test("시작은 0", () => {
    expect(estimateProgress(0, 30_000)).toBe(0);
    expect(estimateProgress(-5, 30_000)).toBe(0);
  });
  test("예상 시간쯤이면 80% 를 넘는다", () => {
    expect(estimateProgress(30_000, 30_000)).toBeGreaterThan(0.8);
  });
  test("아무리 오래 걸려도 상한을 넘지 않는다 — 끝나지 않았는데 100% 를 보이지 않는다", () => {
    expect(estimateProgress(10 * 60_000, 30_000)).toBeLessThanOrEqual(PROGRESS_CAP);
    expect(PROGRESS_CAP).toBe(0.92);
  });
  test("단조 증가", () => {
    expect(estimateProgress(2_000, 30_000)).toBeLessThan(estimateProgress(4_000, 30_000));
  });
});

describe("activeStepIndex", () => {
  test("0 이면 첫 단계", () => {
    expect(activeStepIndex(0, 5)).toBe(0);
  });
  test("상한에 닿으면 마지막 단계에 머문다", () => {
    expect(activeStepIndex(PROGRESS_CAP, 5)).toBe(4);
  });
  test("중간", () => {
    expect(activeStepIndex(PROGRESS_CAP / 2, 4)).toBe(2);
  });
});

describe("resolveStartedAt", () => {
  const now = 1_000_000;
  test("저장값이 없으면 지금", () => {
    expect(resolveStartedAt(null, now)).toBe(now);
  });
  test("15초 안의 저장값은 이어받는다", () => {
    expect(resolveStartedAt(String(now - 3_000), now)).toBe(now - 3_000);
  });
  test("오래됐거나 미래거나 깨진 값은 버린다", () => {
    expect(resolveStartedAt(String(now - 20_000), now)).toBe(now);
    expect(resolveStartedAt(String(now + 5_000), now)).toBe(now);
    expect(resolveStartedAt("abc", now)).toBe(now);
  });
});
