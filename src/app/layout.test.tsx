import { test, expect } from "vitest";
import { metadata } from "./layout";

test("전화번호 자동 인식을 끈다 — iOS Safari 가 사업자등록번호를 tel 링크로 바꿔 하이드레이션을 깬다", () => {
  expect(metadata.formatDetection?.telephone).toBe(false);
});
