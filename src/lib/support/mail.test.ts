import { describe, expect, it } from "vitest";
import { composeSupportMail, type SupportMailInput } from "./mail";

const base: SupportMailInput = {
  ticketId: "42",
  createdAt: "2026-10-02T01:05:00.000Z",
  kind: "error",
  userId: "7",
  userName: "동진",
  email: "dj@example.com",
  targetLabel: "궁합 · 동진 × 민수",
  paymentId: null,
  refundReason: null,
  body: "결과가 안 열려요",
};

describe("composeSupportMail", () => {
  it("제목은 [종류] 대상 — 이름", () => {
    expect(composeSupportMail(base).subject).toBe("[오류 문의] 궁합 · 동진 × 민수 — 동진");
  });

  it("피드백은 대상이 없어 [종류] 이름", () => {
    expect(composeSupportMail({ ...base, kind: "feedback", targetLabel: null }).subject).toBe("[피드백] 동진");
  });

  it("본문에 문의 번호·사용자·대상·내용·KST 시각이 들어간다", () => {
    const { text } = composeSupportMail(base);
    expect(text).toContain("#42");
    expect(text).toContain("사용자 7");
    expect(text).toContain("dj@example.com");
    expect(text).toContain("궁합 · 동진 × 민수");
    expect(text).toContain("결과가 안 열려요");
    expect(text).toContain("10:05"); // 01:05Z = 10:05 KST
  });

  it("환불은 결제 id 와 사유를 적는다", () => {
    const { subject, text } = composeSupportMail({
      ...base, kind: "refund", targetLabel: "이용권 6장 · 5,000원",
      paymentId: "saju-abc", refundReason: "실수로 결제했어요", body: "",
    });
    expect(subject).toBe("[환불 요청] 이용권 6장 · 5,000원 — 동진");
    expect(text).toContain("saju-abc");
    expect(text).toContain("실수로 결제했어요");
    expect(text).toContain("(내용 없음)");
  });

  it("이메일이 없으면 replyTo 를 빼고 본문에 (없음) 이라 적는다", () => {
    const mail = composeSupportMail({ ...base, email: null });
    expect(mail.replyTo).toBeNull();
    expect(mail.text).toContain("이메일: (없음)");
  });

  it("이메일이 있으면 replyTo 로 — 받은 메일에서 바로 답장한다", () => {
    expect(composeSupportMail(base).replyTo).toBe("dj@example.com");
  });

  it("환불액을 적는다 — 자동 환불이 끝난 메일은 제목이 [환불 완료] 고 조치가 필요 없다고 적는다", () => {
    const { subject, text } = composeSupportMail({ ...base, kind: "refund", refundReason: "기타", refundAmount: 3000, body: "" });
    expect(text).toContain("환불액: 3,000원");
    // 옛 "[환불 요청] 취소해 주세요" 메일과 제목이 같으면 운영자가 이미 끝난 건을 또 취소하려 든다.
    expect(subject).toContain("[환불 완료]");
    expect(text).toContain("포트원 취소 완료 — 조치 불필요");
  });

  it("환불액이 없는 환불 메일은 옛 경로라 [환불 요청] 으로 남는다", () => {
    const { subject, text } = composeSupportMail({ ...base, kind: "refund", refundReason: "기타", body: "" });
    expect(subject).toContain("[환불 요청]");
    expect(text).not.toContain("조치 불필요");
  });

  it("포트원 실패는 제목이 [환불 실패] 고 수동 취소 안내가 있다", () => {
    const { subject, text } = composeSupportMail({
      ...base, kind: "refund", refundReason: "기타", refundAmount: 3000, refundFailed: true, body: "",
    });
    expect(subject).toContain("[환불 실패]");
    expect(text).toContain("수동 취소");
    expect(text).not.toContain("조치 불필요");
  });
});
