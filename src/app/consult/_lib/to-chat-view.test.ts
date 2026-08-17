import { describe, it, expect } from "vitest";
import { toChatView } from "./to-chat-view";
import type { MessageRow } from "@/lib/consultations/store";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["안녕하세요"],
    suggestions: null,
    crisis: false,
    turnNo: 1,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...over,
  };
}

describe("toChatView", () => {
  it("저장된 순서 그대로 말풍선을 편다", () => {
    const view = toChatView([
      msg({ role: "user", bubbles: ["고민이 있어요"] }),
      msg({ id: "2", role: "counselor", bubbles: ["첫 마디", "둘째 마디"] }),
    ]);
    expect(view).toHaveLength(2);
    expect(view[0]).toEqual({ key: "1", role: "user", bubbles: ["고민이 있어요"] });
    expect(view[1].bubbles).toEqual(["첫 마디", "둘째 마디"]);
  });

  it("마지막 상담사 답의 추천질문만 살린다 — 지난 턴의 칩이 되살아나면 안 된다", () => {
    const view = toChatView([
      msg({ id: "1", role: "counselor", bubbles: ["옛날 답"], suggestions: ["옛 질문"] }),
      msg({ id: "2", role: "user", bubbles: ["네"] }),
      msg({ id: "3", role: "counselor", bubbles: ["최근 답"], suggestions: ["새 질문"] }),
    ]);
    expect(view[0].suggestions).toBeUndefined();
    expect(view[2].suggestions).toEqual(["새 질문"]);
  });

  it("마지막 답에 추천질문이 없으면(마지막 턴) 비운다", () => {
    const view = toChatView([msg({ id: "1", role: "counselor", bubbles: ["끝"], suggestions: [] })]);
    expect(view[0].suggestions).toBeUndefined();
  });

  it("빈 이력은 빈 배열이다", () => {
    expect(toChatView([])).toEqual([]);
  });
});
