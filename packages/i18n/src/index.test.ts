import { describe, it, expect } from "vitest";
import { messages, t } from "./index.js";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("@4-pillars/i18n", () => {
  it("ko와 ja는 동일한 키셋을 가진다", () => {
    expect(flatKeys(messages.ko).sort()).toEqual(flatKeys(messages.ja).sort());
  });

  it("t(locale)는 해당 locale 사전을 반환한다", () => {
    expect(t("ko").login.title).toBe("로그인");
    expect(t("ja").login.title).toBe("ログイン");
  });
});
