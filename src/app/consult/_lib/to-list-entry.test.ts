import { describe, it, expect } from "vitest";
import { toListEntry } from "./to-list-entry";
import type { ConsultationListItem } from "@/lib/consultations/store";

const now = new Date("2026-08-17T12:00:00.000Z");

function row(over: Partial<ConsultationListItem> = {}): ConsultationListItem {
  return {
    id: "7",
    userId: "3",
    profileId: "12",
    status: "open",
    turnsUsed: 3,
    turnLimit: 10,
    title: "직장에서의 답답함",
    ticketSpent: true,
    createdAt: "2026-08-17T02:00:00.000Z",
    closedAt: null,
    lastBubble: "지금 자리에서 답답한 게…",
    ...over,
  };
}

describe("toListEntry", () => {
  it("진행 중이면 몇 번 썼는지 보여준다", () => {
    expect(toListEntry(row(), now).progress).toBe("3/10");
  });

  it("끝난 상담은 완료로 표시한다", () => {
    expect(toListEntry(row({ status: "closed", turnsUsed: 10 }), now).progress).toBe("완료");
  });

  it("제목도 말풍선도 없으면 재개할 수 있는 상담임을 알린다 — 무제로 두면 빈 줄로 보인다", () => {
    const e = toListEntry(row({ title: null, lastBubble: null }), now);
    expect(e.title).toBe("아직 시작하지 않은 상담");
  });

  it("오늘 만든 상담은 오늘로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-17T02:00:00.000Z" }), now).when).toBe("오늘");
  });

  it("어제 만든 상담은 어제로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-16T02:00:00.000Z" }), now).when).toBe("어제");
  });

  it("그보다 오래되면 날짜로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-12T02:00:00.000Z" }), now).when).toBe("8월 12일");
  });

  it("말풍선이 없으면 미리보기를 비운다", () => {
    expect(toListEntry(row({ lastBubble: null }), now).preview).toBe("");
  });

  it("KST 자정을 갓 넘겨 만든 상담을 같은 날 저녁에 보면 오늘로 적는다", () => {
    // 생성 2026-08-17T23:00:00Z = 2026-08-18 08:00 KST
    // 조회 2026-08-18T08:30:00Z = 2026-08-18 17:30 KST — 같은 서울 날짜
    const viewedLater = new Date("2026-08-18T08:30:00.000Z");
    expect(
      toListEntry(row({ createdAt: "2026-08-17T23:00:00.000Z" }), viewedLater).when,
    ).toBe("오늘");
  });

  it("KST 자정 전에 만든 상담을 다음 날 저녁에 보면 어제로 적는다", () => {
    // 생성 2026-08-17T14:00:00Z = 2026-08-17 23:00 KST
    // 조회 2026-08-18T08:30:00Z = 2026-08-18 17:30 KST — 서울 날짜로 하루 차이
    const viewedLater = new Date("2026-08-18T08:30:00.000Z");
    expect(
      toListEntry(row({ createdAt: "2026-08-17T14:00:00.000Z" }), viewedLater).when,
    ).toBe("어제");
  });

  it("KST 새벽에 만든 상담은 UTC 날짜가 아니라 서울 날짜로 적는다", () => {
    // 생성 2026-08-11T22:00:00Z = 2026-08-12 07:00 KST → UTC 로는 8/11 이지만
    // 서울 날짜는 8/12 다. 오늘로부터 충분히 멀어 "N월 N일" 분기로 떨어진다.
    expect(toListEntry(row({ createdAt: "2026-08-11T22:00:00.000Z" }), now).when).toBe(
      "8월 12일",
    );
  });
});
