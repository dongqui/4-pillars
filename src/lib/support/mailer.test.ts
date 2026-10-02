import { describe, expect, it } from "vitest";
import { createSupportMailer } from "./mailer";

describe("createSupportMailer", () => {
  const full = { RESEND_API_KEY: "test-key", SUPPORT_MAIL_FROM: "a@b.c", SUPPORT_MAIL_TO: "d@e.f" };

  it("세 값이 다 있으면 메일러를 만든다", () => {
    expect(createSupportMailer(full)).not.toBeNull();
  });

  it.each(["RESEND_API_KEY", "SUPPORT_MAIL_FROM", "SUPPORT_MAIL_TO"] as const)(
    "%s 가 비면 null — 메일만 건너뛴다",
    (k) => {
      expect(createSupportMailer({ ...full, [k]: "" })).toBeNull();
    },
  );
});
