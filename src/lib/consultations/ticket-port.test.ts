import { describe, it, expect } from "vitest";
import { InsufficientTicketsError, stubTicketPort } from "./ticket-port";

describe("stubTicketPort", () => {
  it("잔액은 0 을 돌려준다 — 던지면 목록 화면 전체가 500 이 된다", async () => {
    expect(await stubTicketPort.getBalance("3")).toBe(0);
  });

  it("차감은 던진다 — 배선 전에 상담이 공짜로 열리면 안 된다", async () => {
    await expect(stubTicketPort.spend("3", "7")).rejects.toThrow();
  });

  it("되돌리기도 던진다", async () => {
    await expect(stubTicketPort.refund("3", "7")).rejects.toThrow();
  });

  it("차감 실패는 배선 전임을 알아볼 수 있는 메시지를 남긴다", async () => {
    await expect(stubTicketPort.spend("3", "7")).rejects.toThrow(/이용권/);
  });
});

describe("InsufficientTicketsError", () => {
  it("이름으로 구별할 수 있다 — 라우트가 이것만 402 로 바꾼다", () => {
    const e = new InsufficientTicketsError();
    expect(e.name).toBe("InsufficientTicketsError");
    expect(e).toBeInstanceOf(Error);
  });
});
